import React, { useEffect, useRef, useState } from "react";
import {
  Home,
  Activity,
  CreditCard,
  Wallet,
  Download,
  History,
  Share2,
  Settings,
  PlayCircle,
  Send,
  Twitter,
  Mail,
  LogOut,
  ChevronsLeft,
  Menu,
  X,
  ChevronDown,
  MoreVertical,
  Info,
  Plus,
  Search,
  Clock,
  RefreshCw,
  Star,
  Check,
} from "lucide-react";
import { AmbientStage } from "./components/AmbientStage.jsx";
import { BrandLogo, CryptoIcon, WalletQR } from "./components/BrandMark.jsx";
import { Modal, Skeleton, ToastBanner } from "./components/UiPrimitives.jsx";
import { OnboardingTourModal, WalletProtectionModal, WalletReminder } from "./components/OnboardingModal.jsx";
import { CardsSection } from "./components/CardsSection.jsx";
import { WalletSection } from "./components/WalletSection.jsx";
import { SettingsSection } from "./components/SettingsSection.jsx";
import { usePageData } from "./usePageData.js";
import { restoreSession, signOut, completeTour } from "./authStore.js";
import { createTranslator } from "./i18n.js";

const VALID_PAGES = ["dashboard", "activities", "cards", "wallet", "deposit", "history", "referral", "settings"];

const BASE_PREFIX = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

const SUPPORTED_NETWORKS = [
  { id: "BNB Chain", sub: "BEP-20 · USDT", color: "text-amber-400", chainKey: "EVM", unit: "USDT" },
  { id: "Ethereum", sub: "ERC-20 · USDT", color: "text-indigo-400", chainKey: "EVM", unit: "USDT" },
  { id: "Solana", sub: "SPL · SOL / USDT", color: "text-emerald-400", chainKey: "SOL", unit: "SOL" },
  { id: "Bitcoin", sub: "NATIVE BTC", color: "text-orange-400", chainKey: "BTC", unit: "BTC" },
  { id: "TRON", sub: "TRC-20 · USDT", color: "text-red-400", chainKey: "TRON", unit: "TRX" },
];

function addressForNetwork(wallet, netId) {
  if (!wallet) return "";
  const cfg = SUPPORTED_NETWORKS.find((n) => n.id === netId);
  const key = cfg?.chainKey || "EVM";
  if (key === "EVM") return wallet.addresses?.EVM || wallet.address || "";
  return wallet.addresses?.[key] || "";
}

function resolvePageFromPath() {
  const stripped = BASE_PREFIX && location.pathname.startsWith(BASE_PREFIX)
    ? location.pathname.slice(BASE_PREFIX.length)
    : location.pathname;
  const seg = stripped.split("/")[1] || "";
  return VALID_PAGES.includes(seg) ? seg : "dashboard";
}

export function App({ lang, onChangeLang }) {
  const t = createTranslator(lang);
  const account = restoreSession();
  const [page, setPage] = useState(resolvePageFromPath);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [network, setNetwork] = useState("BNB Chain");
  const [chainMenuOpen, setChainMenuOpen] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);

  // Activity & Deposit filters
  const [actType, setActType] = useState("all");
  const [actPeriod, setActPeriod] = useState("All time");
  const [actSearch, setActSearch] = useState("");
  const [depositTab, setDepositTab] = useState("receive");
  const [payoutNet, setPayoutNet] = useState("BSC");
  const [cardInitialView, setCardInitialView] = useState("main");

  // Modals & Toast
  const [tourOpen, setTourOpen] = useState(() => !account?.wallet?.tourCompleted);
  const [protectOpen, setProtectOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [gasModalOpen, setGasModalOpen] = useState(false);
  const [signOutModalOpen, setSignOutModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const chainWrapRef = useRef(null);

  const resource = usePageData(page, { network, filter: actType, period: actPeriod, search: actSearch });
  const data = resource.data;

  const notify = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast((cur) => (cur?.message === message ? null : cur)), 2800);
  };

  const nav = (target, opts = {}) => {
    setPage(target);
    setCardInitialView(opts.cardView || "main");
    setMobileSidebar(false);
    const nextPath = opts.cardView === "choose" ? `${BASE_PREFIX}/cards/new` : `${BASE_PREFIX}/${target}`;
    if (location.pathname !== nextPath) history.pushState({}, "", nextPath);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const onPop = () => setPage(resolvePageFromPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const top = window.scrollY || document.documentElement.scrollTop || 0;
      const docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      setScrollPct(Math.min(100, (top / docH) * 100));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!chainMenuOpen) return;
    const onDoc = (e) => {
      if (chainWrapRef.current && !chainWrapRef.current.contains(e.target)) setChainMenuOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [chainMenuOpen]);

  const activeAddr = addressForNetwork(account?.wallet, network);
  const addr = activeAddr || account?.wallet?.address || "—";
  const shortAddr = addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
  const copy = (text, label = "Copied") => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => notify(`${label} ${lang === "中文" ? "已复制" : "copied"}`, "info"))
      .catch(() => notify("Copy unavailable", "error"));
  };

  const handleCloseTour = () => {
    setTourOpen(false);
    if (!account?.wallet?.tourCompleted) {
      completeTour().catch((e) => notify(e.message, "error"));
    }
  };

  const handleSignOut = async () => {
    setSignOutModalOpen(false);
    try {
      await signOut();
    } catch (e) {
      notify(e.message, "error");
    }
  };

  const renderSideBtn = (id, IconComp, label) => {
    const active = page === id;
    return (
      <button
        key={id}
        type="button"
        title={label}
        onClick={() => nav(id)}
        className={`nav-glass-item group relative w-full px-3 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between ${
          active ? "is-active" : "text-zinc-300/85"
        }`}
      >
        <span className="flex items-center gap-2.5">
          <span
            className={`sb-icon-badge w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
              active
                ? "bg-amber-400/25 text-amber-300"
                : "bg-white/[0.05] text-zinc-400 group-hover:text-amber-300 group-hover:bg-white/[0.12]"
            }`}
          >
            <IconComp className="w-3.5 h-3.5" />
          </span>
          <span className="sb-nav-label">{label}</span>
        </span>
        {active && <span className="sb-nav-dot w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_#e4c082]" />}
      </button>
    );
  };

  return (
    <div className="min-h-screen flex bg-transparent relative">
      <AmbientStage />

      {/* Scroll Narrative Bar */}
      <div
        className="fixed top-0 left-0 h-[2px] bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500 z-50 transition-all duration-150"
        style={{ width: `${scrollPct}%` }}
      />

      {/* Mobile backdrop */}
      {mobileSidebar && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileSidebar(false)} />
      )}

      {/* VisionOS Collapsible Floating Pill Sidebar */}
      <aside
        id="app-sidebar"
        className={`${
          mobileSidebar
            ? "fixed inset-y-2 left-2 z-40 flex h-[calc(100vh-16px)]"
            : "hidden lg:flex lg:sticky lg:top-3 lg:my-3 lg:ml-3 h-[calc(100vh-24px)]"
        } ${
          sidebarCollapsed ? "is-collapsed" : ""
        } shrink-0 flex-col bg-white/[0.06] backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.48)] px-3 py-4 overflow-hidden z-20`}
      >
        <div className="sb-header-row px-2 pb-3 shrink-0 flex items-center justify-between gap-2">
          <BrandLogo small />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              title={lang === "中文" ? "展开 / 收起菜单" : "Collapse / Expand menu"}
              className="hidden lg:flex w-7 h-7 rounded-full bg-white/[0.07] hover:bg-white/[0.15] text-zinc-400 hover:text-amber-300 items-center justify-center transition"
            >
              <ChevronsLeft className="sb-collapse-icon w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => setMobileSidebar(false)} className="lg:hidden text-zinc-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-4 px-1.5 -mx-1.5 py-1">
          <div className="space-y-1">
            {renderSideBtn("dashboard", Home, t("navHome"))}
            {renderSideBtn("activities", Activity, t("navActivity"))}
          </div>

          <div className="space-y-1 pt-1">
            <div className="sb-hide-collapsed px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
              {t("secCards")}
            </div>
            {renderSideBtn("cards", CreditCard, t("navMyCards"))}
          </div>

          <div className="space-y-1 pt-1">
            <div className="sb-hide-collapsed px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
              {t("secFunds")}
            </div>
            {renderSideBtn("wallet", Wallet, t("navLocalWallet"))}
            {renderSideBtn("deposit", Download, t("navDeposit"))}
            {renderSideBtn("history", History, t("navTx"))}
          </div>

          <div className="space-y-1 pt-1">
            <div className="sb-hide-collapsed px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
              {t("secAccount")}
            </div>
            {renderSideBtn("referral", Share2, t("navReferral"))}
            {renderSideBtn("settings", Settings, t("navSettings"))}
          </div>

          <div className="pt-2 border-t border-white/[0.06] pb-2">
            <button
              type="button"
              onClick={() => setTourOpen(true)}
              className="sb-icon-only w-full px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 flex items-center gap-2.5 transition"
            >
              <PlayCircle className="w-4 h-4 shrink-0" />
              <span className="sb-hide-collapsed">{t("watchTutorial")}</span>
            </button>
          </div>
        </div>

        {/* Pinned Bottom */}
        <div className="shrink-0 pt-3 border-t border-white/[0.07] space-y-3">
          <div className="sb-hide-collapsed space-y-2 px-1 text-[11px] text-zinc-400">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{t("secSupport")}</div>
            <a href="https://t.me/veracardsupport" target="_blank" rel="noreferrer" className="flex items-center gap-2.5 hover:text-zinc-200">
              <span className="w-6 h-6 rounded-md bg-zinc-900 flex items-center justify-center"><Send className="w-3 h-3 text-zinc-400" /></span>
              <span>@veracardsupport</span>
            </a>
            <a href="https://x.com/veracardteam" target="_blank" rel="noreferrer" className="flex items-center gap-2.5 hover:text-zinc-200">
              <span className="w-6 h-6 rounded-md bg-zinc-900 flex items-center justify-center"><Twitter className="w-3 h-3 text-zinc-400" /></span>
              <span>@veracardteam</span>
            </a>
            <a href="mailto:support@veracard.io" className="flex items-center gap-2.5 hover:text-zinc-200">
              <span className="w-6 h-6 rounded-md bg-zinc-900 flex items-center justify-center"><Mail className="w-3 h-3 text-zinc-400" /></span>
              <span>support@veracard.io</span>
            </a>
          </div>
          <div className="pt-2 border-t border-white/[0.06] space-y-2">
            {sidebarCollapsed ? (
              <button
                type="button"
                onClick={() => onChangeLang(lang === "EN" ? "中文" : "EN")}
                className="w-10 h-10 mx-auto rounded-full bg-white/[0.08] hover:bg-amber-400/20 text-[11px] font-semibold text-amber-300 flex items-center justify-center"
              >
                {lang === "中文" ? "中" : "EN"}
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {["EN", "中文"].map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => onChangeLang(code)}
                    className={`py-2 rounded-xl text-xs font-medium transition ${
                      lang === code
                        ? "bg-gradient-to-r from-[#f3dfb8] to-[#d4a96a] text-[#14110e] font-semibold"
                        : "bg-[#141418] text-zinc-400 hover:text-white"
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setSignOutModalOpen(true)}
              className="sb-icon-only w-full px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="sb-hide-collapsed">{t("signOut")}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="h-14 border-b border-white/[0.06] bg-transparent backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-20">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileSidebar(true)}
            className="lg:hidden p-2 rounded-lg bg-white/[0.06] text-zinc-300"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex-1" />
          {/* White Dynamic Pill */}
          <div ref={chainWrapRef} className="relative">
            <div className="flex items-center rounded-full bg-white text-zinc-900 shadow-md">
              <button
                type="button"
                onClick={() => setChainMenuOpen((o) => !o)}
                className="pl-2.5 pr-2 py-1.5 hover:bg-zinc-100 rounded-l-full text-xs font-semibold text-zinc-900 flex items-center gap-1.5 transition"
              >
                <CryptoIcon symbol={network} size={16} />
                <span>{network}</span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
              </button>
              <div className="w-px h-4 bg-zinc-300" />
              <button
                type="button"
                onClick={() => setWalletModalOpen(true)}
                className="pl-2.5 pr-3 py-1.5 hover:bg-zinc-100 rounded-r-full text-xs font-mono font-medium text-zinc-900 flex items-center gap-1.5 transition"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{shortAddr}</span>
                <MoreVertical className="w-3.5 h-3.5 text-zinc-500" />
              </button>
            </div>
            {chainMenuOpen && (
              <div className="dropdown-pop-in absolute right-0 mt-2 w-48 rounded-xl bg-white text-zinc-900 shadow-2xl border border-zinc-200 p-1.5 z-40">
                {SUPPORTED_NETWORKS.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setNetwork(ch.id);
                      setChainMenuOpen(false);
                      notify(`${lang === "中文" ? "已切换至" : "Switched to"} ${ch.id}`, "info");
                    }}
                    className={`w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center justify-between hover:bg-zinc-100 ${
                      network === ch.id ? "bg-zinc-100 font-semibold" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <CryptoIcon symbol={ch.id} size={16} />
                      <span>{ch.id}</span>
                    </span>
                    {network === ch.id && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 pt-4 pb-24 sm:px-7 sm:pt-7 sm:pb-24 max-w-5xl w-full mx-auto space-y-6">
          <WalletReminder wallet={account?.wallet} lang={lang} onStart={() => setProtectOpen(true)} />

          {resource.error ? (
            <div className="rounded-3xl liquid-glass p-6 text-center space-y-3" role="alert">
              <div className="text-xs text-red-300">{resource.error.message}</div>
              <button
                type="button"
                onClick={resource.reload}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#f3dfb8] to-[#d4a96a] text-[#14110e] font-semibold text-xs"
              >
                {lang === "中文" ? "重试" : "Retry"}
              </button>
            </div>
          ) : resource.loading && !["activities", "wallet", "deposit", "settings"].includes(page) ? (
            <Skeleton />
          ) : page === "dashboard" ? (
            /* HOME VIEW */
            <div className="space-y-6 panel-swap-up">
              <h1 className="text-xl font-bold text-white">{t("navHome")}</h1>

              <div className="float-card rounded-3xl liquid-glass p-5 sm:p-6 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      {t("yourDynamicWallet")}
                    </div>
                    <div className="text-3xl font-bold font-mono text-amber-400 mt-1.5 tracking-tight">
                      {data?.balance != null ? Number(data.balance).toFixed(4) : "—"}{" "}
                      <span className="text-zinc-300 text-base font-semibold">USDT</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copy(addr, "Wallet Address")}
                      className="text-[11px] font-mono text-zinc-400 hover:text-amber-300 mt-1"
                    >
                      {addr}
                    </button>
                  </div>
                  <button type="button" onClick={() => nav("deposit")} className="flex flex-col items-center gap-1.5 group">
                    <div className="p-1.5 rounded-xl bg-white shadow-md group-hover:scale-105 transition">
                      <WalletQR value={addr} size={48} />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">{t("deposit")}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs pt-2">
                  <span className="text-zinc-500 uppercase tracking-wider text-[11px]">{t("yourBalance")}</span>
                  <button
                    type="button"
                    onClick={() => setGasModalOpen(true)}
                    className="text-zinc-400 hover:text-amber-400 flex items-center gap-1 transition"
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>{t("whyGas")}</span>
                  </button>
                </div>

                {data?.balanceStatus === "unavailable" ? (
                  <div className="rounded-2xl bg-white/[0.04] p-4 text-xs text-zinc-400">
                    {data.balanceMessage || (lang === "中文" ? "暂时无法查询链上余额" : "Live balance temporarily unavailable.")}
                  </div>
                ) : data?.assets?.some((a) => Number(a.balance) > 0) ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {data.assets.map((a) => (
                      <div key={a.symbol} className="rounded-xl bg-white/[0.05] p-3 flex items-center gap-2.5">
                        <CryptoIcon symbol={a.symbol} size={20} />
                        <div>
                          <div className="text-xs font-bold text-white">{a.symbol}</div>
                          <div className="text-[11px] font-mono text-amber-300">{a.balance}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-white/[0.04] py-7 px-5 text-center space-y-2.5">
                    <div className="w-10 h-10 mx-auto rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="text-sm font-bold text-white">{t("walletEmptyTitle")}</div>
                    <div className="text-xs text-zinc-400">{t("walletEmptySub")}</div>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => nav("deposit")}
                        className="px-5 py-2 rounded-xl magnetic-btn bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] text-[#14110e] font-semibold text-xs"
                      >
                        {t("topUpNow")}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* My Cards Preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">{t("myCards")}</h2>
                  <button type="button" onClick={() => nav("cards")} className="text-xs text-amber-400 hover:text-amber-300">
                    {t("viewAll")}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="float-card md:col-span-7 rounded-2xl liquid-glass p-6 flex flex-col items-center justify-center text-center gap-3 min-h-[126px]">
                    <div className="text-xs text-zinc-400">
                      {data?.cards?.length ? `${data.cards[0].name} · •••• ${data.cards[0].last4}` : t("noCardsYet")}
                    </div>
                    <button
                      type="button"
                      onClick={() => nav("cards")}
                      className="px-4 py-2 rounded-xl magnetic-btn bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] text-[#14110e] font-semibold text-xs"
                    >
                      {data?.cards?.length ? (lang === "中文" ? "查看卡片" : "View Card") : t("applyCard")}
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label="New Card"
                    onClick={() => nav("cards", { cardView: "choose" })}
                    className="float-card md:col-span-5 rounded-2xl bg-white/[0.045] hover:bg-white/[0.08] p-6 flex items-center justify-center text-zinc-400 hover:text-amber-300 transition min-h-[126px]"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap items-center gap-2.5">
                {[
                  { label: t("topUpCard"), Icon: CreditCard, fn: () => nav("cards") },
                  { label: t("newCard"), Icon: Plus, fn: () => nav("cards", { cardView: "choose" }) },
                  { label: t("deposit"), Icon: Download, fn: () => nav("deposit") },
                ].map(({ label, Icon, fn }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={fn}
                    className="float-card px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs text-zinc-200 flex items-center gap-2 transition"
                  >
                    <span className="w-6 h-6 rounded-full bg-amber-500/15 flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5 text-amber-400" />
                    </span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Recent Activity */}
              <div className="float-card rounded-2xl liquid-glass p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">{t("recentActivity")}</h2>
                  <button type="button" onClick={() => nav("activities")} className="text-xs text-amber-400 hover:text-amber-300">
                    {t("viewAll")}
                  </button>
                </div>
                <div className="py-6 text-center space-y-3">
                  <div className="w-10 h-10 mx-auto rounded-full bg-zinc-900 flex items-center justify-center">
                    <History className="w-5 h-5 text-zinc-500" />
                  </div>
                  <div className="text-xs text-zinc-400">{t("noActivityYet")}</div>
                  <button
                    type="button"
                    onClick={() => nav("deposit")}
                    className="px-5 py-2 rounded-xl magnetic-btn bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] text-[#14110e] font-semibold text-xs"
                  >
                    {t("depositNow")}
                  </button>
                </div>
              </div>
            </div>
          ) : page === "activities" ? (
            /* ACTIVITY VIEW */
            <div className="space-y-5 panel-swap-up">
              <div>
                <h1 className="text-xl font-bold text-white">{t("navActivity")}</h1>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {lang === "中文" ? "您的所有账户活动" : "All your account activity"}
                </p>
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={actSearch}
                    onChange={(e) => setActSearch(e.target.value)}
                    placeholder={lang === "中文" ? "搜索商户或卡片..." : "Search merchant or card..."}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.06] text-xs text-white placeholder-zinc-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {["all", "deposit", "Top-ups", "Purchases", "Spend", "Refunds", "Swaps"].map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      onClick={() => setActType(tp)}
                      className={`px-3 py-1 rounded-full text-[11px] transition ${
                        actType === tp ? "bg-amber-500/20 text-amber-300 font-semibold" : "bg-white/[0.06] text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {tp === "all" ? (lang === "中文" ? "全部" : "All") : tp}
                    </button>
                  ))}
                </div>
                <div className="relative inline-grid grid-cols-3 p-1 rounded-xl bg-white/[0.07] min-w-[260px] overflow-hidden">
                  <div
                    className="tab-slider-pill absolute top-1 bottom-1 left-1 rounded-lg bg-gradient-to-r from-[#e4c082]/25 to-[#d4a96a]/15 pointer-events-none"
                    style={{
                      width: "calc((100% - 8px) / 3)",
                      transform: `translateX(${["All time", "30 days", "7 days"].indexOf(actPeriod) * 100}%)`,
                    }}
                  />
                  {["All time", "30 days", "7 days"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setActPeriod(p)}
                      className={`relative z-10 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                        actPeriod === p ? "text-amber-300" : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="float-card rounded-2xl liquid-glass py-14 text-center space-y-2.5">
                <div className="w-10 h-10 mx-auto rounded-full bg-white/[0.06] flex items-center justify-center">
                  <Clock className="w-5 h-5 text-zinc-400" />
                </div>
                <div className="text-sm font-semibold text-white">{lang === "中文" ? "暂无动态" : "No activity yet"}</div>
              </div>
            </div>
          ) : page === "cards" ? (
            <CardsSection
              cards={data?.cards || []}
              balance={data?.balance}
              lang={lang}
              notify={notify}
              reload={resource.reload}
              initialView={cardInitialView}
            />
          ) : page === "wallet" ? (
            <WalletSection
              account={account}
              data={data}
              network={network}
              lang={lang}
              onGoDeposit={() => nav("deposit")}
              notify={notify}
            />
          ) : page === "deposit" ? (
            /* DEPOSIT VIEW */
            <div className="space-y-6 panel-swap-up">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold text-white">
                    {lang === "中文" ? "充值本地钱包" : "Top Up Local Wallet"}
                  </h1>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {lang === "中文"
                      ? "转入 USDT 至您的嵌入式钱包，用于开卡与卡片充值。"
                      : "Send USDT to your embedded wallet to fund card purchases and top-ups."}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  EMBEDDED WALLET
                </span>
              </div>

              <div className="relative grid grid-cols-2 w-full p-1 rounded-xl bg-white/[0.07] overflow-hidden">
                <div
                  className="tab-slider-pill absolute top-1 bottom-1 left-1 rounded-lg bg-gradient-to-r from-[#f3dfb8] to-[#d4a96a] pointer-events-none"
                  style={{ width: "calc((100% - 8px) / 2)", transform: `translateX(${depositTab === "receive" ? "0%" : "100%"})` }}
                />
                <button
                  type="button"
                  onClick={() => setDepositTab("receive")}
                  className={`relative z-10 py-2.5 rounded-lg text-xs font-semibold ${depositTab === "receive" ? "text-[#14110e]" : "text-zinc-400"}`}
                >
                  {lang === "中文" ? "接收" : "Receive"}
                </button>
                <button
                  type="button"
                  onClick={() => setDepositTab("history")}
                  className={`relative z-10 py-2.5 rounded-lg text-xs font-semibold ${depositTab === "history" ? "text-[#14110e]" : "text-zinc-400"}`}
                >
                  {lang === "中文" ? "记录" : "History"}
                </button>
              </div>

              {depositTab === "receive" ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {SUPPORTED_NETWORKS.map((n) => {
                      const sel = network === n.id;
                      const netAddr = addressForNetwork(account?.wallet, n.id);
                      const bal = data?.networkBalances?.[n.id]?.usdt;
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => setNetwork(n.id)}
                          className={`float-card relative rounded-2xl p-4 text-left transition ${
                            sel ? "bg-amber-500/15" : "bg-white/[0.06] hover:bg-white/[0.09]"
                          }`}
                        >
                          {sel && (
                            <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-gradient-to-r from-[#f3dfb8] to-[#d4a96a] text-[#14110e] flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                          <div className="flex items-center gap-2.5">
                            <CryptoIcon symbol={n.id} size={24} />
                            <div>
                              <div className={`text-sm font-bold ${n.color}`}>{n.id}</div>
                              <div className="text-[11px] text-zinc-400">{n.sub}</div>
                            </div>
                          </div>
                          <div className="text-[11px] font-mono text-zinc-400 mt-2.5 truncate">
                            {n.chainKey === "EVM"
                              ? bal != null
                                ? `${Number(bal).toFixed(2)} USDT`
                                : "— USDT"
                              : netAddr
                                ? `${netAddr.slice(0, 6)}...${netAddr.slice(-4)}`
                                : lang === "中文"
                                  ? "重新登录以同步地址"
                                  : "Sign in again to sync"}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="float-card rounded-3xl liquid-glass p-6 space-y-5 text-center">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                        {lang === "中文" ? "您的钱包地址" : "YOUR WALLET ADDRESS"}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[11px] font-medium">
                        {network}
                      </span>
                    </div>
                    {activeAddr ? (
                      <>
                        <div className="inline-block p-3 rounded-2xl bg-white shadow-xl">
                          <WalletQR value={activeAddr} size={128} />
                        </div>
                        <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                          SCAN TO DEPOSIT ON {network.toUpperCase()}
                        </div>
                        <button
                          type="button"
                          onClick={() => copy(activeAddr, `${network} Address`)}
                          className="w-full rounded-xl bg-black/25 p-3 space-y-1 hover:bg-black/35 transition"
                        >
                          <div className="font-mono text-xs text-zinc-200 break-all">{activeAddr}</div>
                          <div className="text-[10px] uppercase tracking-wider text-amber-400/80">TAP TO COPY ADDRESS</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => copy(activeAddr, `${network} Address`)}
                          className="w-full py-2.5 rounded-xl magnetic-btn bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] text-[#14110e] font-semibold text-xs"
                        >
                          {lang === "中文" ? "复制地址" : "Copy Wallet Address"}
                        </button>
                      </>
                    ) : (
                      <div className="py-6 space-y-2 text-xs text-zinc-400">
                        <div>
                          {lang === "中文"
                            ? `当前账户尚未同步 ${network} 嵌入式钱包地址。`
                            : `No ${network} embedded wallet address synced for this session yet.`}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {lang === "中文"
                            ? "请确认 Dynamic 控制台已开启该链的 Embedded wallets，然后退出重新登录即可自动生成并同步。"
                            : "Ensure Embedded Wallets is enabled for this chain in Dynamic, then sign out and sign in again to sync."}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl liquid-glass p-14 text-center space-y-3">
                  <div className="w-10 h-10 mx-auto rounded-full bg-amber-500/15 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="text-xs text-zinc-400">{lang === "中文" ? "暂无充值记录" : "No deposits yet"}</div>
                </div>
              )}
            </div>
          ) : page === "history" ? (
            /* HISTORY VIEW */
            <div className="space-y-5 panel-swap-up">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-white">{lang === "中文" ? "交易记录" : "Transaction History"}</h1>
                <button
                  type="button"
                  onClick={() => {
                    resource.reload();
                    notify(lang === "中文" ? "已刷新余额与记录" : "Balances refreshed", "info");
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-white/[0.08] text-xs text-zinc-300 hover:text-amber-300 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{lang === "中文" ? "刷新" : "Refresh"}</span>
                </button>
              </div>
              <div className="rounded-xl bg-amber-500/10 px-4 py-3 flex items-center gap-2.5 text-xs text-amber-200/90">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {lang === "中文"
                    ? "展示您嵌入式钱包在所有支持网络上的链上交易记录。"
                    : "Showing on-chain transactions for your embedded wallet across all supported networks."}
                </span>
              </div>
              <div className="rounded-3xl liquid-glass p-14 text-center space-y-3">
                <div className="w-10 h-10 mx-auto rounded-full bg-amber-500/15 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <div className="text-xs text-zinc-400">
                  {lang === "中文"
                    ? "未找到您本地钱包在链上的交易记录。"
                    : "No on-chain activity found for your local wallet."}
                </div>
              </div>
            </div>
          ) : page === "referral" ? (
            /* REFERRAL VIEW */
            <div className="space-y-6 panel-swap-up">
              <div>
                <h1 className="text-xl font-bold text-white">{lang === "中文" ? "推荐与奖励" : "Referral & Rewards"}</h1>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {lang === "中文"
                    ? "邀请好友使用并通过每张激活卡片赚取佣金"
                    : "Invite friends and earn commissions on every card activated"}
                </p>
              </div>

              <div className="rounded-2xl liquid-glass p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
                    <Star className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">
                      {lang === "中文" ? "当前等级：暂未开启" : "Your Rank: Not earning yet"}
                    </div>
                    <div className="text-xs text-zinc-400">
                      {lang === "中文" ? "设置佣金比例后即开始计佣" : "Commissions start automatically once enabled"}
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-zinc-900 text-xs font-mono text-zinc-400">0%</span>
              </div>

              <div className="rounded-3xl bg-gradient-to-br from-amber-500/10 to-white/[0.04] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex-1 space-y-3 w-full">
                  <div className="text-sm font-semibold text-white">{lang === "中文" ? "您的推荐链接" : "Your Referral Link"}</div>
                  <div className="space-y-2 text-xs">
                    <div className="p-3 rounded-xl bg-zinc-950 flex items-center justify-between">
                      <span className="font-mono text-amber-400 tracking-widest">{data?.referral?.code || "Ver1-DSCMAU"}</span>
                      <button type="button" onClick={() => copy(data?.referral?.code || "Ver1-DSCMAU", "Code")} className="text-zinc-400 hover:text-white">
                        Copy
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-950 flex items-center justify-between gap-2">
                      <span className="font-mono text-zinc-300 truncate">
                        https://veracard.io/ref/{data?.referral?.code || "Ver1-DSCMAU"}
                      </span>
                      <button
                        type="button"
                        onClick={() => copy(`https://veracard.io/ref/${data?.referral?.code || "Ver1-DSCMAU"}`, "Link")}
                        className="text-zinc-400 hover:text-white shrink-0"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-center gap-2">
                  <div className="p-2.5 rounded-2xl bg-white">
                    <WalletQR value={`https://veracard.io/ref/${data?.referral?.code || "Ver1-DSCMAU"}`} size={96} />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-400">SCAN TO JOIN</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: lang === "中文" ? "待结算" : "PENDING", val: "$0.00", cls: "text-amber-400" },
                  { label: lang === "中文" ? "已到账" : "RECEIVED", val: "$0.00", cls: "text-emerald-400" },
                  { label: lang === "中文" ? "总收益" : "TOTAL EARNED", val: "$0.00", cls: "text-white" },
                ].map((s) => (
                  <div key={s.label} className="p-4 rounded-2xl liquid-glass">
                    <div className="text-[10px] uppercase text-zinc-500">{s.label}</div>
                    <div className={`text-lg font-bold font-mono mt-1 ${s.cls}`}>{s.val}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl liquid-glass p-6 space-y-4">
                <div className="text-sm font-bold text-white">{lang === "中文" ? "提现申请" : "Payouts"}</div>
                <div className="flex flex-wrap gap-2 items-center">
                  {["BSC", "Tron", "ERC20"].map((net) => (
                    <button
                      key={net}
                      type="button"
                      onClick={() => setPayoutNet(net)}
                      className={`px-3 py-1.5 rounded-lg text-xs transition ${
                        payoutNet === net ? "bg-amber-500/20 text-amber-300 font-semibold" : "bg-white/[0.06] text-zinc-400"
                      }`}
                    >
                      {net}
                    </button>
                  ))}
                  <span className="text-[11px] text-zinc-500 ml-auto">
                    {lang === "中文" ? "最低提现 $100.00" : "Min payout: $100.00"}
                  </span>
                </div>
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 rounded-xl bg-amber-500/35 text-zinc-950 font-semibold text-xs cursor-not-allowed"
                >
                  {lang === "中文" ? "申请提现" : "Request payout"}
                </button>
              </div>
            </div>
          ) : (
            <SettingsSection
              account={account}
              lang={lang}
              onChangeLang={onChangeLang}
              onReplayTour={() => setTourOpen(true)}
              onSignOut={() => setSignOutModalOpen(true)}
              notify={notify}
            />
          )}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-[#181411]/95 backdrop-blur-xl border-t border-white/[0.07] px-2 py-2 grid grid-cols-5 gap-1">
          {[
            { id: "dashboard", Icon: Home, label: t("navHome") },
            { id: "cards", Icon: CreditCard, label: t("navMyCards") },
            { id: "wallet", Icon: Wallet, label: t("navLocalWallet") },
            { id: "deposit", Icon: Download, label: t("navDeposit") },
            { id: "settings", Icon: Settings, label: t("navSettings") },
          ].map(({ id, Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => nav(id)}
              className={`flex flex-col items-center gap-1 py-1 rounded-xl text-[10px] ${
                page === id ? "text-amber-300 font-semibold" : "text-zinc-400"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-full">{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Modals */}
      <OnboardingTourModal
        open={tourOpen}
        onClose={handleCloseTour}
        onProtect={() => {
          handleCloseTour();
          setProtectOpen(true);
        }}
        walletAddress={addr}
        lang={lang}
      />
      <WalletProtectionModal
        open={protectOpen}
        onClose={() => setProtectOpen(false)}
        onComplete={() => {
          setProtectOpen(false);
          notify(lang === "中文" ? "钱包保护已完成" : "Wallet protection enabled");
          resource.reload();
        }}
        lang={lang}
      />
      <Modal open={walletModalOpen} onClose={() => setWalletModalOpen(false)} light maxWidth="max-w-sm">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-[#b88946] text-white flex items-center justify-center font-bold">V</div>
              <div className="min-w-0">
                <div className="font-semibold text-zinc-900 truncate">{account?.email}</div>
                <div className="text-[10px] font-mono text-zinc-500">{shortAddr}</div>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 font-medium">{network}</span>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Live USDT Balance</div>
            <div className="text-3xl font-bold font-mono">
              {data?.balance != null ? `${Number(data.balance).toFixed(4)}` : "—"}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setWalletModalOpen(false);
                nav("deposit");
              }}
              className="py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold"
            >
              + Deposit
            </button>
            <button
              type="button"
              onClick={() => {
                setWalletModalOpen(false);
                nav("wallet");
              }}
              className="py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold"
            >
              Open Wallet
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={gasModalOpen} onClose={() => setGasModalOpen(false)} title={t("whyGas")}>
        <div className="px-6 pb-6 space-y-4">
          <p className="text-xs text-zinc-300 leading-relaxed">
            {lang === "中文"
              ? "原生 Gas（BNB / ETH）用于支付链上代币转账手续费。每次为卡片充值约需所在链 $0.03 的 Gas 费，钱包充值本身始终免费。"
              : "Native gas (BNB / ETH) pays the on-chain fee to move tokens. Each card top-up needs ~$0.03 of gas on that chain. Depositing is always free."}
          </p>
          <button
            type="button"
            onClick={() => setGasModalOpen(false)}
            className="w-full py-2 rounded-xl bg-gradient-to-r from-[#f3dfb8] to-[#d4a96a] text-[#14110e] font-semibold text-xs"
          >
            {lang === "中文" ? "知道了" : "Got it"}
          </button>
        </div>
      </Modal>

      <Modal open={signOutModalOpen} onClose={() => setSignOutModalOpen(false)} title={t("signOut")}>
        <div className="px-6 pb-6 space-y-4">
          <p className="text-xs text-zinc-300">
            {lang === "中文" ? "确定要退出当前 VeraCard 账户吗？" : "Sign out of your VeraCard account?"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSignOutModalOpen(false)}
              className="py-2 rounded-xl bg-white/[0.07] text-xs text-zinc-300"
            >
              {lang === "中文" ? "取消" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="py-2 rounded-xl bg-red-500/80 hover:bg-red-500 text-white font-semibold text-xs"
            >
              {t("signOut")}
            </button>
          </div>
        </div>
      </Modal>

      <ToastBanner toast={toast} />
    </div>
  );
}
