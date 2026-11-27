import React, { useEffect, useState } from "react";
import { Shield, Check, Eye, EyeOff, Loader2, X, Utensils, Repeat, Plane, ShoppingBag, Wifi } from "lucide-react";
import { CryptoIcon } from "./BrandMark.jsx";
import { protectWallet } from "../walletService.js";
import { createTranslator } from "../i18n.js";

export function WalletReminder({ wallet, lang, onStart }) {
  const t = createTranslator(lang);
  if (!wallet || wallet.protectionCompleted) return null;
  const daysElapsed = Math.floor((Date.now() - (wallet.createdAt || Date.now())) / 86400000);
  const daysLeft = Math.max(0, 7 - daysElapsed);

  return (
    <div className="float-card rounded-2xl bg-gradient-to-r from-[#2e241a]/80 via-[#221c17]/75 to-white/[0.05] backdrop-blur-xl shadow-[0_14px_34px_-12px_rgba(0,0,0,0.5)] p-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/35 flex flex-col items-center justify-center leading-none">
          <span className="font-bold text-amber-400 text-sm">{daysLeft}</span>
          <span className="text-[9px] text-amber-300/80">{lang === "中文" ? "天" : "d"}</span>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{t("protectBannerTitle")}</div>
          <div className="text-xs text-zinc-400">{t("protectBannerDesc")}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="px-4 py-2 rounded-xl magnetic-btn bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] hover:brightness-105 text-[#14110e] font-semibold text-xs transition"
      >
        {t("protectNow")}
      </button>
    </div>
  );
}

export function WalletProtectionModal({ open, onClose, onComplete, lang }) {
  const [step, setStep] = useState(1);
  const [q1Pick, setQ1Pick] = useState("");
  const [q2Pick, setQ2Pick] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setStep(1);
      setQ1Pick("");
      setQ2Pick("");
      setPw1("");
      setPw2("");
      setError("");
      setSaving(false);
      setProgress(0);
    }
  }, [open]);

  if (!open) return null;

  const rules = {
    len: pw1.length >= 8 && pw1.length <= 70,
    up: /[A-Z]/.test(pw1),
    low: /[a-z]/.test(pw1),
    num: /\d/.test(pw1),
    sym: /[^A-Za-z0-9]/.test(pw1),
  };
  const allValid = Object.values(rules).every(Boolean);
  const mismatch = pw2.length > 0 && pw1 !== pw2;

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    if (!allValid) {
      setError(lang === "中文" ? "请满足全部 5 项密码规则" : "Please meet all 5 password requirements");
      return;
    }
    if (pw1 !== pw2) {
      setError(lang === "中文" ? "两次输入的密码不一致" : "Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await protectWallet(pw1, (p) => setProgress(Math.round(p <= 1 ? p * 100 : p)));
      setStep(5);
    } catch (err) {
      setError(err.message || "Failed to protect wallet");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#120e0b]/75 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="spring-modal relative w-full max-w-md rounded-3xl liquid-glass overflow-hidden p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {step < 5 && (
          <div className="space-y-2 mb-5">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => step > 1 && setStep(step - 1)}
                className={`text-zinc-400 hover:text-white text-xs w-4 text-left ${step > 1 ? "" : "invisible"}`}
              >
                ←
              </button>
              <div className="flex-1 flex gap-1.5">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${n <= step ? "bg-amber-500" : "bg-zinc-800"}`} />
                ))}
              </div>
              <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-center text-[11px] font-mono text-zinc-400">
              {lang === "中文" ? "步骤" : "STEP"} <span className="text-amber-400 font-bold">{step}</span> / 4
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="text-center space-y-5 panel-swap-up">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
              <Shield className="w-6 h-6 text-amber-400" />
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">
                {lang === "中文" ? "安全提醒" : "SECURITY NOTICE"}
              </div>
              <h3 className="text-lg font-bold text-white">{lang === "中文" ? "保护您的钱包" : "Protect your wallet"}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {lang === "中文"
                  ? "我们仅在本地加密密钥，请设置密码以保护您的 VeraCard 钱包。只有您能重置它，我们不能，也无法重置。"
                  : "Set a password to protect your VeraCard wallet. Only you hold it — we cannot reset it for you."}
              </p>
            </div>
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] hover:brightness-105 text-[#14110e] font-semibold text-xs"
              >
                {lang === "中文" ? "继续" : "Continue"}
              </button>
              <button type="button" onClick={onClose} className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300">
                {lang === "中文" ? "稍后再说" : "Later"}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 panel-swap-up">
            <div className="text-center space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">
                {lang === "中文" ? "小测验" : "QUIZ"}
              </div>
              <h3 className="text-base font-bold text-white">
                {lang === "中文" ? "忘记密码后，谁能帮你重置？" : "If you forget your password, who can reset it?"}
              </h3>
            </div>
            <div className="space-y-2.5">
              {[
                { id: "A", text: lang === "中文" ? "VeraCard 客服" : "VeraCard support" },
                { id: "B", text: lang === "中文" ? "没有人，只有我自己。" : "Nobody, only me." },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setQ1Pick(opt.id)}
                  className={`w-full p-3.5 rounded-xl border flex items-center gap-3 text-left text-xs transition ${
                    q1Pick === opt.id
                      ? opt.id === "B"
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                        : "border-red-500/60 bg-red-500/10 text-red-300"
                      : "border-white/[0.08] bg-zinc-950 text-zinc-200 hover:border-zinc-700"
                  }`}
                >
                  <span className="w-6 h-6 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center font-mono text-[11px] shrink-0">
                    {opt.id}
                  </span>
                  <span>{opt.text}</span>
                </button>
              ))}
            </div>
            {q1Pick && (
              <div className={`text-xs ${q1Pick === "B" ? "text-emerald-400" : "text-red-400"}`}>
                {q1Pick === "B"
                  ? lang === "中文"
                    ? "正确，请妥善记录并保管您的密码。"
                    : "Correct. Write it down and keep it safe."
                  : lang === "中文"
                    ? "不对，没有人能重置，包括我们。"
                    : "Incorrect. Nobody can reset it, not even us."}
              </div>
            )}
            <button
              type="button"
              disabled={q1Pick !== "B"}
              onClick={() => setStep(3)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] disabled:opacity-40 text-[#14110e] font-semibold text-xs transition"
            >
              {lang === "中文" ? "继续" : "Continue"}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 panel-swap-up">
            <div className="text-center space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">
                {lang === "中文" ? "小测验" : "QUIZ"}
              </div>
              <h3 className="text-base font-bold text-white">
                {lang === "中文"
                  ? "有人自称“VeraCard 客服”向你要密码，你怎么做？"
                  : "Someone claiming to be VeraCard support asks for your password. What do you do?"}
              </h3>
            </div>
            <div className="space-y-2.5">
              {[
                { id: "A", text: lang === "中文" ? "绝不透露，这是诈骗。" : "Never share it, it's a scam." },
                { id: "B", text: lang === "中文" ? "告诉对方" : "Tell them" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setQ2Pick(opt.id)}
                  className={`w-full p-3.5 rounded-xl border flex items-center gap-3 text-left text-xs transition ${
                    q2Pick === opt.id
                      ? opt.id === "A"
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                        : "border-red-500/60 bg-red-500/10 text-red-300"
                      : "border-white/[0.08] bg-zinc-950 text-zinc-200 hover:border-zinc-700"
                  }`}
                >
                  <span className="w-6 h-6 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center font-mono text-[11px] shrink-0">
                    {opt.id}
                  </span>
                  <span>{opt.text}</span>
                </button>
              ))}
            </div>
            {q2Pick && (
              <div className={`text-xs ${q2Pick === "A" ? "text-emerald-400" : "text-red-400"}`}>
                {q2Pick === "A"
                  ? lang === "中文"
                    ? "正确，我们永远不会向您索要密码。"
                    : "Correct. We will never ask for your password."
                  : lang === "中文"
                    ? "危险！官方客服永远不会索要您的密码。"
                    : "Never share your password with anyone."}
              </div>
            )}
            <button
              type="button"
              disabled={q2Pick !== "A"}
              onClick={() => setStep(4)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] disabled:opacity-40 text-[#14110e] font-semibold text-xs transition"
            >
              {lang === "中文" ? "继续" : "Continue"}
            </button>
          </div>
        )}

        {step === 4 && (
          <form onSubmit={handleSave} className="space-y-4 panel-swap-up">
            <div className="text-center space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">
                {lang === "中文" ? "最后一步" : "FINAL STEP"}
              </div>
              <h3 className="text-base font-bold text-white">{lang === "中文" ? "设置密码" : "Set Password"}</h3>
              <p className="text-xs text-zinc-400">
                {lang === "中文" ? "用于加密并解锁您的钱包。" : "Encrypt and unlock your wallet."}
              </p>
            </div>
            {error && <div className="rounded-xl bg-red-500/10 border border-red-500/40 p-2.5 text-xs text-red-300">{error}</div>}
            <div className="space-y-2">
              <label className="block text-[11px] text-zinc-400">{lang === "中文" ? "密码" : "Password"}</label>
              <div className="relative">
                <input
                  type={show1 ? "text" : "password"}
                  required
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-zinc-950 text-xs text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShow1((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {show1 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="space-y-1 text-[11px] px-1 pt-0.5">
                {[
                  { k: "len", txt: lang === "中文" ? "8–70 个字符" : "8–70 characters" },
                  { k: "up", txt: lang === "中文" ? "1 个大写字母" : "1 uppercase letter" },
                  { k: "low", txt: lang === "中文" ? "1 个小写字母" : "1 lowercase letter" },
                  { k: "num", txt: lang === "中文" ? "1 个数字" : "1 number" },
                  { k: "sym", txt: lang === "中文" ? "1 个特殊字符 (!@#$...)" : "1 special character (!@#$...)" },
                ].map((r) => (
                  <div key={r.k} className={`flex items-center gap-1.5 ${rules[r.k] ? "text-emerald-400" : "text-zinc-500"}`}>
                    <span>{rules[r.k] ? "✓" : "○"}</span>
                    <span>{r.txt}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] text-zinc-400">{lang === "中文" ? "再输入一次" : "Confirm Password"}</label>
              <div className="relative">
                <input
                  type={show2 ? "text" : "password"}
                  required
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-zinc-950 text-xs text-white focus:outline-none ${
                    mismatch ? "ring-1 ring-red-500" : ""
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShow2((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {show2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mismatch && <p className="text-[11px] text-red-400">{lang === "中文" ? "两次输入不一致" : "Passwords do not match"}</p>}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] hover:brightness-105 disabled:opacity-60 text-[#14110e] font-semibold text-xs flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === "中文" ? `加密中 ${progress}%...` : `Encrypting ${progress}%...`}</span>
                </>
              ) : (
                <span>{lang === "中文" ? "保存密码" : "Save Password"}</span>
              )}
            </button>
          </form>
        )}

        {step === 5 && (
          <div className="py-2 text-center space-y-5 panel-swap-up">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/45 flex items-center justify-center shadow-[0_0_24px_rgba(16,185,129,0.25)] anim-pop-in">
              <Check className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
                {lang === "中文" ? "完成" : "DONE"}
              </div>
              <h3 className="text-lg font-bold text-white">{lang === "中文" ? "已受保护" : "Protected"}</h3>
              <p className="text-xs text-zinc-400">
                {lang === "中文" ? "请妥善保管密码，切勿泄露给任何人。" : "Keep your password safe and never share it."}
              </p>
            </div>
            <button
              type="button"
              onClick={onComplete}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] hover:brightness-105 text-[#14110e] font-semibold text-xs"
            >
              {lang === "中文" ? "完成" : "Done"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function OnboardingTourModal({ open, onClose, onProtect, walletAddress, lang }) {
  const [step, setStep] = useState(1);
  const shortAddr = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "0x83...153F";

  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  if (!open) return null;

  const stepsData = [
    {
      eye: lang === "中文" ? "欢迎" : "WELCOME",
      title: lang === "中文" ? "欢迎使用您的卡片。" : "Welcome to your card.",
      desc: lang === "中文" ? "用 30 秒了解资金如何流转 — 您的钱包，您的卡片，由您掌控。" : "A 30-second tour of how money moves here — your wallet, your card, your control.",
      cta: lang === "中文" ? "开始引导" : "Take the tour",
    },
    {
      eye: lang === "中文" ? "您的钱包" : "YOUR WALLET",
      title: lang === "中文" ? "这个钱包属于你。" : "This wallet is yours.",
      desc: lang === "中文" ? "您的卡片由一个仅您能控制的自托管钱包提供资金，我们从不持有您的私钥或资金。" : "Your card is funded from a self-custody wallet that only you control.",
      cta: lang === "中文" ? "知道了" : "Got it",
    },
    {
      eye: lang === "中文" ? "由您掌控" : "YOU'RE IN CONTROL",
      title: lang === "中文" ? "只有你能动用资金。" : "Only you can move funds.",
      desc: lang === "中文" ? "每笔交易均在您的设备上签名授权，即便是我们也无法动用您的资金。" : "Every transaction is approved on your device. Even we can't touch your money.",
      cta: lang === "中文" ? "继续" : "Continue",
    },
    {
      eye: lang === "中文" ? "充值资金" : "ADD FUNDS",
      title: lang === "中文" ? "充值 USDT，并备少量 BNB。" : "Add USDT, plus a little BNB.",
      desc: lang === "中文" ? "转入 USDT 用于开卡和充值，并保留少量 BNB 支付链上网络手续费。" : "Top up with USDT to buy and load cards — and keep a little BNB for gas.",
      cta: lang === "中文" ? "看看怎么到账" : "Show me",
    },
    {
      eye: lang === "中文" ? "资金已到账" : "FUNDS RECEIVED",
      title: lang === "中文" ? "充值即时到账。" : "Your deposit lands instantly.",
      desc: lang === "中文" ? "转账一经确认，资金立即出现在您的钱包里。" : "The moment your transfer confirms, you'll see it here.",
      cta: lang === "中文" ? "下一步" : "Next",
    },
    {
      eye: lang === "中文" ? "购买卡片" : "GET A CARD",
      title: lang === "中文" ? "购买卡片。" : "Buy a card.",
      desc: lang === "中文" ? "选择卡片，用钱包余额付款，即刻开卡。" : "Pick a card, pay from your wallet, and it's issued in seconds.",
      cta: lang === "中文" ? "下一步" : "Next",
    },
    {
      eye: lang === "中文" ? "卡片充值" : "TOP UP",
      title: lang === "中文" ? "随时充值。" : "Top up anytime.",
      desc: lang === "中文" ? "随时将任意金额的 USDT 转到卡片上，用多少充多少。" : "Move USDT from the same wallet to your card whenever you want.",
      cta: lang === "中文" ? "快好了" : "Almost there",
    },
    {
      eye: lang === "中文" ? "开始使用" : "READY",
      title: lang === "中文" ? "开始消费吧。" : "Start spending.",
      desc: lang === "中文" ? "钱包为卡片充值，卡片则能随处消费。" : "Your wallet powers your card, ready to spend worldwide.",
      cta: lang === "中文" ? "前往主页" : "Go to Dashboard",
    },
  ];

  const cur = stepsData[step - 1];

  const cardMock = (extra, animCls = "anim-card-front") => (
    <div className={`w-64 h-36 mx-auto rounded-2xl glass-card-amber p-4 flex flex-col justify-between text-left relative overflow-hidden ${animCls}`}>
      <div className="absolute inset-0 card-diagonal-sheen" />
      <div className="relative z-10 flex items-center justify-between">
        <span className="text-xs font-bold text-amber-400">VeraCard</span>
        <Wifi className="w-3.5 h-3.5 text-zinc-400 rotate-90" />
      </div>
      <div className="relative z-10 w-7 h-5 rounded border border-amber-400/50 bg-amber-500/15" />
      <div className="relative z-10 flex items-end justify-between">
        <div>
          <div className="font-mono text-xs text-zinc-200 tracking-widest">•••• •••• •••• 4321</div>
          <div className="text-[9px] text-zinc-500 mt-0.5">{lang === "中文" ? "持卡人 您的名字" : "CARD HOLDER YOUR NAME"}</div>
        </div>
        {extra}
      </div>
    </div>
  );

  const miniWalletBar = (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-zinc-900 text-[10px] font-semibold shadow-md">
      <CryptoIcon symbol="BNB" size={14} />
      <span>BNB Chain</span>
      <span className="text-zinc-300 mx-0.5">|</span>
      <span className="font-mono">{shortAddr}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#120e0b]/75 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="spring-modal relative w-full max-w-md rounded-3xl liquid-glass overflow-hidden p-6 space-y-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => step > 1 && setStep(step - 1)}
            className={`text-zinc-400 hover:text-white text-xs w-4 text-left ${step > 1 ? "" : "invisible"}`}
          >
            ←
          </button>
          <div className="flex-1 flex gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${n <= step ? "bg-amber-500" : "bg-zinc-800"}`} />
            ))}
          </div>
          <button type="button" onClick={onClose} className="text-xs text-zinc-400 hover:text-white">
            {lang === "中文" ? "跳过" : "Skip"}
          </button>
        </div>

        <div className="text-[11px] font-mono text-zinc-400">
          {lang === "中文" ? "步骤" : "STEP"} <span className="text-amber-400 font-bold">{step}</span> / 8
        </div>

        <div key={step} className="space-y-4 panel-swap-up">
          <div className="py-1">
            {step === 1 && <div style={{ perspective: "900px" }}>{cardMock(null)}</div>}
            {step === 2 && (
              <div className="space-y-2.5">
                <div className="w-64 mx-auto rounded-xl bg-white text-zinc-900 p-3.5 text-left shadow-xl space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-zinc-500">
                    <span className="font-mono">{shortAddr}</span>
                    <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">BNB Chain</span>
                  </div>
                  <div className="text-lg font-bold font-mono text-zinc-950">$0.00</div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-semibold text-center">
                    <div className="py-1 rounded-lg bg-zinc-100">+ Deposit</div>
                    <div className="py-1 rounded-lg bg-zinc-900 text-white">Send</div>
                  </div>
                </div>
                <span className="inline-block px-3 py-1 rounded-full border border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-300">
                  {lang === "中文" ? "非托管 · 您掌控私钥" : "Non-custodial · You hold the keys"}
                </span>
              </div>
            )}
            {step === 3 && (
              <div className="w-64 mx-auto space-y-2 text-left">
                {[
                  { cls: "anim-stagger-1", txt: lang === "中文" ? "私钥绑定至您的账户" : "Keys secured to your account" },
                  { cls: "anim-stagger-2", txt: lang === "中文" ? "交易在您的设备上签名" : "Approvals signed on your device" },
                  { cls: "anim-stagger-3", txt: lang === "中文" ? "我们无法动用您的资金" : "We can't access your funds" },
                ].map((item) => (
                  <div key={item.txt} className={`${item.cls} px-3 py-2 rounded-xl bg-zinc-950 flex items-center gap-2.5 text-xs text-zinc-200`}>
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" />
                    </span>
                    <span>{item.txt}</span>
                  </div>
                ))}
              </div>
            )}
            {step === 4 && (
              <div className="space-y-2 py-1">
                <div className="flex items-center justify-center gap-4">
                  <div className="px-3 py-1.5 rounded-xl bg-zinc-950 flex items-center gap-1.5 text-xs text-white">
                    <CryptoIcon symbol="USDT" size={16} />
                    <span>USDT</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-zinc-950 flex items-center gap-1.5 text-xs text-white">
                    <CryptoIcon symbol="BNB" size={16} />
                    <span>BNB</span>
                  </div>
                </div>
                <div className="relative h-14 w-64 mx-auto overflow-hidden">
                  {[
                    { sym: "USDT", left: "14%", sz: 18, d: "-0.1s", dur: "1.35s" },
                    { sym: "BNB", left: "30%", sz: 16, d: "-0.75s", dur: "1.45s" },
                    { sym: "USDC", left: "48%", sz: 19, d: "-0.4s", dur: "1.30s" },
                    { sym: "USDT", left: "66%", sz: 18, d: "-0.9s", dur: "1.42s" },
                    { sym: "BNB", left: "82%", sz: 17, d: "-0.25s", dur: "1.38s" },
                  ].map((c, i) => (
                    <div key={i} className="coin-stream-item" style={{ left: c.left, "--delay": c.d, "--dur": c.dur }}>
                      <CryptoIcon symbol={c.sym} size={c.sz} />
                    </div>
                  ))}
                </div>
                <div>{miniWalletBar}</div>
              </div>
            )}
            {step === 5 && (
              <div className="w-64 mx-auto rounded-2xl bg-zinc-950 p-4 space-y-3 relative overflow-hidden">
                <span className="absolute top-2.5 right-3 text-[9px] font-mono uppercase text-zinc-500">EXAMPLE</span>
                <div className="relative w-12 h-12 mx-auto flex items-center justify-center">
                  <span className="absolute inset-0 rounded-full border border-emerald-400/50 anim-ripple" />
                  <div className="relative z-10 w-11 h-11 rounded-full bg-emerald-500/20 border border-emerald-500/55 flex items-center justify-center anim-pop-in">
                    <Check className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>
                <div>
                  <div className="text-xl font-bold font-mono text-emerald-400">+10.00 USDT</div>
                  <div className="text-[11px] font-mono text-zinc-400 mt-0.5">+0.01 BNB</div>
                </div>
              </div>
            )}
            {step === 6 && (
              <div className="space-y-2">
                <div>{miniWalletBar}</div>
                {cardMock(null, "anim-card-appear")}
              </div>
            )}
            {step === 7 && (
              <div className="space-y-2">
                <div>{miniWalletBar}</div>
                {cardMock(<span className="text-emerald-400 font-mono text-xs font-bold">$50.00</span>, "")}
              </div>
            )}
            {step === 8 && (
              <div className="relative py-6 px-2">
                <span className="anim-orbit-1 absolute top-0 left-1 px-2.5 py-1 rounded-full bg-zinc-950 border text-[10px] font-medium flex items-center gap-1">
                  <Utensils className="w-3 h-3" />
                  <span>{lang === "中文" ? "餐饮" : "Dining"}</span>
                </span>
                <span className="anim-orbit-2 absolute top-0 right-1 px-2.5 py-1 rounded-full bg-zinc-950 border text-[10px] font-medium flex items-center gap-1">
                  <Repeat className="w-3 h-3" />
                  <span>{lang === "中文" ? "订阅" : "Subscriptions"}</span>
                </span>
                <span className="anim-orbit-3 absolute bottom-0 left-1 px-2.5 py-1 rounded-full bg-zinc-950 border text-[10px] font-medium flex items-center gap-1">
                  <Plane className="w-3 h-3" />
                  <span>{lang === "中文" ? "交通" : "Travel"}</span>
                </span>
                <span className="anim-orbit-4 absolute bottom-0 right-1 px-2.5 py-1 rounded-full bg-zinc-950 border text-[10px] font-medium flex items-center gap-1">
                  <ShoppingBag className="w-3 h-3" />
                  <span>{lang === "中文" ? "购物" : "Shopping"}</span>
                </span>
                {cardMock(<span className="text-emerald-400 font-mono text-xs font-bold">$50.00</span>)}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">{cur.eye}</div>
            <h3 className="text-base font-bold text-white">{cur.title}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">{cur.desc}</p>
          </div>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => (step < 8 ? setStep(step + 1) : onClose())}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] hover:brightness-105 text-[#14110e] font-semibold text-xs transition"
          >
            {cur.cta}
          </button>
          {step === 8 && onProtect && (
            <button
              type="button"
              onClick={onProtect}
              className="w-full py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs text-amber-300 transition"
            >
              {lang === "中文" ? "立即设置钱包密码保护" : "Protect My Wallet Now"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
