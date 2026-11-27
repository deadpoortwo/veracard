import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

export function BrandVMark({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <defs>
        <linearGradient id="vcGoldLeft" x1="4" y1="4" x2="18" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbf0d6" />
          <stop offset="52%" stopColor="#e4c082" />
          <stop offset="100%" stopColor="#b8843b" />
        </linearGradient>
        <linearGradient id="vcGoldRight" x1="28" y1="5" x2="15" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f3dfb8" />
          <stop offset="55%" stopColor="#c9954c" />
          <stop offset="100%" stopColor="#7c5320" />
        </linearGradient>
      </defs>
      <path d="M5.2 6.5L13.6 25.5C14.1 26.6 15.1 27.1 16 27.1L18.4 21.8L11.8 6.5H5.2Z" fill="url(#vcGoldLeft)" />
      <path d="M26.8 6.5L18.4 25.5C17.9 26.6 16.9 27.1 16 27.1L14.2 23.0L20.4 6.5H26.8Z" fill="url(#vcGoldRight)" />
      <path d="M16 14.2L18.3 9.2H13.7L16 14.2Z" fill="#fbf0d6" fillOpacity="0.88" />
    </svg>
  );
}

export function BrandLogo({ small = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`${
          small ? "w-8 h-8" : "w-9 h-9"
        } rounded-xl bg-gradient-to-br from-[#2d241b] via-[#1c1611] to-[#120e0b] flex items-center justify-center shadow-[0_6px_18px_rgba(0,0,0,0.45)] shrink-0`}
      >
        <BrandVMark size={small ? 18 : 21} />
      </div>
      <span className={`sb-brand-wordmark text-white font-semibold ${small ? "text-base" : "text-lg"} tracking-tight`}>
        VeraCard
      </span>
    </div>
  );
}

export function UniversalShowcaseCard({ lang = "EN", compact = false }) {
  const statusTxt = lang === "中文" ? "多币种即时入账 · 全球消费" : "Multi-currency · Global Spend";
  const titleTxt = lang === "中文" ? "VeraCard 环球卡" : "VeraCard Universal";
  return (
    <div className={`vc-universal-card ${compact ? "p-4" : ""}`}>
      <div className="absolute inset-0 card-diagonal-sheen pointer-events-none" />
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <div className={`${compact ? "text-base" : "text-lg"} font-extrabold tracking-[0.1em] text-[#fbf0d6]`}>
            VeraCard
          </div>
          <div className="text-[8px] tracking-[0.22em] text-amber-200/55 mt-0.5 uppercase">UNIVERSAL PAYMENT</div>
        </div>
        <div className="text-amber-200/75 text-lg font-semibold leading-none select-none rotate-90">)))</div>
      </div>
      <div className={`relative z-10 ${compact ? "my-1.5" : "my-2"}`}>
        <div className="vc-emv-chip" />
      </div>
      <div className="relative z-10 space-y-2">
        <div className={`font-mono ${compact ? "text-xs" : "text-sm"} text-amber-50/90 tracking-[0.2em]`}>
          •••• &nbsp; •••• &nbsp; •••• &nbsp; 2048
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className={`${compact ? "text-[11px]" : "text-xs"} font-semibold tracking-wider text-white/95`}>
              {titleTxt}
            </div>
            <div className="text-[9px] text-amber-200/55 mt-0.5">{statusTxt}</div>
          </div>
          <div className={`${compact ? "text-lg" : "text-xl"} font-extrabold italic tracking-tighter text-[#fbf0d6]`}>
            VISA
          </div>
        </div>
      </div>
    </div>
  );
}

const CARD_THEMES = [
  { bg: "linear-gradient(135deg, #18181b 0%, #27272a 48%, #09090b 100%)", chip: "#d4af37", badge: "INFINITE", brand: "VISA" },
  { bg: "linear-gradient(135deg, #78350f 0%, #d97706 50%, #451a03 100%)", chip: "#fef08a", badge: "METAL VIP", brand: "MC" },
  { bg: "linear-gradient(135deg, #431407 0%, #9a3412 50%, #270c04 100%)", chip: "#e4c082", badge: "SIGNATURE", brand: "VISA" },
  { bg: "linear-gradient(135deg, #450a0a 0%, #991b1b 50%, #2a0606 100%)", chip: "#faecd2", badge: "PRIVATE", brand: "VISA" },
  { bg: "linear-gradient(135deg, #064e3b 0%, #059669 52%, #022c22 100%)", chip: "#e2e8f0", badge: "PLATINUM", brand: "MC" },
];

export function BankCardArt({ styleIdx = 0, isVirtual = true, label = "VeraCard Private", compact = false }) {
  const th = CARD_THEMES[Math.abs(styleIdx) % CARD_THEMES.length];
  const chipSvg = (
    <svg width={compact ? 20 : 30} height={compact ? 14 : 22} viewBox="0 0 32 24" fill="none">
      <rect x="0.5" y="0.5" width="31" height="23" rx="4" fill={th.chip} fillOpacity="0.25" stroke={th.chip} strokeOpacity="0.8" />
      <path
        d="M10 1V23M22 1V23M1 8.5H10M22 8.5H31M1 15.5H10M22 15.5H31M10 12H22"
        stroke={th.chip}
        strokeOpacity="0.7"
        strokeWidth="1"
      />
    </svg>
  );
  const waveSvg = (
    <svg width={compact ? 12 : 16} height={compact ? 12 : 16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round">
      <path d="M8.5 16.5a5 5 0 0 1 0-9" />
      <path d="M12 19a8.5 8.5 0 0 1 0-14" />
      <path d="M15.5 21.5a12 12 0 0 1 0-19" />
    </svg>
  );
  const emblem =
    th.brand === "VISA" ? (
      <span className={`font-extrabold italic tracking-tighter ${compact ? "text-[9px]" : "text-sm"} text-white/90`}>
        VISA
      </span>
    ) : (
      <div className="flex items-center">
        <span className={`${compact ? "w-3 h-3" : "w-5 h-5"} rounded-full bg-red-500/90`} />
        <span className={`${compact ? "w-3 h-3 -ml-1" : "w-5 h-5 -ml-2"} rounded-full bg-amber-400/90 mix-blend-screen`} />
      </div>
    );

  if (compact) {
    return (
      <div
        className="w-24 h-14 rounded-xl p-2 flex flex-col justify-between relative overflow-hidden shrink-0 shadow-lg"
        style={{ background: th.bg }}
      >
        <div className="absolute inset-0 card-diagonal-sheen" />
        <div className="relative z-10 flex items-center justify-between">
          {chipSvg}
          {waveSvg}
        </div>
        <div className="relative z-10 flex items-end justify-between">
          <span className="text-[7px] font-mono tracking-wider text-white/80">•••• 8842</span>
          {emblem}
        </div>
      </div>
    );
  }

  return (
    <div
      className="max-w-xs mx-auto rounded-2xl p-5 min-h-[178px] flex flex-col justify-between relative overflow-hidden shadow-2xl transition-all duration-500"
      style={{ background: th.bg }}
    >
      <div className="absolute inset-0 card-diagonal-sheen" />
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-tight text-white">VeraCard</span>
          <span className="px-1.5 py-0.5 rounded bg-white/15 text-[8px] font-mono tracking-widest text-white/90">
            {th.badge}
          </span>
        </div>
        {waveSvg}
      </div>
      <div className="relative z-10 flex items-center gap-3 my-1">
        {chipSvg}
        <span className="text-[9px] uppercase tracking-widest text-white/50">{isVirtual ? "Virtual" : "Physical"}</span>
      </div>
      <div className="relative z-10 space-y-1">
        <div className="font-mono text-xs text-white/90 tracking-[0.2em]">4532 •••• •••• 8842</div>
        <div className="flex items-end justify-between">
          <div className="text-xs font-semibold text-white truncate max-w-[160px]">{label || "VeraCard Private"}</div>
          {emblem}
        </div>
      </div>
    </div>
  );
}

const CRYPTO_ICON_MAP = {
  "BNB Chain": "bnb",
  BNB: "bnb",
  Ethereum: "eth",
  ETH: "eth",
  BTC: "btc",
  Bitcoin: "btc",
  TRON: "trx",
  USDT: "usdt",
  USDC: "usdc",
  SOL: "sol",
  Polygon: "matic",
  POLYGON: "matic",
};

export function CryptoIcon({ symbol, size = 18 }) {
  const sym = CRYPTO_ICON_MAP[symbol] || "usdt";
  const url = `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${sym}.svg`;
  return (
    <img
      src={url}
      alt={symbol}
      width={size}
      height={size}
      className="inline-block shrink-0 rounded-full object-contain"
      style={{ width: size, height: size }}
    />
  );
}

export function WalletQR({ value, size = 112 }) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    let active = true;
    const text = value || "veracard";
    QRCode.toDataURL(text, {
      width: size * 2,
      margin: 1,
      color: { dark: "#09090b", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return <div style={{ width: size, height: size }} className="bg-zinc-200 rounded-lg animate-pulse" />;
  }
  return <img src={dataUrl} alt="QR Code" width={size} height={size} className="block rounded-lg" />;
}
