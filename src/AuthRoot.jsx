import React, { useState, useEffect } from "react";
import { App } from "./App.jsx";
import { AuthPage } from "./AuthPage.jsx";
import { loadSession, restoreSession } from "./authStore.js";
import { AmbientStage } from "./components/AmbientStage.jsx";
import { BrandVMark } from "./components/BrandMark.jsx";

export function AuthRoot() {
  const [account, setAccountState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lang, setLang] = useState(() => localStorage.getItem("veracard-language") || "EN");

  const changeLang = (next) => {
    setLang(next);
    localStorage.setItem("veracard-language", next);
    document.documentElement.lang = next === "中文" ? "zh-CN" : "en";
  };

  useEffect(() => {
    document.documentElement.lang = lang === "中文" ? "zh-CN" : "en";
  }, [lang]);

  const boot = () => {
    setLoading(true);
    setError("");
    loadSession()
      .then(setAccountState)
      .catch((e) => setError(e.message || "Failed to restore session"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    boot();
    const sync = () => setAccountState(restoreSession());
    window.addEventListener("veracard-auth-change", sync);
    return () => window.removeEventListener("veracard-auth-change", sync);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <AmbientStage />
        <div className="relative z-10 text-center space-y-3" role="status">
          <div className="w-14 h-10 mx-auto rounded-xl glass-card-amber flex items-center justify-center animate-pulse">
            <BrandVMark size={22} />
          </div>
          <div className="text-xs text-zinc-400">{lang === "中文" ? "正在恢复账户..." : "Restoring your session..."}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <AmbientStage />
        <div className="relative z-10 max-w-sm w-full rounded-3xl liquid-glass p-6 text-center space-y-4" role="alert">
          <div className="text-sm text-red-300">{error}</div>
          <button
            type="button"
            onClick={boot}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#f3dfb8] to-[#d4a96a] text-[#14110e] font-semibold text-xs"
          >
            {lang === "中文" ? "重试" : "Retry"}
          </button>
        </div>
      </div>
    );
  }

  if (!account?.wallet) {
    return (
      <AuthPage
        lang={lang}
        onChangeLang={changeLang}
        initialAccount={account}
        onComplete={(user) => {
          const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
          history.replaceState({}, "", `${base}/dashboard`);
          setAccountState(user);
        }}
      />
    );
  }

  return <App key={account.id} lang={lang} onChangeLang={changeLang} />;
}
