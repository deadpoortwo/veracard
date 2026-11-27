import { fetchDynamicBalances } from "./dynamic-balances.mjs";
import { createDynamicVerifier, dynamicWalletCredential, dynamicWalletProtected } from "./dynamic-auth.mjs";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isAddress, verifyMessage, JsonRpcProvider, FetchRequest, formatEther, Contract, formatUnits } from "ethers";

for (const file of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(file);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}

const digest = (v) => createHash("sha256").update(v).digest("hex");
const hash = (v, s) => scryptSync(v, s, 32).toString("hex");
const equal = (a, b) => a?.length === b?.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const valid = (p) => typeof p === "string" && p.length >= 8 && p.length <= 128;

export function createApi({
  database = process.env.DATABASE_PATH || "server/data/veracard.sqlite",
  localMail = process.env.NODE_ENV !== "production",
  dynamicEnvironmentId = process.env.DYNAMIC_ENVIRONMENT_ID || process.env.VITE_DYNAMIC_ENVIRONMENT_ID || null,
  dynamicKeySet,
} = {}) {
  if (database !== ":memory:") mkdirSync(dirname(resolve(database)), { recursive: true });
  const db = new DatabaseSync(database);
  db.exec(`PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE,salt TEXT,password_hash TEXT,nonce TEXT,wallet TEXT);
  CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY,email TEXT,kind TEXT,salt TEXT,password_hash TEXT,code_hash TEXT,expires INTEGER,sent INTEGER,attempts INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires INTEGER);`);

  if (!db.prepare("PRAGMA table_info(users)").all().some((c) => c.name === "dynamic_subject")) {
    db.exec("ALTER TABLE users ADD COLUMN dynamic_subject TEXT");
  }
  if (!db.prepare("PRAGMA table_info(challenges)").all().some((c) => c.name === "provider")) {
    db.exec("ALTER TABLE challenges ADD COLUMN provider TEXT DEFAULT 'local'");
  }

  const verifyDynamic = dynamicEnvironmentId
    ? createDynamicVerifier(dynamicEnvironmentId, {
        keySet: dynamicKeySet,
        origins: (process.env.DYNAMIC_ALLOWED_ORIGINS || "http://localhost:4173,http://127.0.0.1:4173")
          .split(",")
          .map((s) => s.trim()),
      })
    : null;

  const checkedIdentity = async (token) => {
    try {
      return await verifyDynamic(token);
    } catch {
      throw Object.assign(new Error("Dynamic identity verification failed, please verify your email again"), {
        status: 401,
      });
    }
  };

  const view = (u) =>
    u
      ? {
          id: u.id,
          email: u.email,
          wallet: u.wallet ? JSON.parse(u.wallet) : null,
          walletNonce: u.nonce,
          dynamicSubject: u.dynamic_subject,
        }
      : null;

  const fail = (status, message) => {
    throw Object.assign(new Error(message), { status });
  };

  const tokenFromReq = (req) =>
    req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("veracard_session="))
      ?.slice(17);

  const auth = (req) => {
    const t = tokenFromReq(req);
    const s =
      t && db.prepare("SELECT * FROM sessions WHERE token_hash=? AND expires>?").get(digest(t), Date.now());
    if (!s) fail(401, "Please sign in again");
    return db.prepare("SELECT * FROM users WHERE id=?").get(s.user_id);
  };

  const rates = new Map();

  const server = createServer(async (req, res) => {
    const send = (status, data) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(data));
    };

    try {
      const url = new URL(req.url, "http://localhost");
      const path = url.pathname;

      if (req.method !== "GET") {
        if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
          fail(403, "Invalid request origin");
        }
        if (!req.headers["content-type"]?.startsWith("application/json")) {
          fail(415, "JSON request required");
        }
      }

      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 32768) fail(413, "Request payload too large");
      }
      let b;
      try {
        b = raw ? JSON.parse(raw) : {};
      } catch {
        fail(400, "Invalid JSON payload");
      }

      if (path === "/api/auth/challenge" && req.method === "POST") {
        const now = Date.now();
        const key = req.socket.remoteAddress;
        const rate = rates.get(key) || { n: 0, start: now };
        if (now - rate.start > 60000) {
          rate.n = 0;
          rate.start = now;
        }
        if (++rate.n > 20) fail(429, "Too many requests");
        rates.set(key, rate);

        const email = String(b.email || "").trim().toLowerCase();
        const kind = b.kind;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
          fail(400, "Please enter a valid email address");
        }
        if (!["register", "login", "reset"].includes(kind)) fail(400, "Invalid challenge kind");

        const u = db.prepare("SELECT * FROM users WHERE email=?").get(email);
        const last = db.prepare("SELECT sent FROM challenges WHERE email=? ORDER BY sent DESC LIMIT 1").get(email);
        if (last && now - last.sent < 60000) fail(429, "Please wait for the countdown before resending");
        if (kind === "register" && u) fail(409, "This email is already registered, please sign in");
        if (kind === "register" && !valid(b.password)) fail(400, "Password must be 8–128 characters");
        if (kind === "login" && (!u || !valid(b.password) || !equal(hash(b.password, u.salt), u.password_hash))) {
          fail(400, "Email or password is incorrect");
        }
        if (kind === "reset" && !u) fail(400, "Account not found");

        const provider = verifyDynamic && (!u?.wallet || JSON.parse(u.wallet).provider === "dynamic") ? "dynamic" : "local";
        const id = randomUUID();
        const salt = kind === "register" ? randomBytes(16).toString("hex") : null;
        const code = localMail
          ? "111111"
          : String(randomBytes(4).readUInt32BE() % 1000000).padStart(6, "0");

        if (provider !== "dynamic" && !localMail) {
          if (!process.env.SMTP_URL || !process.env.MAIL_FROM) fail(503, "Mail service is not configured");
          const { default: nodemailer } = await import("nodemailer");
          await nodemailer.createTransport(process.env.SMTP_URL).sendMail({
            from: process.env.MAIL_FROM,
            to: email,
            subject: "VeraCard Email Verification Code",
            text: `Your verification code is: ${code}. It expires in 10 minutes.`,
          });
        }

        db.prepare("DELETE FROM challenges WHERE email=?").run(email);
        db.prepare(
          "INSERT INTO challenges(id,email,kind,salt,password_hash,code_hash,expires,sent) VALUES(?,?,?,?,?,?,?,?)",
        ).run(id, email, kind, salt, salt ? hash(b.password, salt) : null, digest(id + code), now + 600000, now);
        db.prepare("UPDATE challenges SET provider=? WHERE id=?").run(provider, id);
        return send(200, { challengeId: id, email, kind, authProvider: provider, resendAt: now + 60000 });
      }

      if (path === "/api/auth/resend" && req.method === "POST") {
        const c = db.prepare("SELECT * FROM challenges WHERE id=?").get(b.challengeId);
        if (!c) fail(400, "Verification challenge expired");
        if (Date.now() - c.sent < 60000) fail(429, "Please wait for the countdown before resending");
        const code = localMail
          ? "111111"
          : String(randomBytes(4).readUInt32BE() % 1000000).padStart(6, "0");
        if (c.provider !== "dynamic" && !localMail) {
          if (!process.env.SMTP_URL || !process.env.MAIL_FROM) fail(503, "Mail service is not configured");
          const { default: nodemailer } = await import("nodemailer");
          await nodemailer.createTransport(process.env.SMTP_URL).sendMail({
            from: process.env.MAIL_FROM,
            to: c.email,
            subject: "VeraCard Email Verification Code",
            text: `Your verification code is: ${code}`,
          });
        }
        const now = Date.now();
        db.prepare("UPDATE challenges SET code_hash=?,expires=?,sent=?,attempts=0 WHERE id=?").run(
          digest(c.id + code),
          now + 600000,
          now,
          c.id,
        );
        return send(200, { challengeId: c.id, email: c.email, kind: c.kind, authProvider: c.provider, resendAt: now + 60000 });
      }

      if (path === "/api/auth/verify" && req.method === "POST") {
        const c = db.prepare("SELECT * FROM challenges WHERE id=?").get(b.challengeId);
        if (!c || c.expires < Date.now()) fail(400, "Verification code expired, please resend");
        if (c.attempts >= 5) fail(429, "Too many failed attempts, please restart");

        let identity = null;
        if (c.provider === "dynamic") {
          identity = await checkedIdentity(b.dynamicToken);
          if (identity.email !== c.email) fail(403, "Dynamic verified email does not match account");
          const linked = db.prepare("SELECT dynamic_subject FROM users WHERE email=?").get(c.email);
          if (linked?.dynamic_subject && linked.dynamic_subject !== identity.subject) {
            fail(403, "Dynamic account binding mismatch");
          }
        } else if (!/^\d{6}$/.test(b.code) || !equal(digest(c.id + b.code), c.code_hash)) {
          db.prepare("UPDATE challenges SET attempts=attempts+1 WHERE id=?").run(c.id);
          fail(400, "Incorrect verification code");
        }

        if (c.kind === "reset") {
          if (!valid(b.newPassword)) fail(400, "Password must be 8–128 characters");
          const salt = randomBytes(16).toString("hex");
          db.prepare("UPDATE users SET salt=?,password_hash=? WHERE email=?").run(
            salt,
            hash(b.newPassword, salt),
            c.email,
          );
          db.prepare("DELETE FROM sessions WHERE user_id=(SELECT id FROM users WHERE email=?)").run(c.email);
          db.prepare("DELETE FROM challenges WHERE id=?").run(c.id);
          return send(200, { reset: true });
        }

        if (c.kind === "register") {
          db.prepare("INSERT INTO users(id,email,salt,password_hash,nonce) VALUES(?,?,?,?,?)").run(
            randomUUID(),
            c.email,
            c.salt,
            c.password_hash,
            randomBytes(24).toString("hex"),
          );
        }
        if (identity) {
          db.prepare(
            "UPDATE users SET dynamic_subject=? WHERE email=? AND (dynamic_subject IS NULL OR dynamic_subject=?)",
          ).run(identity.subject, c.email, identity.subject);
        }

        const u = db.prepare("SELECT * FROM users WHERE email=?").get(c.email);
        const t = randomBytes(32).toString("hex");
        db.prepare("DELETE FROM challenges WHERE id=?").run(c.id);
        db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(digest(t), u.id, Date.now() + 7 * 86400000);
        res.setHeader(
          "Set-Cookie",
          `veracard_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${
            process.env.NODE_ENV === "production" ? "; Secure" : ""
          }`,
        );
        return send(200, view(u));
      }

      if (path === "/api/auth/session" && req.method === "GET") {
        try {
          return send(200, view(auth(req)));
        } catch (e) {
          if (e.status === 401) return send(200, null);
          throw e;
        }
      }

      if (path === "/api/auth/logout" && req.method === "POST") {
        const t = tokenFromReq(req);
        if (t) db.prepare("DELETE FROM sessions WHERE token_hash=?").run(digest(t));
        res.setHeader("Set-Cookie", "veracard_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
        return send(200, { ok: true });
      }

      const u = auth(req);
      const wallet = u.wallet ? JSON.parse(u.wallet) : null;

      if (path === "/api/wallet/dynamic/sync" && req.method === "POST") {
        if (!verifyDynamic) fail(503, "Dynamic environment is not configured");
        const identity = await checkedIdentity(b.token);
        if (identity.email !== u.email || identity.subject !== u.dynamic_subject) {
          fail(403, "Dynamic session does not match current account");
        }
        const credential = dynamicWalletCredential(identity, b.address);
        if (!credential || !isAddress(b.address)) {
          fail(403, "Wallet address does not belong to a verified Dynamic embedded wallet");
        }
        if (wallet && wallet.provider !== "dynamic") {
          fail(409, "Account already has a non-Dynamic wallet");
        }
        if (wallet && wallet.address.toLowerCase() !== b.address.toLowerCase()) {
          fail(409, "Dynamic wallet address differs from bound wallet");
        }
        const next = {
          provider: "dynamic",
          providerEnvironmentId: dynamicEnvironmentId,
          providerUserId: identity.subject,
          providerWalletId: credential.id,
          address: b.address,
          label: b.address,
          createdAt: wallet?.createdAt || Date.now(),
          networks: ["BNB Chain", "Ethereum"],
          protectionCompleted: dynamicWalletProtected(credential),
          tourCompleted: wallet?.tourCompleted || false,
        };
        db.prepare("UPDATE users SET wallet=? WHERE id=?").run(JSON.stringify(next), u.id);
        return send(200, view({ ...u, wallet: JSON.stringify(next) }));
      }

      if (path === "/api/wallet" && req.method === "GET") return send(200, view(u));

      if (path === "/api/wallet" && req.method === "POST") {
        if (wallet) return send(200, view(u));
        if (verifyDynamic) fail(409, "Use Dynamic wallet initialization");
        if (
          !isAddress(b.address) ||
          b.vault?.kind !== "device" ||
          typeof b.vault.cipher !== "string" ||
          b.vault.cipher.length > 2048 ||
          typeof b.vault.iv !== "string"
        ) {
          fail(400, "Invalid wallet payload");
        }
        if (verifyMessage(`VeraCard wallet binding:${u.id}:${u.nonce}`, b.signature).toLowerCase() !== b.address.toLowerCase()) {
          fail(400, "Wallet signature verification failed");
        }
        const w = {
          address: b.address,
          label: b.address,
          createdAt: Date.now(),
          networks: ["BNB Chain", "Ethereum"],
          protectionCompleted: false,
          tourCompleted: false,
          vault: b.vault,
        };
        db.prepare("UPDATE users SET wallet=? WHERE id=? AND wallet IS NULL").run(JSON.stringify(w), u.id);
        return send(200, view(db.prepare("SELECT * FROM users WHERE id=?").get(u.id)));
      }

      if (path === "/api/wallet/protect" && req.method === "POST") {
        if (!wallet) fail(409, "Wallet not ready");
        if (wallet.provider === "dynamic") fail(409, "Dynamic wallet protection is managed by SDK");
        if (wallet.protectionCompleted) return send(200, view(u));
        let j;
        try {
          j = JSON.parse(b.keystore);
        } catch {
          fail(400, "Invalid wallet keystore");
        }
        if (j.version !== 3 || String(j.address).toLowerCase() !== wallet.address.slice(2).toLowerCase() || (!j.Crypto && !j.crypto)) {
          fail(400, "Keystore address mismatch");
        }
        if (
          verifyMessage(`VeraCard wallet protection:${u.id}:${u.nonce}:${digest(b.keystore)}`, b.signature).toLowerCase() !==
          wallet.address.toLowerCase()
        ) {
          fail(400, "Wallet signature verification failed");
        }
        wallet.vault = { kind: "password", keystore: b.keystore };
        wallet.protectionCompleted = true;
        db.prepare("UPDATE users SET wallet=? WHERE id=?").run(JSON.stringify(wallet), u.id);
        return send(200, view({ ...u, wallet: JSON.stringify(wallet) }));
      }

      if (path === "/api/wallet/tour" && req.method === "POST") {
        if (!wallet) fail(409, "Wallet not ready");
        wallet.tourCompleted = true;
        db.prepare("UPDATE users SET wallet=? WHERE id=?").run(JSON.stringify(wallet), u.id);
        return send(200, view({ ...u, wallet: JSON.stringify(wallet) }));
      }

      if (path === "/api/wallet/balance" && req.method === "GET") {
        if (!wallet) fail(409, "Wallet not ready");
        const eth = url.searchParams.get("network") === "Ethereum";
        if (wallet.provider === "dynamic") {
          const identity = await checkedIdentity(req.headers["x-dynamic-token"]);
          if (identity.subject !== u.dynamic_subject || !dynamicWalletCredential(identity, wallet.address)) {
            fail(403, "Dynamic wallet session mismatch");
          }
          try {
            return send(
              200,
              await fetchDynamicBalances({
                environmentId: dynamicEnvironmentId,
                address: wallet.address,
                networkId: eth ? 1 : 56,
                token: req.headers["x-dynamic-token"],
              }),
            );
          } catch {
            // Query only known on-chain assets if Dynamic's indexer is unavailable.
          }
        }
        const rpc = eth
          ? process.env.ETH_RPC_URL || "https://ethereum-rpc.publicnode.com"
          : process.env.BSC_RPC_URL || "https://bsc-rpc.publicnode.com";
        if (!rpc) return send(200, { status: "unavailable", assets: [], balance: null, message: "On-chain RPC is not configured" });

        const request = new FetchRequest(rpc);
        request.timeout = 10000;
        const provider = new JsonRpcProvider(request, eth ? 1 : 56);
        try {
          const balance = formatEther(await provider.getBalance(wallet.address));
          const assets = [{ symbol: eth ? "ETH" : "BNB", balance }];
          if (!eth) {
            const token = new Contract(
              "0x55d398326f99059fF775485246999027B3197955",
              ["function balanceOf(address) view returns(uint256)"],
              provider,
            );
            assets.push({ symbol: "USDT", balance: formatUnits(await token.balanceOf(wallet.address), 18) });
          }
          return send(200, { status: "ready", balance, assets });
        } catch {
          return send(200, {
            status: "unavailable",
            assets: [],
            balance: null,
            message: "Unable to fetch on-chain balance right now. Please try again later.",
          });
        } finally {
          provider.destroy();
        }
      }

      fail(404, "Endpoint not found");
    } catch (e) {
      send(e.status || 500, { error: e.status ? e.message : "Service temporarily unavailable, please retry" });
    }
  });

  return {
    server,
    db,
    close: () =>
      new Promise((r) =>
        server.close(() => {
          db.close();
          r();
        }),
      ),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server } = createApi();
  server.listen(Number(process.env.API_PORT || 4174), "127.0.0.1", () =>
    console.log("VeraCard API ready on 127.0.0.1:" + (process.env.API_PORT || 4174)),
  );
}
