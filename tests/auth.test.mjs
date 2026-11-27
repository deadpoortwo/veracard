import test from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../server/index.mjs";
import { Wallet, verifyMessage } from "ethers";
import { indexedDB } from "fake-indexeddb";
import { setAccount, restoreSession } from "../src/authStore.js";
import { prepareWallet, protectWallet, signWalletMessage, unlockWallet } from "../src/walletService.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("disk database and session restore the same wallet after API restart", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "veracard-wallet-test-"));
  const database = join(dir, "accounts.sqlite");
  let api = createApi({ database, localMail: true, dynamicEnvironmentId: null });
  const listen = () => new Promise((r) => api.server.listen(0, "127.0.0.1", r));
  await listen();
  let base = "http://127.0.0.1:" + api.server.address().port;
  let cookie = "";
  const nativeFetch = globalThis.fetch;
  const call = async (path, body) => {
    const r = await nativeFetch(base + "/api" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.headers.get("set-cookie")) cookie = r.headers.get("set-cookie").split(";")[0];
    assert.equal(r.status, 200);
    return r.json();
  };
  t.after(async () => {
    globalThis.fetch = nativeFetch;
    setAccount(null);
    await api.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const c = await call("/auth/challenge", { kind: "register", email: "persist@example.test", password: "AccountPass123!" });
  setAccount(await call("/auth/verify", { challengeId: c.challengeId, code: "111111" }));
  globalThis.indexedDB = indexedDB;
  globalThis.fetch = (url, options = {}) =>
    nativeFetch(base + url, { ...options, headers: { ...options.headers, Cookie: cookie } });

  const before = await prepareWallet();
  await protectWallet("WalletPass123!");
  await call("/wallet/tour", {});

  await api.close();
  api = createApi({ database, localMail: true, dynamicEnvironmentId: null });
  await listen();
  base = "http://127.0.0.1:" + api.server.address().port;

  const restored = await call("/auth/session");
  assert.equal(restored.wallet.address, before.wallet.address);
  assert.equal(restored.wallet.protectionCompleted, true);
  assert.equal(restored.wallet.tourCompleted, true);
  setAccount(restored);

  const signed = await signWalletMessage("After durable database reopen", "WalletPass123!");
  assert.equal(verifyMessage(signed.message, signed.signature), before.wallet.address);

  const other = await call("/auth/challenge", { kind: "register", email: "other@example.test", password: "DifferentPass123!" });
  await call("/auth/verify", { challengeId: other.challengeId, code: "111111" });
  assert.equal((await call("/wallet")).wallet, null);
});

test("server OTP, real encrypted wallet binding, protection and recovery", async (t) => {
  const api = createApi({ database: ":memory:", dynamicEnvironmentId: null });
  await new Promise((r) => api.server.listen(0, "127.0.0.1", r));
  t.after(() => api.close());

  const base = "http://127.0.0.1:" + api.server.address().port;
  const nativeFetch = globalThis.fetch;
  let cookie = "";
  const call = async (path, body) => {
    const r = await nativeFetch(base + "/api" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.headers.get("set-cookie")) cookie = r.headers.get("set-cookie").split(";")[0];
    return { status: r.status, data: await r.json() };
  };

  const challenge = await call("/auth/challenge", { kind: "register", email: "wallet@example.test", password: "AccountPass123!" });
  assert.equal(challenge.status, 200);
  const wrong = await call("/auth/verify", { challengeId: challenge.data.challengeId, code: "000000" });
  assert.equal(wrong.status, 400);
  assert.equal((await call("/auth/session")).data, null);
  assert.equal((await call("/auth/resend", { challengeId: challenge.data.challengeId })).status, 429);

  const verified = await call("/auth/verify", { challengeId: challenge.data.challengeId, code: "111111" });
  assert.equal(verified.status, 200);
  assert.equal(verified.data.wallet, null);
  assert.equal((await call("/auth/verify", { challengeId: challenge.data.challengeId, code: "111111" })).status, 400);

  const walletRequests = [];
  globalThis.indexedDB = indexedDB;
  globalThis.fetch = async (url, options = {}) => {
    if (url.startsWith("/api/wallet") && options.body) walletRequests.push(options.body);
    return nativeFetch(base + url, { ...options, headers: { ...options.headers, Cookie: cookie } });
  };
  t.after(() => {
    globalThis.fetch = nativeFetch;
    setAccount(null);
  });

  setAccount(verified.data);
  const wallet = await prepareWallet();
  assert.match(wallet.wallet.address, /^0x[0-9a-fA-F]{40}$/);
  assert.equal(wallet.wallet.vault.kind, "device");

  const address = wallet.wallet.address;
  assert.equal((await prepareWallet()).wallet.address, address);

  const privateKey = (await unlockWallet()).privateKey;
  const signed = await signWalletMessage("Local cryptographic verification");
  assert.equal(verifyMessage(signed.message, signed.signature), address);

  const before = api.db.prepare("SELECT wallet,password_hash FROM users").get();
  assert.ok(!before.wallet.includes("privateKey"));
  assert.ok(!before.password_hash.includes("AccountPass"));

  await protectWallet("WalletPass123!");
  assert.equal(restoreSession().wallet.protectionCompleted, true);
  assert.equal(restoreSession().wallet.vault.kind, "password");

  for (const payload of walletRequests) {
    assert.ok(!payload.includes(privateKey));
    assert.ok(!payload.includes("WalletPass123!"));
    assert.ok(!payload.includes("privateKey"));
  }

  await assert.rejects(signWalletMessage("test", "wrong-password"), /password/i);

  const recovered = (await call("/auth/session")).data;
  setAccount(recovered);
  const after = await signWalletMessage("Restored wallet", "WalletPass123!");
  assert.equal(verifyMessage(after.message, after.signature), address);

  const row = api.db.prepare("SELECT * FROM users").get();
  assert.ok(!JSON.stringify(row).includes("WalletPass123!"));
  assert.ok(!JSON.stringify(row).includes("AccountPass123!"));
  assert.ok(!JSON.stringify(row).includes(privateKey));

  const other = Wallet.createRandom();
  const stolen = await call("/wallet/protect", { keystore: await other.encrypt("AnotherPass123!"), signature: "0x" });
  assert.equal(stolen.status, 200);
  assert.equal(stolen.data.wallet.address, address);

  await call("/auth/logout", {});
  assert.equal((await call("/wallet")).status, 401);

  const login = await call("/auth/challenge", { kind: "login", email: "wallet@example.test", password: "AccountPass123!" });
  assert.equal(login.status, 200);
  const again = await call("/auth/verify", { challengeId: login.data.challengeId, code: "111111" });
  assert.equal(again.data.wallet.address, address);
  assert.equal(again.data.wallet.protectionCompleted, true);
});

test("API rejects foreign origins and unauthenticated wallet writes", async (t) => {
  const api = createApi({ database: ":memory:", dynamicEnvironmentId: null });
  await new Promise((r) => api.server.listen(0, "127.0.0.1", r));
  t.after(() => api.close());
  const url = "http://127.0.0.1:" + api.server.address().port;
  const csrf = await fetch(url + "/api/wallet", {
    method: "POST",
    headers: { Origin: "https://untrusted.example", "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(csrf.status, 403);
  const anonymous = await fetch(url + "/api/wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(anonymous.status, 401);
});
