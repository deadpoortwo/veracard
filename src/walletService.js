import { dynamicEnabled } from "./dynamicRuntime.js";
import { prepareDynamicWallet, protectDynamicWallet, signDynamicMessage } from "./dynamicWalletService.js";
import { Wallet, verifyMessage } from "ethers";
import { backend } from "./backend.js";
import { restoreSession, setAccount } from "./authStore.js";

const enc = new TextEncoder();
const dec = new TextDecoder();
const hex = (b) => Array.from(new Uint8Array(b), (v) => v.toString(16).padStart(2, "0")).join("");
const unhex = (s) => Uint8Array.from(s.match(/.{2}/g) || [], (v) => parseInt(v, 16));

function deviceStore(mode, action) {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open("veracard-wallet-vault", 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore("keys");
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      const tx = db.transaction("keys", mode);
      const request = action(tx.objectStore("keys"));
      tx.oncomplete = () => {
        resolve(request?.result);
        db.close();
      };
      tx.onerror = () => {
        reject(tx.error);
        db.close();
      };
    };
  });
}

const getKey = (id) => deviceStore("readonly", (s) => s.get(id));
const putKey = (id, value) => deviceStore("readwrite", (s) => s.put(value, id));

let initializing = null;

export function prepareWallet(onProgress = () => {}) {
  if (initializing) return initializing;
  if (dynamicEnabled && (!restoreSession()?.wallet || restoreSession().wallet.provider === "dynamic")) {
    return prepareDynamicWallet(onProgress);
  }
  if (typeof window !== "undefined" && !navigator.locks) {
    return Promise.reject(new Error("This browser does not support secure wallet initialization. Please update your browser."));
  }
  const run = () => prepare(onProgress);
  initializing = (
    globalThis.navigator?.locks ? navigator.locks.request("veracard-wallet-" + restoreSession()?.id, run) : run()
  ).finally(() => {
    initializing = null;
  });
  return initializing;
}

async function prepare(progress) {
  progress(8, "Verifying wallet session...");
  let user = await backend("/wallet");
  progress(25, "Restoring wallet...");
  if (user.wallet) {
    if (user.wallet.vault.kind === "device" && !(await getKey(user.id))) {
      throw new Error("Wallet password is not set yet. Please return to the browser where you created this wallet to protect it.");
    }
    setAccount(user);
    progress(100, "Your wallet is ready");
    return user;
  }

  let local = await getKey(user.id);
  let signer;
  if (local) {
    const clear = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unhex(local.vault.iv) },
      local.key,
      unhex(local.vault.cipher),
    );
    signer = new Wallet(dec.decode(clear));
  } else {
    progress(40, "Generating wallet keys...");
    signer = new Wallet(Wallet.createRandom().privateKey);
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(signer.privateKey));
    local = { key, vault: { kind: "device", iv: hex(iv), cipher: hex(cipher) } };
    await putKey(user.id, local);
  }

  progress(65, "Verifying wallet signature...");
  const message = `VeraCard wallet binding:${user.id}:${user.walletNonce}`;
  const signature = await signer.signMessage(message);
  if (verifyMessage(message, signature) !== signer.address) throw new Error("Wallet signature verification failed");

  progress(85, "Saving encrypted wallet...");
  user = await backend("/wallet", { address: signer.address, signature, vault: local.vault });
  if (user.wallet.address !== signer.address) {
    throw new Error("A wallet was already created on another device. Please sign in again to restore it.");
  }
  setAccount(user);
  progress(100, "Your wallet is ready");
  return user;
}

export async function unlockWallet(password) {
  const user = restoreSession();
  if (!user?.wallet) throw new Error("Please prepare your wallet first");
  const vault = user.wallet.vault;
  let signer;
  if (vault.kind === "password") {
    if (!password) throw new Error("Please enter your wallet password");
    try {
      signer = await Wallet.fromEncryptedJson(vault.keystore, password);
    } catch {
      throw new Error("Incorrect wallet password or corrupted keystore");
    }
  } else {
    const local = await getKey(user.id);
    if (!local) throw new Error("Please complete wallet protection on the browser where you created it");
    signer = new Wallet(
      dec.decode(
        await crypto.subtle.decrypt({ name: "AES-GCM", iv: unhex(vault.iv) }, local.key, unhex(vault.cipher)),
      ),
    );
  }
  if (signer.address.toLowerCase() !== user.wallet.address.toLowerCase()) throw new Error("Wallet address mismatch");
  return signer;
}

export async function protectWallet(password, progress = () => {}) {
  if (restoreSession()?.wallet?.provider === "dynamic") return protectDynamicWallet(password, progress);
  if (
    password.length < 8 ||
    password.length > 70 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^a-zA-Z0-9]/.test(password)
  ) {
    throw new Error("Please meet all password requirements");
  }
  const user = restoreSession();
  const signer = await unlockWallet();
  const keystore = await signer.encrypt(password, progress);
  const digestHex = hex(await crypto.subtle.digest("SHA-256", enc.encode(keystore)));
  const signature = await signer.signMessage(`VeraCard wallet protection:${user.id}:${user.walletNonce}:${digestHex}`);
  const result = await backend("/wallet/protect", { keystore, signature });
  setAccount(result);
  await deviceStore("readwrite", (s) => s.delete(user.id));
  return result;
}

export async function signWalletMessage(message, password) {
  if (restoreSession()?.wallet?.provider === "dynamic") return signDynamicMessage(message, password);
  const signer = await unlockWallet(password);
  return { address: signer.address, message, signature: await signer.signMessage(message) };
}
