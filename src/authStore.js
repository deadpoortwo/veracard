import { dynamicEnabled, dynamicBridge, dynamicToken } from "./dynamicRuntime.js";
import { backend } from "./backend.js";

let account = null;
const PENDING = "veracard-server-challenge";

export const restoreSession = () => account;
export const setAccount = (user) => (account = user);

export async function loadSession() {
  let user;
  try {
    user = await backend("/auth/session");
  } catch (e) {
    if (e?.staticHost) return setAccount(null);
    throw e;
  }
  if (user?.wallet?.provider === "dynamic") {
    const bridge = await dynamicBridge();
    if (!bridge.token()) {
      await backend("/auth/logout", {});
      return setAccount(null);
    }
  }
  return setAccount(user);
}

export function pendingInfo() {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING));
  } catch {
    return null;
  }
}

const setPending = (value) => {
  sessionStorage.setItem(PENDING, JSON.stringify(value));
  return value;
};

async function begin(kind, email, password) {
  const challenge = await backend("/auth/challenge", { kind, email, password });
  setPending(challenge);
  if (challenge.authProvider === "dynamic") {
    const bridge = await dynamicBridge();
    if (bridge.snapshot().context.user) await bridge.logout();
    await bridge.send(challenge.email);
  }
  return challenge;
}

export const beginRegistration = (email, password) => begin("register", email, password);
export const beginLogin = (email, password) => begin("login", email, password);
export const beginReset = (email) => begin("reset", email);

export async function resendCode() {
  const p = pendingInfo();
  if (p?.authProvider === "dynamic") await (await dynamicBridge()).resend();
  return setPending(await backend("/auth/resend", { challengeId: p?.challengeId }));
}

export async function verifyCode(code, newPassword) {
  const challenge = pendingInfo();
  let token;
  if (challenge?.authProvider === "dynamic") {
    const bridge = await dynamicBridge();
    await bridge.verify(code);
    token = await dynamicToken();
  }
  const user = await backend("/auth/verify", {
    challengeId: challenge?.challengeId,
    code: challenge?.authProvider === "dynamic" ? undefined : code,
    dynamicToken: token,
    newPassword,
  });
  sessionStorage.removeItem(PENDING);
  if (!user.reset) setAccount(user);
  return user;
}

export async function signOut() {
  await backend("/auth/logout", {});
  try {
    if (dynamicEnabled) await (await dynamicBridge()).logout();
  } finally {
    account = null;
    sessionStorage.removeItem(PENDING);
    dispatchEvent(new Event("veracard-auth-change"));
  }
}

export async function completeTour() {
  return setAccount(await backend("/wallet/tour", {}));
}

export async function changePassword() {
  throw new Error("Please sign out and reset your account password via email verification");
}
