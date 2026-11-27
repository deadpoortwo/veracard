import React, { useEffect, useState } from "react";
import { Smartphone, CreditCard, Plus, Check, Copy, AlertCircle, Upload, Camera } from "lucide-react";
import { BankCardArt, CryptoIcon, UniversalShowcaseCard } from "./BrandMark.jsx";
import { api } from "../api.js";
import { createTranslator } from "../i18n.js";

const PALETTE = ["#18181b", "#d97706", "#7c2d12", "#7f1d1d", "#14532d"];

export function CardsSection({ cards, balance, lang, notify, reload, initialView = "main" }) {
  const t = createTranslator(lang);
  const [view, setView] = useState(initialView); // main | choose | virtual | physical | kyc | details | fees | pay | activate
  const [catalog, setCatalog] = useState([]);
  const [loadingCat, setLoadingCat] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cardType, setCardType] = useState("virtual");
  const [cardName, setCardName] = useState("");
  const [cardColor, setCardColor] = useState(PALETTE[0]);
  const [promo, setPromo] = useState("");
  const [promoMsg, setPromoMsg] = useState("");
  const [payNet, setPayNet] = useState("BNB Chain");
  const [payToken, setPayToken] = useState("USDT");
  const [revealed, setRevealed] = useState({});
  const [actName, setActName] = useState("");
  const [actLast4, setActLast4] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  // Auto-hide revealed card details every second
  useEffect(() => {
    const keys = Object.keys(revealed);
    if (!keys.length) return;
    const iv = setInterval(() => {
      setRevealed((prev) => {
        const next = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v > 1) next[k] = v - 1;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [Object.keys(revealed).length]);

  const openCatalog = async (type) => {
    setCardType(type);
    setView(type);
    setLoadingCat(true);
    try {
      const list = await api.cardCatalog(type);
      setCatalog(list);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setLoadingCat(false);
    }
  };

  const selectSku = async (product) => {
    setSelectedProduct(product);
    setCardName(product.name);
    setPromo("");
    setPromoMsg("");
    try {
      const form = await api.cardForm(product.name);
      setView(form.kind === "identity" ? "kyc" : "details");
    } catch (e) {
      notify(e.message, "error");
    }
  };

  const handleKycSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.submitIdentity({});
      notify(lang === "中文" ? "身份资料已提交审核，继续个性化卡片" : "Identity submitted for review. Personalize your card next.", "info");
      setView("details");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleApplyPromo = async () => {
    if (!promo.trim()) return;
    try {
      await api.applyCardCoupon({ code: promo.trim() });
    } catch (err) {
      setPromoMsg(err.message);
    }
  };

  const handleIssueCard = async () => {
    setBusy(true);
    try {
      await api.createCard({
        name: cardName.trim() || selectedProduct?.name || "VeraCard Virtual",
        type: cardType,
        color: cardColor,
      });
      notify(lang === "中文" ? "演示卡片已创建" : "Card created successfully");
      setView("main");
      reload();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleActivateSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createCard({
        name: actName.trim() || "VeraCard Physical",
        type: "physical",
        last4: actLast4.trim() || "4321",
      });
      notify(lang === "中文" ? "实体卡已激活" : "Physical card activated");
      setView("main");
      reload();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleFreeze = async (card) => {
    try {
      await api.freezeCard(!card.frozen, card.id);
      notify(
        card.frozen
          ? lang === "中文"
            ? `${card.name} 已解冻`
            : `${card.name} unfrozen`
          : lang === "中文"
            ? `${card.name} 已冻结`
            : `${card.name} frozen`,
        "info",
      );
      reload();
    } catch (e) {
      notify(e.message, "error");
    }
  };

  if (view === "choose") {
    return (
      <div className="max-w-2xl mx-auto space-y-6 panel-swap-up">
        <button type="button" onClick={() => setView("main")} className="text-xs text-zinc-400 hover:text-white">
          ← {lang === "中文" ? "返回" : "Back"}
        </button>
        <div className="text-center space-y-1">
          <div className="text-xs text-amber-400 font-mono">1 / 6</div>
          <h1 className="text-xl font-bold text-white">{lang === "中文" ? "需要哪种卡片？" : "Which card do you need?"}</h1>
          <p className="text-xs text-zinc-400">
            {lang === "中文"
              ? "虚拟卡可即时在线使用，实体卡可邮寄到您的地址。"
              : "Virtual cards work online instantly; physical cards ship to your address."}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => openCatalog("virtual")}
            className="float-card rounded-2xl bg-white/[0.06] hover:bg-white/[0.09] p-6 text-left space-y-3 transition"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-white">{lang === "中文" ? "虚拟卡" : "Virtual Card"}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold">
                Available
              </span>
            </div>
            <div className="text-xs text-zinc-400">
              {lang === "中文" ? "立即可用 • 支持 Apple Pay / Google Pay" : "Instant Activation · Apple Pay · Google Pay"}
            </div>
          </button>
          <button
            type="button"
            onClick={() => openCatalog("physical")}
            className="float-card rounded-2xl bg-white/[0.06] hover:bg-white/[0.09] p-6 text-left space-y-3 transition"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-zinc-300" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-white">{lang === "中文" ? "实体卡" : "Physical Card"}</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-semibold">
                Available
              </span>
            </div>
            <div className="text-xs text-zinc-400">
              {lang === "中文" ? "5–7 天邮寄送达 • 全球 ATM & 门店消费" : "Delivered in 5–7 days · Global ATM & In-Store"}
            </div>
          </button>
        </div>
        <button
          type="button"
          onClick={() => setView("activate")}
          className="float-card w-full rounded-2xl bg-white/[0.06] hover:bg-white/[0.09] p-4 flex items-center justify-between text-xs text-zinc-300"
        >
          <span>{lang === "中文" ? "已有实体卡？立即激活" : "Have a physical card already? Activate it"}</span>
          <span className="text-amber-400 font-semibold">→</span>
        </button>
      </div>
    );
  }

  if (["virtual", "physical", "kyc", "details", "fees", "pay"].includes(view)) {
    const stepMap = { virtual: 2, physical: 2, kyc: 2, details: 3, fees: 4, pay: 5 };
    const stepNames = { 2: "Card", 3: "Details", 4: "Fees", 5: "Pay" };
    const curStep = stepMap[view];
    const prevMap = { virtual: "choose", physical: "choose", kyc: cardType, details: cardType, fees: "details", pay: "fees" };

    return (
      <div className="max-w-2xl mx-auto panel-swap-up">
        <div className="flex items-center justify-between mb-6">
          <button type="button" onClick={() => setView(prevMap[view] || "choose")} className="text-xs text-zinc-400 hover:text-white">
            ← {lang === "中文" ? "返回" : "Back"}
          </button>
          <div className="text-center space-y-1.5">
            <div className="text-xs font-mono text-zinc-300">
              <span className="text-amber-400 font-bold">{curStep} / 6</span> · {stepNames[curStep]}
            </div>
            <div className="flex items-center justify-center gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((n) =>
                n === curStep ? (
                  <span key={n} className="w-5 h-1.5 rounded-full bg-amber-500" />
                ) : (
                  <span key={n} className={`w-1.5 h-1.5 rounded-full ${n < curStep ? "bg-amber-500/60" : "bg-zinc-700"}`} />
                ),
              )}
            </div>
          </div>
          <div className="w-12" />
        </div>

        {(view === "virtual" || view === "physical") && (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold text-white">
                {view === "virtual" ? (lang === "中文" ? "选择虚拟卡" : "Virtual Cards") : lang === "中文" ? "选择实体卡" : "Physical Cards"}
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                {view === "virtual"
                  ? lang === "中文"
                    ? "即时发卡 · 几分钟内可用"
                    : "Instant digital cards · Ready in minutes"
                  : lang === "中文"
                    ? "直接邮寄至您的地址"
                    : "Shipped directly to your address"}
              </p>
            </div>
            {loadingCat ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-24 rounded-2xl bg-white/[0.06] animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {catalog.map((tier, idx) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => selectSku(tier)}
                    className="float-card w-full rounded-2xl bg-white/[0.06] hover:bg-white/[0.09] p-4 flex items-center justify-between gap-4 text-left transition"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <BankCardArt styleIdx={idx} isVirtual={view === "virtual"} label={tier.name} compact />
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-semibold">
                            {lang === "中文" ? tier.tagZh : tier.tag}
                          </span>
                          <span className="text-sm font-bold text-white truncate">{tier.name}</span>
                        </div>
                        <div className="text-xs text-zinc-400 truncate">
                          Issuance ${tier.fee.toFixed(2)} · <span className="text-emerald-400">Network Free</span> ·{" "}
                          {lang === "中文" ? tier.descZh : tier.desc}
                        </div>
                      </div>
                    </div>
                    <span className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#f3dfb8] to-[#d4a96a] text-[#14110e] text-xs font-semibold shrink-0">
                      {lang === "中文" ? "选择 →" : "Select →"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "kyc" && (
          <div className="rounded-3xl liquid-glass p-6 space-y-5">
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/35 p-3.5 text-xs text-amber-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">{lang === "中文" ? "身份审核说明" : "Identity Verification Notice"}</div>
                <div className="text-[11px] text-amber-200/80 mt-0.5">
                  {lang === "中文"
                    ? "本地演示模式下不会上传或保存您的证件信息，提交后可直接进入下一步。"
                    : "In local mode, no identity documents are uploaded or stored. Submit to preview the next step."}
                </div>
              </div>
            </div>
            <form onSubmit={handleKycSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">{lang === "中文" ? "名字 *" : "First Name *"}</label>
                  <input type="text" required placeholder="John" className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 text-white focus:outline-none" />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">{lang === "中文" ? "姓氏 *" : "Last Name *"}</label>
                  <input type="text" required placeholder="Doe" className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 text-white focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">{lang === "中文" ? "手机号码 *" : "Phone Number *"}</label>
                  <input type="tel" required placeholder="+1 5551234567" className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 text-white focus:outline-none" />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">{lang === "中文" ? "出生日期 *" : "Date of Birth *"}</label>
                  <input type="date" required className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 text-zinc-200 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-950 text-center space-y-1">
                  <Upload className="w-4 h-4 text-amber-400 mx-auto" />
                  <div className="text-zinc-200 font-medium">{lang === "中文" ? "护照 / 证件" : "Passport / ID"}</div>
                </div>
                <div className="p-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-950 text-center space-y-1">
                  <Camera className="w-4 h-4 text-amber-400 mx-auto" />
                  <div className="text-zinc-200 font-medium">{lang === "中文" ? "手持自拍" : "Selfie Check"}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="py-2.5 rounded-xl magnetic-btn bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] text-[#14110e] font-semibold"
                >
                  {lang === "中文" ? "提交审核" : "Submit for Review"}
                </button>
                <button type="button" onClick={() => setView("choose")} className="py-2.5 rounded-xl bg-white/[0.06] text-zinc-300">
                  {lang === "中文" ? "取消" : "Cancel"}
                </button>
              </div>
            </form>
          </div>
        )}

        {view === "details" && (
          <div className="max-w-xl mx-auto rounded-3xl liquid-glass p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">{lang === "中文" ? "个性化您的卡片" : "Personalize Your Card"}</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {lang === "中文" ? "为卡片起个名字并选择颜色。" : "Give your card a nickname and pick a finish."}
              </p>
            </div>
            <div>
              <label className="block text-[11px] text-zinc-400 mb-1.5">{lang === "中文" ? "卡片名称" : "CARD NAME"}</label>
              <input
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder={lang === "中文" ? "例如：我的旅行卡" : "e.g. My Travel Card"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 text-sm text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-zinc-400 mb-2">{lang === "中文" ? "卡片颜色" : "CARD COLOR"}</label>
              <div className="flex gap-3">
                {PALETTE.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setCardColor(col)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform hover:scale-105 ${
                      cardColor === col ? "ring-2 ring-amber-400 scale-105" : "opacity-75"
                    }`}
                    style={{ background: col }}
                  >
                    {cardColor === col && <Check className="w-4 h-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-[11px] text-zinc-500">{lang === "中文" ? "实时预览" : "LIVE PREVIEW"}</div>
              <BankCardArt
                styleIdx={Math.max(0, PALETTE.indexOf(cardColor))}
                isVirtual={cardType === "virtual"}
                label={cardName || selectedProduct?.name}
              />
            </div>
            <button
              type="button"
              onClick={() => setView("fees")}
              className="w-full py-2.5 rounded-xl magnetic-btn bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] text-[#14110e] font-semibold text-xs"
            >
              {lang === "中文" ? "保存并继续" : "Save & Continue"}
            </button>
          </div>
        )}

        {view === "fees" && (
          <div className="max-w-xl mx-auto rounded-3xl liquid-glass p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">{lang === "中文" ? "功能与费用" : "Review Limits & Fees"}</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {lang === "中文" ? "查看您卡片的消费限额与透明费率。" : "Transparent spending limits and fees — no hidden charges."}
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-950/70 p-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/[0.06]">
                  <div className="text-[10px] text-zinc-500">{lang === "中文" ? "发卡费" : "ISSUANCE"}</div>
                  <div className="text-base font-bold font-mono text-amber-400 mt-0.5">
                    ${(selectedProduct?.fee ?? 2).toFixed(2)} <span className="text-[10px] text-zinc-400">USDT</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.06]">
                  <div className="text-[10px] text-zinc-500">{lang === "中文" ? "开卡余额" : "OPENING BAL."}</div>
                  <div className="text-base font-bold font-mono text-white mt-0.5">$0</div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
                {[
                  { k: lang === "中文" ? "日限" : "Daily", v: selectedProduct?.limits?.daily || "$250,000" },
                  { k: lang === "中文" ? "月限" : "Monthly", v: selectedProduct?.limits?.monthly || "$1,000,000" },
                  { k: lang === "中文" ? "单笔" : "Single Tx", v: selectedProduct?.limits?.single || "$20,000" },
                  { k: lang === "中文" ? "充值费率" : "Top-Up Fee", v: selectedProduct?.limits?.topup || "0%", green: true },
                  { k: lang === "中文" ? "汇率差" : "FX Markup", v: selectedProduct?.limits?.fx || "1.5%" },
                  { k: lang === "中文" ? "交易费" : "Tx Fee", v: selectedProduct?.limits?.tx || "$0.25 + 1.5%" },
                ].map((item) => (
                  <div key={item.k} className="p-2.5 rounded-lg bg-white/[0.06]">
                    <div className="text-zinc-500">{item.k}</div>
                    <div className={`font-mono font-bold mt-0.5 ${item.green ? "text-emerald-400" : "text-white"}`}>{item.v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promo}
                  onChange={(e) => {
                    setPromo(e.target.value);
                    setPromoMsg("");
                  }}
                  placeholder={lang === "中文" ? "输入优惠码..." : "PROMO CODE..."}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-zinc-950 text-xs font-mono text-white uppercase focus:outline-none"
                />
                <button type="button" onClick={handleApplyPromo} className="px-4 py-2.5 rounded-xl bg-white/[0.08] text-xs text-zinc-200 hover:text-amber-300">
                  {lang === "中文" ? "应用" : "Apply"}
                </button>
              </div>
              {promoMsg && <div className="text-[11px] text-red-400">{promoMsg}</div>}
            </div>
            <button
              type="button"
              onClick={() => setView("pay")}
              className="w-full py-2.5 rounded-xl magnetic-btn bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] text-[#14110e] font-semibold text-xs"
            >
              {lang === "中文" ? "同意并前往支付" : "Accept & Continue to Payment"}
            </button>
          </div>
        )}

        {view === "pay" && (
          <div className="max-w-xl mx-auto rounded-3xl liquid-glass p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
              <div>
                <div className="text-sm font-bold text-white">{cardName || selectedProduct?.name}</div>
                <div className="text-[11px] text-zinc-400">{cardType === "virtual" ? "Virtual" : "Physical"}</div>
              </div>
              <div className="text-right font-mono">
                <div className="text-sm font-bold text-amber-400">${(selectedProduct?.fee ?? 2).toFixed(2)} USDT</div>
                <div className="text-[10px] text-zinc-500">{lang === "中文" ? "发卡费" : "Issuance"}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {["BNB Chain", "Ethereum"].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPayNet(n)}
                  className={`p-2.5 rounded-xl flex items-center gap-2 transition ${
                    payNet === n ? "bg-amber-500/15 text-amber-300 font-semibold" : "bg-zinc-950 text-zinc-400"
                  }`}
                >
                  <CryptoIcon symbol={n} size={18} />
                  <span>{n}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {["USDT", "USDC"].map((tk) => (
                <button
                  key={tk}
                  type="button"
                  onClick={() => setPayToken(tk)}
                  className={`p-2.5 rounded-xl flex items-center gap-2 transition ${
                    payToken === tk ? "bg-amber-500/15 text-amber-300 font-semibold" : "bg-zinc-950 text-zinc-400"
                  }`}
                >
                  <CryptoIcon symbol={tk} size={18} />
                  <span>{tk}</span>
                </button>
              ))}
            </div>
            <div className="rounded-xl p-3 bg-white/[0.05] text-xs text-zinc-300">
              {lang === "中文" ? "当前链上 USDT 余额：" : "Live on-chain USDT balance: "}
              <span className="font-mono text-amber-300">{balance != null ? `${Number(balance).toFixed(4)} USDT` : "—"}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={handleIssueCard}
                className="py-2.5 rounded-xl magnetic-btn bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] text-[#14110e] font-semibold text-xs"
              >
                {lang === "中文" ? "确认创建演示卡" : "Create Demo Card"}
              </button>
              <button type="button" onClick={() => setView("main")} className="py-2.5 rounded-xl bg-white/[0.06] text-zinc-300 text-xs">
                {lang === "中文" ? "取消" : "Cancel"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === "activate") {
    return (
      <div className="max-w-lg mx-auto space-y-5 panel-swap-up">
        <button type="button" onClick={() => setView("main")} className="text-xs text-zinc-400 hover:text-white">
          ← {lang === "中文" ? "返回" : "Back"}
        </button>
        <div className="rounded-3xl liquid-glass p-6 space-y-4">
          <h1 className="text-lg font-bold text-white">{lang === "中文" ? "激活实体卡" : "Activate Your Physical Card"}</h1>
          <form onSubmit={handleActivateSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">{lang === "中文" ? "卡片昵称" : "Card Nickname"}</label>
              <input
                type="text"
                value={actName}
                onChange={(e) => setActName(e.target.value)}
                placeholder="e.g. Travel Metal Card"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 text-sm text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">{lang === "中文" ? "卡号后 4 位" : "Last 4 Digits"}</label>
              <input
                type="text"
                maxLength={4}
                required
                value={actLast4}
                onChange={(e) => setActLast4(e.target.value.replace(/\D/g, ""))}
                placeholder="4321"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 font-mono text-sm text-white focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-xl magnetic-btn bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] text-[#14110e] font-semibold text-sm"
            >
              {lang === "中文" ? "激活卡片" : "Activate Card"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 panel-swap-up">
      {cards.length === 0 ? (
        <div className="min-h-[68vh] flex flex-col items-center justify-center text-center space-y-6 py-8">
          <div className="relative w-80 h-48 transition-transform duration-300 ease-out hover:-translate-y-1.5" style={{ perspective: "1000px" }}>
            <div className="pointer-events-none absolute right-0 top-2.5 w-[90%] h-44 rounded-[22px] bg-gradient-to-br from-[#3f3224]/80 via-[#251e18]/75 to-[#4c3a27]/80 backdrop-blur-md shadow-[0_18px_42px_rgba(0,0,0,0.48)] opacity-75 anim-card-back" />
            <div className="relative z-10 w-full h-full anim-card-front">
              <UniversalShowcaseCard lang={lang} compact />
            </div>
          </div>
          <div className="space-y-2 max-w-md">
            <h1 className="text-2xl font-bold text-white">{lang === "中文" ? "申请您的第一张卡" : "Get Your First Card"}</h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {lang === "中文"
                ? "5 步免费开通虚拟卡，支持 Apple Pay、Google Pay 与全球 Visa 商户消费。"
                : "Free virtual card in 5 steps. Works with Apple Pay, Google Pay, and anywhere Visa is accepted."}
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setView("choose")}
              className="px-6 py-2.5 rounded-xl magnetic-btn bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] hover:brightness-105 text-[#14110e] font-semibold text-xs shadow-[0_0_20px_rgba(245,158,11,0.28)]"
            >
              {lang === "中文" ? "申请我的第一张卡" : "Order My First Card"}
            </button>
            <button type="button" onClick={() => setView("activate")} className="text-xs text-amber-400 hover:text-amber-300">
              {lang === "中文" ? "已有实体卡？去激活 →" : "Have a physical card already? Activate it →"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">{t("navMyCards")}</h1>
            <button
              type="button"
              onClick={() => setView("choose")}
              className="px-4 py-2 rounded-xl magnetic-btn bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] text-[#14110e] font-semibold text-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{t("applyCard")}</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cards.map((card) => {
              const isRevealed = Boolean(revealed[card.id]);
              return (
                <div key={card.id} className="float-card rounded-3xl liquid-glass p-5 space-y-4">
                  <div className={`relative rounded-2xl ${card.frozen ? "glass-card-frozen" : "glass-card-amber"} p-5 min-h-[180px] flex flex-col justify-between overflow-hidden`}>
                    <div className="absolute inset-0 card-diagonal-sheen" />
                    {card.frozen && (
                      <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-amber-500/20 text-[10px] text-amber-200 font-semibold">
                        FROZEN
                      </span>
                    )}
                    <div className="relative z-10 flex items-center justify-between text-xs text-zinc-200">
                      <span>
                        {card.name} ({card.type === "virtual" ? "Virtual" : "Physical"})
                      </span>
                      {isRevealed && <span className="font-mono text-amber-400">{revealed[card.id]}s</span>}
                    </div>
                    <div className="relative z-10 flex items-center gap-2 my-3">
                      <span className="font-mono text-base tracking-[0.16em] text-white">
                        {isRevealed ? card.pan : `•••• •••• •••• ${card.last4}`}
                      </span>
                      {isRevealed && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(card.pan.replace(/\s+/g, ""));
                            notify("PAN copied", "info");
                          }}
                          className="text-zinc-400 hover:text-amber-400"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="relative z-10 flex items-end justify-between text-xs">
                      <div className="flex gap-5">
                        <div>
                          <div className="text-[10px] text-zinc-500">EXP</div>
                          <div className="font-mono text-zinc-200">{isRevealed ? card.expiry : "••/••"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-500">CVV</div>
                          <div className="font-mono text-zinc-200">{isRevealed ? card.cvv : "•••"}</div>
                        </div>
                      </div>
                      <div className="font-mono text-amber-400 font-semibold">${Number(card.balance || 0).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setRevealed((prev) =>
                          prev[card.id]
                            ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== card.id))
                            : { ...prev, [card.id]: 10 },
                        )
                      }
                      className="py-2 rounded-xl bg-zinc-950 hover:bg-zinc-900 text-xs text-zinc-200 transition"
                    >
                      {isRevealed ? t("hide") : t("reveal")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleFreeze(card)}
                      className={`py-2 rounded-xl text-xs transition ${
                        card.frozen ? "bg-amber-500/20 text-amber-200" : "bg-zinc-950 text-zinc-200 hover:bg-zinc-900"
                      }`}
                    >
                      {card.frozen ? t("unfreeze") : t("freeze")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
