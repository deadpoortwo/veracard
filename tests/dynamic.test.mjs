import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose";
import { Wallet } from "ethers";
import { createDynamicVerifier, dynamicWalletCredential } from "../server/dynamic-auth.mjs";
import { normalizeDynamicBalances } from "../server/dynamic-balances.mjs";
import { createApi } from "../server/index.mjs";

test("Signed eip155 embedded credentials bind without accepting external or other-chain wallets", () => {
  const address = Wallet.createRandom().address;
  const credential = { format: "blockchain", chain: "eip155", wallet_provider: "embeddedWallet", address };
  const find = (changes) => dynamicWalletCredential({ credentials: [{ ...credential, ...changes }] }, address.toLowerCase());
  assert.equal(find({})?.address, address);
  assert.equal(find({ chain: "EVM" })?.address, address);
  assert.equal(find({ chain: "SOL" }), undefined);
  assert.equal(find({ wallet_provider: "browserExtension" }), undefined);
  assert.equal(find({ format: "email" }), undefined);
  assert.equal(find({ address: Wallet.createRandom().address }), undefined);
});

test("Dynamic JWT enforces signature, project, audience, expiry and verified email", async () => {
  const environmentId = randomUUID();
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "test" };
  const verifier = createDynamicVerifier(environmentId, { keySet: createLocalJWKSet({ keys: [jwk] }) });
  const issue = (claims = {}, aud = "http://localhost:4173", expiry = "5m") =>
    new SignJWT({
      environment_id: environmentId,
      verified_credentials: [{ id: "email", format: "email", email: "one@example.test" }],
      ...claims,
    })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuedAt()
      .setIssuer("https://app.dynamic.xyz/" + environmentId)
      .setSubject("dynamic-user")
      .setAudience(aud)
      .setExpirationTime(expiry)
      .sign(privateKey);

  assert.equal((await verifier(await issue())).email, "one@example.test");
  await assert.rejects(verifier(await issue({ environment_id: randomUUID() })), /environment/);
  await assert.rejects(verifier(await issue({}, "https://untrusted.example")), /audience/);
  await assert.rejects(verifier(await issue({ verified_credentials: [] })), /email/);
  await assert.rejects(verifier(await issue({}, "http://localhost:4173", Math.floor(Date.now() / 1000) - 60)));
  const other = await generateKeyPair("RS256");
  const forged = await new SignJWT({ environment_id: environmentId })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuedAt()
    .setIssuer("https://app.dynamic.xyz")
    .setSubject("forged")
    .setAudience("http://localhost:4173")
    .setExpirationTime("5m")
    .sign(other.privateKey);
  await assert.rejects(verifier(forged));
});

test("Dynamic session binds only signed embedded-wallet credentials and provider protection", async (t) => {
  const environmentId = randomUUID();
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "binding" };
  const api = createApi({ database: ":memory:", dynamicEnvironmentId: environmentId, dynamicKeySet: createLocalJWKSet({ keys: [jwk] }) });
  await new Promise((r) => api.server.listen(0, "127.0.0.1", r));
  t.after(() => api.close());

  const base = "http://127.0.0.1:" + api.server.address().port;
  let cookie = "";
  const call = async (path, body) => {
    const r = await fetch(base + "/api" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.headers.get("set-cookie")) cookie = r.headers.get("set-cookie").split(";")[0];
    return { status: r.status, data: await r.json() };
  };

  const address = Wallet.createRandom().address;
  const issue = ({ email = "new@example.test", protectedWallet = false, subject = "provider-user" } = {}) =>
    new SignJWT({
      environment_id: environmentId,
      verified_credentials: [
        { id: "email", format: "email", email },
        {
          id: "provider-wallet",
          format: "blockchain",
          chain: "EVM",
          address,
          wallet_provider: "embeddedWallet",
          wallet_properties: { keyShares: [{ passwordEncrypted: protectedWallet }] },
        },
      ],
    })
      .setProtectedHeader({ alg: "RS256", kid: "binding" })
      .setIssuedAt()
      .setIssuer("https://app.dynamic.xyz/" + environmentId)
      .setSubject(subject)
      .setAudience("http://localhost:4173")
      .setExpirationTime("5m")
      .sign(privateKey);

  const c = await call("/auth/challenge", { kind: "register", email: "new@example.test", password: "AccountPass123!" });
  assert.equal(c.data.authProvider, "dynamic");
  assert.equal((await call("/auth/verify", { challengeId: c.data.challengeId, code: "111111" })).status, 401);
  assert.equal(
    (await call("/auth/verify", { challengeId: c.data.challengeId, dynamicToken: await issue({ email: "different@example.test" }) })).status,
    403,
  );
  const token = await issue();
  const login = await call("/auth/verify", { challengeId: c.data.challengeId, dynamicToken: token });
  assert.equal(login.status, 200);
  assert.equal(login.data.dynamicSubject, "provider-user");
  assert.equal((await call("/wallet", { address })).status, 409);
  assert.equal((await call("/wallet/dynamic/sync", { token, address: Wallet.createRandom().address })).status, 403);
  const bound = await call("/wallet/dynamic/sync", { token, address, protectionCompleted: true });
  assert.equal(bound.status, 200);
  assert.equal(bound.data.wallet.provider, "dynamic");
  assert.equal(bound.data.wallet.protectionCompleted, false);
  assert.equal(bound.data.wallet.vault, undefined);
  const protectedState = await call("/wallet/dynamic/sync", { token: await issue({ protectedWallet: true }), address });
  assert.equal(protectedState.data.wallet.protectionCompleted, true);
  assert.equal((await call("/wallet/dynamic/sync", { token: await issue({ subject: "another-user" }), address })).status, 403);
  const saved = JSON.parse(api.db.prepare("SELECT wallet FROM users").get().wallet);
  assert.equal(saved.address, address);
  assert.equal(saved.providerWalletId, "provider-wallet");
  assert.equal(saved.providerEnvironmentId, environmentId);
});

test("Dynamic balances retain token precision and reject other network results", () => {
  const data = normalizeDynamicBalances(
    [
      { networkId: 1, symbol: "ETH", decimals: 18, rawBalanceString: "1000000000000000001", marketValue: 3000 },
      { networkId: 56, symbol: "BNB", decimals: 18, rawBalanceString: "123" },
    ],
    1,
  );
  assert.equal(data.assets.length, 1);
  assert.equal(data.assets[0].balance, "1.000000000000000001");
  assert.equal(data.usdBalance, 3000);
});
