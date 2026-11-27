export const dynamicEnabled = !!import.meta.env?.VITE_DYNAMIC_ENVIRONMENT_ID;

let bridge = null;

export function setDynamicBridge(value) {
  bridge = value;
}

export async function dynamicBridge() {
  const until = Date.now() + 30000;
  while (!bridge?.ready) {
    if (Date.now() > until) throw new Error("Dynamic wallet connection timed out, please retry");
    await new Promise((r) => setTimeout(r, 100));
  }
  return bridge;
}

export async function dynamicToken() {
  const b = await dynamicBridge();
  const token = b.token();
  if (!token) throw new Error("Dynamic session expired, please sign in again");
  return token;
}
