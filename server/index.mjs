import { fetchDynamicBalances } from "./dynamic-balances.mjs";
import { createDynamicVerifier, dynamicWalletCredential, dynamicWalletProtected, dynamicWalletAddresses } from "./dynamic-auth.mjs";
import { createDb } from "./db.mjs";
import { createServer } from "node:http";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { resolve } from "node:path";
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
  databaseUrl = process.env.DATABASE_URL || null,
  database = process.env.DATABASE_PATH || "server/data/veracard.sqlite",
  localMail = process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_OTP === "true",
  dynamicEnvironmentId = process.env.DYNAMIC_ENVIRONMENT_ID || process.env.VITE_DYNAMIC_ENVIRONMENT_ID || null,
  dynamicKeySet,
  corsAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
} = {}) {
  const db = createDb({ databaseUrl, database });

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

  const auth = async (req) => {
    const t = tokenFromReq(req);
    const s = t && (await db.getValidSession(digest(t), Date.now()));
    if (!s) fail(401, "Please sign in again");
    return db.getUserById(s.user_id);
  };

  const rates = new Map();
  const crossSite = corsAllowedOrigins.length > 0;
  const cookieAttrs = crossSite
    ? "HttpOnly; SameSite=None; Secure; Path=/"
    : `HttpOnly; SameSite=Strict; Path=/${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;

  const server = createServer(async (req, res) => {
    const reqOrigin = req.headers.origin;
    const corsHeaders = {};
    if (reqOrigin && corsAllowedOrigins.includes(reqOrigin)) {
      corsHeaders["Access-Control-Allow-Origin"] = reqOrigin;
      corsHeaders["Access-Control-Allow-Credentials"] = "true";
      corsHeaders["Access-Control-Allow-Headers"] = "Content-Type, x-dynamic-token";
      corsHeaders["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
      corsHeaders["Vary"] = "Origin";
    }

    const send = (status, data) => {
      res.writeHead(status, {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(data));
    };

    try {
      const url = new URL(req.url, "http://localhost");
      const path = url.pathname;

      if (req.method === "OPTIONS") {
        if (reqOrigin && !corsAllowedOrigins.includes(reqOrigin)) fail(403, "Invalid request origin");
        res.writeHead(204, corsHeaders);
        res.end();
        return;
      }

      if ((path === "/api/health" || path === "/health") && req.method === "GET") {
        await db.ready;
        return send(200, { ok: true, service: "veracard-api", storage: db.kind });
      }

      if (req.method !== "GET") {
        if (
          reqOrigin &&
          new URL(reqOrigin).host !== req.headers.host &&
          !corsAllowedOrigins.includes(reqOrigin)
        ) {
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

        const u = await db.getUserByEmail(email);
        const last = await db.getLatestChallengeSent(email);
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

        await db.replaceChallenge({
          id,
          email,
          kind,
          salt,
          passwordHash: salt ? hash(b.password, salt) : null,
          codeHash: digest(id + code),
          expires: now + 600000,
          sent: now,
          provider,
        });
        return send(200, { challengeId: id, email, kind, authProvider: provider, resendAt: now + 60000 });
      }

      if (path === "/api/auth/resend" && req.method === "POST") {
        const c = await db.getChallenge(b.challengeId);
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
        await db.updateChallengeResend(c.id, digest(c.id + code), now + 600000, now);
        return send(200, { challengeId: c.id, email: c.email, kind: c.kind, authProvider: c.provider, resendAt: now + 60000 });
      }

      if (path === "/api/auth/verify" && req.method === "POST") {
        const c = await db.getChallenge(b.challengeId);
        if (!c || c.expires < Date.now()) fail(400, "Verification code expired, please resend");
        if (c.attempts >= 5) fail(429, "Too many failed attempts, please restart");

        let identity = null;
        if (c.provider === "dynamic") {
          identity = await checkedIdentity(b.dynamicToken);
          if (identity.email !== c.email) fail(403, "Dynamic verified email does not match account");
          const linked = await db.getUserByEmail(c.email);
          if (linked?.dynamic_subject && linked.dynamic_subject !== identity.subject) {
            fail(403, "Dynamic account binding mismatch");
          }
        } else if (!/^\d{6}$/.test(b.code) || !equal(digest(c.id + b.code), c.code_hash)) {
          await db.incrementChallengeAttempts(c.id);
          fail(400, "Incorrect verification code");
        }

        if (c.kind === "reset") {
          if (!valid(b.newPassword)) fail(400, "Password must be 8–128 characters");
          const salt = randomBytes(16).toString("hex");
          await db.updateUserPassword(c.email, salt, hash(b.newPassword, salt));
          await db.deleteSessionsByEmail(c.email);
          await db.deleteChallenge(c.id);
          return send(200, { reset: true });
        }

        if (c.kind === "register") {
          await db.insertUser({
            id: randomUUID(),
            email: c.email,
            salt: c.salt,
            passwordHash: c.password_hash,
            nonce: randomBytes(24).toString("hex"),
          });
        }
        if (identity) {
          await db.updateUserDynamicSubject(c.email, identity.subject);
        }

        const u = await db.getUserByEmail(c.email);
        const t = randomBytes(32).toString("hex");
        await db.deleteChallenge(c.id);
        await db.insertSession(digest(t), u.id, Date.now() + 7 * 86400000);
        res.setHeader("Set-Cookie", `veracard_session=${t}; ${cookieAttrs}; Max-Age=604800`);
        return send(200, view(u));
      }

      if (path === "/api/auth/session" && req.method === "GET") {
        try {
          return send(200, view(await auth(req)));
        } catch (e) {
          if (e.status === 401) return send(200, null);
          throw e;
        }
      }

      if (path === "/api/auth/logout" && req.method === "POST") {
        const t = tokenFromReq(req);
        if (t) await db.deleteSession(digest(t));
        res.setHeader("Set-Cookie", `veracard_session=; ${cookieAttrs}; Max-Age=0`);
        return send(200, { ok: true });
      }

      const u = await auth(req);
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
        const addresses = { EVM: b.address, ...dynamicWalletAddresses(identity) };
        const next = {
          provider: "dynamic",
          providerEnvironmentId: dynamicEnvironmentId,
          providerUserId: identity.subject,
          providerWalletId: credential.id,
          address: b.address,
          addresses,
          label: b.address,
          createdAt: wallet?.createdAt || Date.now(),
          networks: ["BNB Chain", "Ethereum", "Solana", "Bitcoin", "TRON"],
          protectionCompleted: dynamicWalletProtected(credential),
          tourCompleted: wallet?.tourCompleted || false,
        };
        await db.updateUserWallet(u.id, JSON.stringify(next));
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
        await db.updateUserWallet(u.id, JSON.stringify(w), true);
        return send(200, view(await db.getUserById(u.id)));
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
        await db.updateUserWallet(u.id, JSON.stringify(wallet));
        return send(200, view({ ...u, wallet: JSON.stringify(wallet) }));
      }

      if (path === "/api/wallet/tour" && req.method === "POST") {
        if (!wallet) fail(409, "Wallet not ready");
        wallet.tourCompleted = true;
        await db.updateUserWallet(u.id, JSON.stringify(wallet));
        return send(200, view({ ...u, wallet: JSON.stringify(wallet) }));
      }

      if (path === "/api/wallet/balance" && req.method === "GET") {
        if (!wallet) fail(409, "Wallet not ready");
        const net = url.searchParams.get("network") || "BNB Chain";

        if (net === "Solana") {
          const solAddr = wallet.addresses?.SOL;
          if (!solAddr) return send(200, { status: "unavailable", assets: [], balance: null, message: "Solana embedded wallet not created yet." });
          try {
            const r = await fetch(process.env.SOL_RPC_URL || "https://api.mainnet-beta.solana.com", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [solAddr] }),
              signal: AbortSignal.timeout(10000),
            });
            const j = await r.json();
            const sol = ((j?.result?.value ?? 0) / 1e9).toString();
            return send(200, { status: "ready", balance: null, assets: [{ symbol: "SOL", balance: sol }] });
          } catch {
            return send(200, { status: "unavailable", assets: [], balance: null, message: "Unable to fetch Solana balance right now." });
          }
        }

        if (net === "Bitcoin") {
          const btcAddr = wallet.addresses?.BTC;
          if (!btcAddr) return send(200, { status: "unavailable", assets: [], balance: null, message: "Bitcoin embedded wallet not created yet." });
          try {
            const r = await fetch(`https://mempool.space/api/address/${encodeURIComponent(btcAddr)}`, {
              signal: AbortSignal.timeout(10000),
            });
            const j = await r.json();
            const sats = (j?.chain_stats?.funded_txo_sum || 0) - (j?.chain_stats?.spent_txo_sum || 0);
            const btc = (sats / 1e8).toString();
            return send(200, { status: "ready", balance: null, assets: [{ symbol: "BTC", balance: btc }] });
          } catch {
            return send(200, { status: "unavailable", assets: [], balance: null, message: "Unable to fetch Bitcoin balance right now." });
          }
        }

        if (net === "TRON") {
          const tronAddr = wallet.addresses?.TRON;
          if (!tronAddr) return send(200, { status: "unavailable", assets: [], balance: null, message: "TRON embedded wallet not created yet." });
          try {
            const r = await fetch(`https://api.trongrid.io/v1/accounts/${encodeURIComponent(tronAddr)}`, {
              signal: AbortSignal.timeout(10000),
            });
            const j = await r.json();
            const sun = j?.data?.[0]?.balance || 0;
            const trx = (sun / 1e6).toString();
            return send(200, { status: "ready", balance: null, assets: [{ symbol: "TRX", balance: trx }] });
          } catch {
            return send(200, { status: "unavailable", assets: [], balance: null, message: "Unable to fetch TRON balance right now." });
          }
        }

        const eth = net === "Ethereum";
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
        server.close(async () => {
          await db.close();
          r();
        }),
      ),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server } = createApi();
  const port = Number(process.env.PORT || process.env.API_PORT || 4174);
  const host = process.env.HOST || (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
  server.listen(port, host, () => console.log(`VeraCard API ready on ${host}:${port}`));
}
