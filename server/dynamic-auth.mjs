import { createRemoteJWKSet, jwtVerify } from "jose";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function createDynamicVerifier(
  environmentId,
  { keySet, origins = ["http://localhost:4173", "http://127.0.0.1:4173"] } = {},
) {
  if (!uuid.test(environmentId)) throw new Error("Invalid Dynamic environment ID");
  // Never build a JWKS URL from unverified JWT claims.
  const keys =
    keySet ||
    createRemoteJWKSet(new URL(`https://app.dynamic.xyz/api/v0/sdk/${environmentId}/.well-known/jwks`), {
      timeoutDuration: 10000,
    });
  return async (token) => {
    if (typeof token !== "string" || token.length > 24000) throw new Error("Invalid Dynamic token");
    const { payload } = await jwtVerify(token, keys, {
      algorithms: ["RS256", "ES256"],
      requiredClaims: ["exp", "iat", "sub", "iss", "aud"],
      clockTolerance: 5,
    });
    if (
      payload.environment_id !== environmentId ||
      !/^(?:https?:\/\/)?app\.(dynamic\.xyz|dynamicauth\.com)(\/|$)/.test(payload.iss)
    ) {
      throw new Error("Dynamic environment mismatch");
    }
    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audience.some((a) => origins.includes(a))) throw new Error("Dynamic audience mismatch");
    if (!Array.isArray(payload.verified_credentials)) throw new Error("Missing verified credentials");
    const emailCredential = payload.verified_credentials.find(
      (c) => c.format === "email" && typeof c.email === "string",
    );
    if (!emailCredential) throw new Error("Verified email required");
    return {
      subject: payload.sub,
      email: emailCredential.email.toLowerCase(),
      credentials: payload.verified_credentials,
    };
  };
}

// SDK wallet objects use EVM; signed v3 credentials use the CAIP namespace eip155.
export function dynamicWalletCredential(identity, address) {
  return identity.credentials.find(
    (c) =>
      c.format === "blockchain" &&
      ["EVM", "eip155"].includes(c.chain) &&
      c.wallet_provider === "embeddedWallet" &&
      c.address?.toLowerCase() === address?.toLowerCase(),
  );
}

export function dynamicWalletProtected(credential) {
  return credential?.wallet_properties?.keyShares?.some((s) => s.passwordEncrypted === true) || false;
}

export function dynamicWalletAddresses(identity) {
  const out = {};
  for (const c of identity?.credentials || []) {
    if (c.format !== "blockchain" || c.wallet_provider !== "embeddedWallet" || !c.address) continue;
    const ch = String(c.chain || "").toUpperCase();
    if (ch === "EVM" || ch === "EIP155") out.EVM = c.address;
    else if (ch === "SOL" || ch === "SOLANA") out.SOL = c.address;
    else if (ch === "BTC" || ch === "BITCOIN") out.BTC = c.address;
    else if (ch === "TRON" || ch === "TRX") out.TRON = c.address;
  }
  return out;
}
