import { dynamicToken } from "./dynamicRuntime.js";
import { walletBalanceData } from "./walletData.js";
import { backend } from "./backend.js";
import { restoreSession } from "./authStore.js";

const VIRTUAL_CATALOG = [
  {
    id: "phcard",
    name: "PHCard",
    type: "virtual",
    fee: 2.0,
    tag: "ID verification",
    tagZh: "需身份验证",
    requiresKyc: true,
    desc: "First name · Last name · Phone number +3",
    descZh: "名字 · 姓氏 · 手机号码 +3",
    limits: { daily: "$250,000", monthly: "$1,000,000", single: "$20,000", topup: "0%", fx: "1.5%", tx: "$0.25 + 1.5%" },
  },
  {
    id: "rpcard",
    name: "RPCard SKU",
    type: "virtual",
    fee: 2.0,
    tag: "ID verification",
    tagZh: "需身份验证",
    requiresKyc: true,
    desc: "First name · Last name · Phone number +3",
    descZh: "名字 · 姓氏 · 手机号码 +3",
    limits: { daily: "$250,000", monthly: "$1,000,000", single: "$20,000", topup: "0%", fx: "1.5%", tx: "$0.25 + 1.5%" },
  },
  {
    id: "uqcard-instant",
    name: "UQCard Instant",
    type: "virtual",
    fee: 60.0,
    tag: "Quick verify",
    tagZh: "快速验证",
    requiresKyc: false,
    desc: "Phone number only",
    descZh: "仅需手机号码",
    limits: { daily: "$250,000", monthly: "$1,000,000", single: "$20,000", topup: "0%", fx: "1.5%", tx: "$0.25 + 1.5%" },
  },
  {
    id: "veracard-agency",
    name: "VeraCard Agency",
    type: "virtual",
    fee: 450.0,
    tag: "Instant issue",
    tagZh: "即时发卡",
    requiresKyc: false,
    desc: "Ready to issue instantly",
    descZh: "可即时开卡",
    limits: { daily: "$250,000", monthly: "$1,000,000", single: "$20,000", topup: "0%", fx: "1.0%", tx: "$0.25 + 1.0%" },
  },
];

const PHYSICAL_CATALOG = [
  {
    id: "veracard-metal",
    name: "VeraCard Physical Metal",
    type: "physical",
    fee: 100.0,
    tag: "Physical",
    tagZh: "实体金属卡",
    requiresKyc: true,
    desc: "Delivered in 5–7 days · Global ATM",
    descZh: "5–7 天邮寄送达 · 全球 ATM",
    limits: { daily: "$250,000", monthly: "$1,000,000", single: "$20,000", topup: "0%", fx: "1.5%", tx: "$0.25 + 1.5%" },
  },
  {
    id: "veracard-standard",
    name: "VeraCard Physical Standard",
    type: "physical",
    fee: 1.0,
    tag: "Physical",
    tagZh: "标准实体卡",
    requiresKyc: false,
    desc: "Standard PVC card · Mailed to your door",
    descZh: "标准实体卡 · 邮寄到家",
    limits: { daily: "$250,000", monthly: "$1,000,000", single: "$20,000", topup: "0%", fx: "1.5%", tx: "$0.25 + 1.5%" },
  },
];

const ALL_PRODUCTS = [...VIRTUAL_CATALOG, ...PHYSICAL_CATALOG];

let adapter = null;
export function configureApi(transport) {
  adapter = transport;
}

const clone = (value) => structuredClone(value);

async function localRequest(resource, params, signal) {
  const user = restoreSession();
  const scope = "veracard-account:" + user?.id + ":";
  const stored = (key) => {
    try {
      return JSON.parse(localStorage.getItem(scope + key) || "null");
    } catch {
      return null;
    }
  };
  const common = {
    balance: null,
    usdBalance: null,
    networkBalances: {},
    assets: [],
    transactions: [],
    activities: [],
    cards: [],
    wallets: [],
    address: user?.wallet?.address || "—",
    email: user?.email || "",
    referral: { code: "Ver1-DSCMAU", pending: 0, received: 0, total: 0, network: [] },
  };

  if (resource === "card.catalog") {
    if (params.type === "virtual") return VIRTUAL_CATALOG;
    if (params.type === "physical") return PHYSICAL_CATALOG;
    throw new Error("Unable to load card catalog right now");
  }
  if (resource === "card.form") {
    const product = ALL_PRODUCTS.find((p) => p.name === params.product || p.id === params.product);
    if (!product) throw new Error("Card product not found");
    return product.requiresKyc ? { kind: "identity", step: 2, product } : { kind: "personalize", step: 3, product };
  }
  if (resource === "card.fees") {
    const product = ALL_PRODUCTS.find((p) => p.name === params.product || p.id === params.product);
    if (!product) throw new Error("Card fees unavailable");
    return { kind: "fees", step: 4, product, limits: product.limits, issuanceFee: product.fee };
  }
  if (resource === "card.coupon") throw new Error("Promo code is invalid or expired.");
  if (resource === "card.identity.submit") return { id: crypto.randomUUID(), status: "pending" };
  if (resource === "preferences.get") return stored("preferences") || {};
  if (resource === "preferences.save") {
    localStorage.setItem(scope + "preferences", JSON.stringify(params.data));
    return params.data;
  }
  if (resource === "card.create") {
    const list = stored("cards") || [];
    const last4 = params.last4 || String(Math.floor(1000 + Math.random() * 9000));
    const card = {
      id: "card_" + Date.now(),
      name: params.name || params.type || "VeraCard Virtual",
      type: params.type || "virtual",
      color: params.color || "#18181b",
      last4,
      pan: `4532 8910 2048 ${last4}`,
      expiry: "12/29",
      cvv: String(Math.floor(100 + Math.random() * 899)),
      frozen: false,
      balance: 0,
    };
    localStorage.setItem(scope + "cards", JSON.stringify([card, ...list]));
    return card;
  }
  if (resource === "card.freeze") {
    const list = stored("cards") || [];
    const next = list.map((c) => (!params.id || c.id === params.id ? { ...c, frozen: !!params.frozen } : c));
    localStorage.setItem(scope + "cards", JSON.stringify(next));
    return { frozen: !!params.frozen };
  }
  if (resource === "page.get") {
    if (user?.wallet) {
      const chain = await backend("/wallet/balance?network=" + encodeURIComponent(params.network || "BNB Chain"), undefined, {
        signal,
        headers: user.wallet.provider === "dynamic" ? { "x-dynamic-token": await dynamicToken() } : undefined,
      });
      Object.assign(common, walletBalanceData(chain, params.network || "BNB Chain"));
    }
    common.cards = stored("cards") || [];
    return common;
  }
  if (resource === "swap.quote") return { amountOut: 0, route: null };
  if (resource === "telegram.pair") return { code: "123456" };
  if (resource === "wallet.send") throw new Error("Insufficient balance");
  return { ok: true };
}

export async function request(resource, params = {}, { signal, delay = 350 } = {}) {
  if (adapter) return adapter(resource, params, { signal });
  if (delay > 0) {
    await new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", abort);
        resolve();
      }, delay);
      signal?.addEventListener("abort", abort, { once: true });
    });
  }
  return clone(await localRequest(resource, params, signal));
}

export const api = {
  cardCatalog: (type) => request("card.catalog", { type }),
  cardForm: (product) => request("card.form", { product }),
  cardFees: (product, details) => request("card.fees", { product, ...details }),
  applyCardCoupon: (params) => request("card.coupon", params),
  submitIdentity: (params) => request("card.identity.submit", params),
  page: (page, query, options) => request("page.get", { page, ...query }, options),
  preferences: (options) => request("preferences.get", {}, options),
  savePreferences: (data) => request("preferences.save", { data }),
  createCard: (payload) => request("card.create", typeof payload === "string" ? { type: payload } : payload),
  freezeCard: (frozen, id) => request("card.freeze", { frozen, id }),
  quote: (params) => request("swap.quote", params),
  pairTelegram: () => request("telegram.pair"),
  send: (params) => request("wallet.send", params),
};
