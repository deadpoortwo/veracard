import React, { useState } from "react";
import { Copy, QrCode, ShieldCheck, Loader2 } from "lucide-react";
import { CryptoIcon, WalletQR } from "./BrandMark.jsx";
import { signWalletMessage } from "../walletService.js";
import { createTranslator } from "../i18n.js";

const LazyDynamicWidget = React.lazy(() =>
  import("../DynamicProvider.jsx").then((m) => ({ default: m.DynamicWalletWidget })),
);

export function WalletSection({ account, data, network, lang, onGoDeposit, notify }) {
  const t = createTranslator(lang);
  const [tab, setTab] = useState("wallet"); // wallet | swap | buy
  const [swapMode, setSwapMode] = useState("basic");
  const [fromToken, setFromToken] = useState("BNB");
  const [fromAmount, setFromAmount] = useState("0.1");

  // Explicit message signing (pure UniCard real cryptographic verification)
  const [signMsg, setSignMsg] = useState("VeraCard wallet ownership verification");
  const [walletPw, setWalletPw] = useState("");
  const [sigResult, setSigResult] = useState(null);
  const [signing, setSigning] = useState(false);

  const wallet = account?.wallet;
  const isDynamic = wallet?.provider === "dynamic";
  const addr = wallet?.address || "—";
  const shortAddr = addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

  const copyAddr = () => {
    navigator.clipboard?.writeText(addr);
    notify(lang === "中文" ? "钱包地址已复制" : "Wallet address copied", "info");
  };

  const handleSign = async (e) => {
    e.preventDefault();
    setSigning(true);
    setSigResult(null);
    try {
      const res = await signWalletMessage(signMsg, wallet?.protectionCompleted ? walletPw : undefined);
      setSigResult(res);
      notify(lang === "中文" ? "消息签名成功" : "Message signed successfully");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSigning(false);
    }
  };

  const tabIdx = tab === "wallet" ? 0 : tab === "swap" ? 1 : 2;

  return (
    <div className="space-y-5 panel-swap-up">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">{t("navLocalWallet")}</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {lang === "中文"
              ? "管理您的嵌入式钱包地址、签名与链上余额"
              : "Manage your embedded wallet address, cryptographic signing, and live balances"}
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-[11px] text-emerald-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{isDynamic ? "Dynamic" : lang === "中文" ? "已连接" : "Connected"}</span>
        </span>
      </div>

      {/* Sliding 3-Tab Switcher */}
      <div className="relative grid grid-cols-3 p-1 rounded-xl bg-white/[0.07] overflow-hidden">
        <div
          className="tab-slider-pill absolute top-1 bottom-1 left-1 rounded-lg bg-gradient-to-r from-[#e4c082]/25 via-[#d4a96a]/20 to-[#e4c082]/15 shadow-[0_4px_14px_rgba(0,0,0,0.28)] pointer-events-none"
          style={{ width: "calc((100% - 8px) / 3)", transform: `translateX(${tabIdx * 100}%)` }}
        />
        {[
          { id: "wallet", label: lang === "中文" ? "您的钱包" : "My Wallet" },
          { id: "swap", label: lang === "中文" ? "兑换" : "Swap" },
          { id: "buy", label: lang === "中文" ? "购买加密货币" : "Buy Crypto" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`relative z-10 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === item.id ? "text-amber-300" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "wallet" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 panel-swap-up">
          {/* Embedded Wallet Card */}
          <div className="lg:col-span-6 rounded-3xl liquid-glass p-5 space-y-4">
            <div>
              <div className="text-sm font-bold text-white">{lang === "中文" ? "您的嵌入式钱包" : "Your Embedded Wallet"}</div>
              <div className="text-xs text-zinc-400 mt-0.5">
                {lang === "中文"
                  ? "可用于接收 USDT 或在本地签名验证地址归属。"
                  : "Receive USDT or cryptographically verify ownership of your address."}
              </div>
            </div>

            {isDynamic ? (
              <div className="rounded-2xl overflow-hidden bg-white p-2 shadow-2xl">
                <React.Suspense fallback={<div className="p-6 text-center text-xs text-zinc-500">Loading Dynamic Widget...</div>}>
                  <LazyDynamicWidget />
                </React.Suspense>
              </div>
            ) : (
              <div className="rounded-2xl bg-white text-zinc-900 p-5 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#b88946] text-white flex items-center justify-center text-xs font-bold shrink-0">
                      V
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-900 truncate">{account?.email}</div>
                      <div className="text-[10px] font-mono text-zinc-500">{shortAddr}</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 font-medium text-[11px] shrink-0">
                    {network}
                  </span>
                </div>
                <div>
                  <div className="text-[11px] text-zinc-500">Live USDT Balance</div>
                  <div className="text-3xl font-bold font-mono text-zinc-950">
                    {data?.balance != null ? `${Number(data.balance).toFixed(4)} USDT` : "—"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={onGoDeposit}
                    className="py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold text-zinc-900"
                  >
                    + Deposit
                  </button>
                  <button
                    type="button"
                    onClick={copyAddr}
                    className="py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-white flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Address</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Cryptographic Message Signing */}
          <div className="lg:col-span-6 rounded-3xl liquid-glass p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <div className="text-sm font-bold text-white">
                {lang === "中文" ? "链下消息签名验证" : "Cryptographic Message Signing"}
              </div>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {lang === "中文"
                ? "使用您的真实私钥在本地签署一条消息，不会产生 Gas 或发送任何资产。"
                : "Sign a message locally with your real wallet key to prove address ownership. Never broadcasts transactions."}
            </p>
            <form onSubmit={handleSign} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">{lang === "中文" ? "待签名消息" : "MESSAGE"}</label>
                <input
                  type="text"
                  required
                  value={signMsg}
                  onChange={(e) => setSignMsg(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 text-white focus:outline-none"
                />
              </div>
              {wallet?.protectionCompleted && (
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    {lang === "中文" ? "钱包保护密码" : "WALLET PASSWORD"}
                  </label>
                  <input
                    type="password"
                    required
                    value={walletPw}
                    onChange={(e) => setWalletPw(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 text-white focus:outline-none"
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={signing}
                className="w-full py-2.5 rounded-xl magnetic-btn bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] text-[#14110e] font-semibold text-xs flex items-center justify-center gap-2"
              >
                {signing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{lang === "中文" ? "签名验证" : "Sign Message"}</span>
              </button>
            </form>
            {sigResult && (
              <div className="rounded-xl bg-zinc-950 p-3 space-y-1.5 text-[11px] font-mono">
                <div className="text-emerald-400 font-semibold">Verified Signer: {sigResult.address}</div>
                <div className="text-zinc-400 break-all">Signature: {sigResult.signature}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "swap" && (
        <div className="max-w-md mx-auto rounded-3xl liquid-glass p-6 space-y-4 panel-swap-up">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5 p-1 rounded-xl bg-zinc-950">
              {["basic", "pro"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSwapMode(m)}
                  className={`px-3 py-1 rounded-lg text-xs transition ${
                    swapMode === m ? "bg-gradient-to-r from-[#f3dfb8] to-[#d4a96a] text-[#14110e] font-semibold" : "text-zinc-400"
                  }`}
                >
                  {m === "basic" ? "Basic" : "Swap Pro"}
                </button>
              ))}
            </div>
            <span className="px-2.5 py-1 rounded-full bg-zinc-900 text-[10px] text-zinc-400">Embedded Wallet</span>
          </div>

          {swapMode === "pro" ? (
            <div className="rounded-2xl bg-zinc-950 p-6 text-center space-y-3">
              <div className="text-sm font-bold text-white">Swap Pro</div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {lang === "中文"
                  ? "跨链聚合兑换路由需接入真实链上 DEX 聚合服务后启用。"
                  : "Cross-chain aggregator routing will be enabled once a live DEX router is connected."}
              </p>
              <button
                type="button"
                onClick={() => setSwapMode("basic")}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#f3dfb8] to-[#d4a96a] text-[#14110e] font-semibold text-xs"
              >
                {lang === "中文" ? "返回基础兑换" : "Switch to Basic Swap"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-1.5 text-[11px]">
                {["BNB", "ETH", "USDC"].map((tk) => (
                  <button
                    key={tk}
                    type="button"
                    onClick={() => setFromToken(tk)}
                    className={`px-2.5 py-1 rounded-full flex items-center gap-1.5 transition ${
                      fromToken === tk ? "bg-amber-500/20 text-amber-300 font-semibold" : "bg-zinc-900 text-zinc-400"
                    }`}
                  >
                    <CryptoIcon symbol={tk} size={14} />
                    <span>{tk}</span>
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <div className="rounded-xl bg-zinc-950 p-4 space-y-1">
                  <div className="flex justify-between text-[11px] text-zinc-500">
                    <span>PAY ({fromToken})</span>
                    <CryptoIcon symbol={fromToken} size={16} />
                  </div>
                  <input
                    type="number"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    step="0.05"
                    min="0"
                    className="w-full bg-transparent text-xl font-mono text-white focus:outline-none"
                  />
                </div>
                <div className="rounded-xl bg-zinc-950 p-4 space-y-1">
                  <div className="flex justify-between text-[11px] text-zinc-500">
                    <span>YOU RECEIVE</span>
                    <span className="flex items-center gap-1">
                      <CryptoIcon symbol="USDT" size={16} /> USDT
                    </span>
                  </div>
                  <div className="text-xl font-mono text-zinc-400">— USDT</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  notify(
                    lang === "中文"
                      ? "链上兑换路由尚未接入，不会广播交易"
                      : "Live swap router is not connected yet — no transaction broadcast.",
                    "info",
                  )
                }
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] text-[#14110e] font-semibold text-xs"
              >
                {lang === "中文" ? "获取兑换报价" : "Get Swap Quote"}
              </button>
            </>
          )}
        </div>
      )}

      {tab === "buy" && (
        <div className="space-y-4 panel-swap-up">
          <div className="rounded-2xl bg-gradient-to-r from-emerald-950/60 to-white/[0.05] p-5 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-bold text-emerald-400">BANXA ON-RAMP</div>
              <div className="text-xs text-zinc-300">
                {lang === "中文"
                  ? "支持银行卡 / Apple Pay 购买 USDT 直达您的嵌入式钱包地址。"
                  : "Buy USDT directly with Visa, Mastercard, or Apple Pay to your embedded wallet."}
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-300">banxa</span>
          </div>
          <div className="rounded-3xl liquid-glass p-5 space-y-4">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">CRYPTO DELIVERED TO</div>
            <div className="rounded-xl bg-zinc-950 p-3 font-mono text-xs text-zinc-300 break-all">{addr}</div>
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-xl bg-white shrink-0">
                <WalletQR value={addr} size={84} />
              </div>
              <div className="space-y-2 flex-1">
                <button
                  type="button"
                  onClick={copyAddr}
                  className="w-full py-2.5 rounded-xl magnetic-btn bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] text-[#14110e] font-semibold text-xs"
                >
                  {lang === "中文" ? "复制钱包地址" : "Copy Wallet Address"}
                </button>
                <button
                  type="button"
                  onClick={onGoDeposit}
                  className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 text-xs flex items-center justify-center gap-1.5"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{lang === "中文" ? "前往充值页面" : "Open Deposit Page"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
