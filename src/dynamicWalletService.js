import { dynamicBridge, dynamicToken } from "./dynamicRuntime.js";
import { backend } from "./backend.js";
import { restoreSession, setAccount } from "./authStore.js";

async function currentWallet() {
  const bridge = await dynamicBridge();
  const state = bridge.snapshot();
  const account = restoreSession();
  if (!state.context.user || !account) throw new Error("Please sign in again to restore your Dynamic wallet");
  const wallet =
    state.waas.getWaasWallets().find((w) => w.chain === "EVM") ||
    (state.embedded.userHasEmbeddedWallet() ? state.context.primaryWallet : null);
  return { bridge, state, wallet };
}

export async function prepareDynamicWallet(progress = () => {}) {
  progress(8, "Verifying Dynamic wallet...");
  let account = await backend("/wallet");
  if (account.wallet && account.wallet.provider !== "dynamic") return account;
  const bridge = await dynamicBridge();
  if (!bridge.snapshot().context.user && bridge.token()) {
    const until = Date.now() + 5000;
    while (!bridge.snapshot().context.user && Date.now() < until) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  if (!bridge.snapshot().context.user) throw new Error("Dynamic session expired, please sign in again");
  progress(30, "Restoring Dynamic wallet...");
  let { state, wallet } = await currentWallet();
  if (!wallet) {
    if (state.waas.dynamicWaasIsEnabled) {
      await state.waas.initializeWaas();
      await state.waas.processSignOnWalletSettings();
    } else {
      await state.embedded.createEmbeddedWallet(["EVM"]);
    }
    const until = Date.now() + 20000;
    while (!wallet && Date.now() < until) {
      ({ state, wallet } = await currentWallet());
      if (!wallet) await new Promise((r) => setTimeout(r, 100));
    }
  }
  if (!wallet || wallet.chain !== "EVM") {
    throw new Error("No EVM wallet found. Please ensure EVM and Embedded Wallets are enabled in Dynamic.");
  }
  progress(70, "Verifying wallet binding...");
  await bridge.snapshot().refreshAuth();
  account = await backend("/wallet/dynamic/sync", { token: await dynamicToken(), address: wallet.address });
  setAccount(account);
  progress(100, "Your wallet is ready");
  return account;
}

export async function protectDynamicWallet(password, progress = () => {}) {
  const { bridge, wallet } = await currentWallet();
  if (!wallet) throw new Error("Dynamic wallet is not ready");
  progress(10);
  const ok = await bridge.snapshot().passwords.setPassword({
    accountAddress: wallet.address,
    chainName: "EVM",
    newPassword: password,
  });
  if (!ok) throw new Error(bridge.snapshot().passwords.state.error || "Failed to set Dynamic wallet password");
  progress(80);
  await bridge.snapshot().refreshAuth();
  const account = await backend("/wallet/dynamic/sync", { token: await dynamicToken(), address: wallet.address });
  if (!account.wallet.protectionCompleted) {
    throw new Error("Dynamic has not confirmed wallet protection status yet. Please refresh and retry.");
  }
  setAccount(account);
  progress(100);
  return account;
}

export async function signDynamicMessage(message, password) {
  const { bridge, wallet } = await currentWallet();
  if (!wallet || wallet.address.toLowerCase() !== restoreSession().wallet.address.toLowerCase()) {
    throw new Error("Dynamic wallet address does not match bound account");
  }
  if (password) {
    const ok = await bridge.snapshot().passwords.unlockWallet({
      accountAddress: wallet.address,
      chainName: "EVM",
      password,
    });
    if (!ok) throw new Error("Incorrect wallet password or unlock failed");
  }
  const signature = await wallet.signMessage(message);
  if (!signature) throw new Error("Signature cancelled");
  return { address: wallet.address, message, signature };
}
