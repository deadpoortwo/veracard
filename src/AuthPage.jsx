import React, { useEffect, useRef, useState } from "react";
import { Globe, Mail, Lock, Eye, EyeOff, Zap, ShieldCheck, CreditCard, AlertCircle, Loader2 } from "lucide-react";
import { AmbientStage } from "./components/AmbientStage.jsx";
import { BrandLogo, BrandVMark, UniversalShowcaseCard } from "./components/BrandMark.jsx";
import { createTranslator } from "./i18n.js";
import { beginLogin, beginRegistration, beginReset, resendCode, verifyCode, pendingInfo } from "./authStore.js";
import { prepareWallet } from "./walletService.js";

function getPasswordStrength(pw, lang) {
  if (!pw) return { score: 0, label: "", segCls: "bg-zinc-800", textCls: "text-zinc-500" };
  let pts = 0;
  if (pw.length >= 8) pts += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) pts += 1;
  if (/\d/.test(pw)) pts += 1;
  if (/[^A-Za-z0-9]/.test(pw)) pts += 1;
  const score = Math.max(1, pts);
  if (score === 1) return { score: 1, label: lang === "中文" ? "弱" : "Weak", segCls: "bg-red-500", textCls: "text-red-400" };
  if (score === 2) return { score: 2, label: lang === "中文" ? "一般" : "Fair", segCls: "bg-orange-500", textCls: "text-orange-400" };
  if (score === 3) return { score: 3, label: lang === "中文" ? "良好" : "Good", segCls: "bg-amber-400", textCls: "text-amber-400" };
  return { score: 4, label: lang === "中文" ? "强" : "Strong", segCls: "bg-emerald-500", textCls: "text-emerald-400" };
}

const RAILS = [
  "BNB Chain",
  "Ethereum",
  "TRON",
  "Polygon",
  "Solana",
  "Apple Pay",
  "Google Pay",
  "Visa",
  "Mastercard",
  "Dynamic MPC",
];

export function AuthPage({ lang, onChangeLang, initialAccount, onComplete }) {
  const t = createTranslator(lang);
  const [screen, setScreen] = useState(() => (initialAccount && !initialAccount.wallet ? "preparing" : "auth"));
  const [authTab, setAuthTab] = useState(() => (location.pathname === "/register" ? "signup" : "signin"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [newResetPw, setNewResetPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // OTP state
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [resendSec, setResendSec] = useState(60);
  const [challengeKind, setChallengeKind] = useState("login");
  const otpRefs = useRef([]);

  // Wallet preparing state
  const [prepProgress, setPrepProgress] = useState(12);
  const [prepMessage, setPrepMessage] = useState("");
  const [prepError, setPrepError] = useState("");

  // Hero decode & typewriter animation
  const [decodedTitle, setDecodedTitle] = useState(t("heroLine2"));
  const [typedSub, setTypedSub] = useState(t("heroSub"));
  const [typingDone, setTypingDone] = useState(true);
  const heroCardRef = useRef(null);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const finalTitle = t("heroLine2");
    const finalSub = t("heroSub");
    if (reduced) {
      setDecodedTitle(finalTitle);
      setTypedSub(finalSub);
      setTypingDone(true);
      return;
    }
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%";
    let frame = 0;
    const decodeIv = setInterval(() => {
      frame += 1;
      const revealed = Math.floor((frame / 16) * finalTitle.length);
      setDecodedTitle(
        finalTitle
          .split("")
          .map((ch, idx) => (ch === " " || idx < revealed ? ch : chars[Math.floor(Math.random() * chars.length)]))
          .join(""),
      );
      if (frame >= 16) {
        setDecodedTitle(finalTitle);
        clearInterval(decodeIv);
      }
    }, 28);

    setTypingDone(false);
    let idx = 0;
    const typeIv = setInterval(() => {
      idx += 3;
      setTypedSub(finalSub.slice(0, idx));
      if (idx >= finalSub.length) {
        setTypedSub(finalSub);
        clearInterval(typeIv);
        setTypingDone(true);
      }
    }, 20);

    return () => {
      clearInterval(decodeIv);
      clearInterval(typeIv);
    };
  }, [lang]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (screen !== "verify" || resendSec <= 0) return;
    const timer = setTimeout(() => setResendSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [screen, resendSec]);

  // Run wallet preparation when entering preparing screen
  const runWalletPrep = async () => {
    setPrepError("");
    setPrepProgress(10);
    setPrepMessage(t("prepWalletSub"));
    const started = Date.now();
    try {
      const user = await prepareWallet((pct, msg) => {
        setPrepProgress(pct);
        if (msg) setPrepMessage(msg);
      });
      const elapsed = Date.now() - started;
      if (elapsed < 700) await new Promise((r) => setTimeout(r, 700 - elapsed));
      setPrepProgress(100);
      setPrepMessage(lang === "中文" ? "您的钱包已就绪，正在进入..." : "Your wallet is ready. Taking you in...");
      setTimeout(() => onComplete(user), 450);
    } catch (e) {
      setPrepError(e.message || "Failed to initialize wallet");
    }
  };

  useEffect(() => {
    if (screen === "preparing") {
      runWalletPrep();
    }
  }, [screen]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError(lang === "中文" ? "请输入邮箱地址" : "Please enter your email address");
      return;
    }
    if (authTab === "forgot") {
      setBusy(true);
      try {
        await beginReset(cleanEmail);
        setChallengeKind("reset");
        setDigits(["", "", "", "", "", ""]);
        setResendSec(60);
        setScreen("verify");
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!password || password.length < 8) {
      setError(lang === "中文" ? "密码长度至少需要 8 位" : "Password must be at least 8 characters");
      return;
    }
    if (authTab === "signup" && password !== confirmPw) {
      setError(t("pwMismatch"));
      return;
    }

    setBusy(true);
    try {
      if (authTab === "signup") {
        await beginRegistration(cleanEmail, password);
        setChallengeKind("register");
      } else {
        await beginLogin(cleanEmail, password);
        setChallengeKind("login");
      }
      setDigits(["", "", "", "", "", ""]);
      setResendSec(60);
      setScreen("verify");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitVerifyCode = async (codeOverride) => {
    if (busy) return;
    const code = typeof codeOverride === "string" ? codeOverride : digits.join("");
    if (code.length < 6) {
      setError(lang === "中文" ? "请输入完整的 6 位验证码" : "Please enter all 6 digits");
      return;
    }
    if (challengeKind === "reset" && newResetPw.length < 8) {
      setError(lang === "中文" ? "新密码至少需要 8 位字符" : "New password must be at least 8 characters");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await verifyCode(code, challengeKind === "reset" ? newResetPw : undefined);
      if (res.reset) {
        setAuthTab("signin");
        setPassword("");
        setNewResetPw("");
        setScreen("auth");
        return;
      }
      setScreen("preparing");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleVerifySubmit = (e) => {
    e?.preventDefault();
    submitVerifyCode();
  };

  useEffect(() => {
    if (screen === "verify") {
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    }
  }, [screen]);

  const handleOtpChange = (idx, raw) => {
    if (busy) return;
    const clean = raw.replace(/\D/g, "");
    const next = [...digits];
    if (clean.length > 1) {
      clean
        .slice(0, 6)
        .split("")
        .forEach((ch, k) => {
          if (idx + k < 6) next[idx + k] = ch;
        });
      setDigits(next);
      otpRefs.current[Math.min(5, idx + clean.length)]?.focus();
    } else {
      next[idx] = clean.slice(0, 1);
      setDigits(next);
      if (next[idx] && idx < 5) otpRefs.current[idx + 1]?.focus();
    }
    const nextCode = next.join("");
    if (nextCode.length === 6 && (challengeKind !== "reset" || newResetPw.length >= 8)) {
      submitVerifyCode(nextCode);
    }
  };

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (resendSec > 0 || busy) return;
    setError("");
    setBusy(true);
    try {
      await resendCode();
      setResendSec(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (screen === "preparing") {
    const ready = prepProgress >= 100;
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <AmbientStage />
        <div className="relative z-10 w-full max-w-sm rounded-3xl liquid-glass p-7 text-center space-y-5 panel-swap-up">
          <div className="w-14 h-10 mx-auto rounded-lg glass-card-amber flex items-center justify-center shadow-[0_0_24px_rgba(245,158,11,0.25)]">
            <BrandVMark size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">
              {ready ? (lang === "中文" ? "您的钱包已就绪" : "Your wallet is ready") : t("prepWalletTitle")}
            </h2>
            <p className="text-xs text-zinc-400">{prepMessage || t("prepWalletSub")}</p>
          </div>
          {prepError ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-red-500/10 border border-red-500/40 p-3 text-xs text-red-300">{prepError}</div>
              <button
                type="button"
                onClick={runWalletPrep}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#f3dfb8] to-[#d4a96a] text-[#14110e] font-semibold text-xs"
              >
                {lang === "中文" ? "重试初始化" : "Retry Wallet Setup"}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300"
                  style={{ width: `${prepProgress}%` }}
                />
              </div>
              <div className="text-[11px] text-zinc-500 font-mono">
                {lang === "中文" ? "已完成" : "Completed"} {prepProgress}%
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const isSignIn = authTab === "signin";
  const isSignUp = authTab === "signup";
  const strength = getPasswordStrength(password, lang);
  const mismatch = isSignUp && confirmPw.length > 0 && password !== confirmPw;
  const otpComplete = digits.every((d) => /^\d$/.test(d)) && (challengeKind !== "reset" || newResetPw.length >= 8);
  const pending = pendingInfo();

  return (
    <div className="min-h-screen flex flex-col relative">
      <AmbientStage />
      <button
        type="button"
        onClick={() => onChangeLang(lang === "EN" ? "中文" : "EN")}
        className="fixed top-5 right-6 z-40 px-3 py-1.5 rounded-lg bg-zinc-950/80 hover:bg-zinc-900 text-xs font-medium text-zinc-300 hover:text-amber-300 transition flex items-center gap-1.5 backdrop-blur-md"
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{lang === "EN" ? "中文" : "EN"}</span>
      </button>

      <div className="relative z-10 min-h-screen flex flex-col justify-center px-4 sm:px-8 lg:px-14 py-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left Hero Column */}
          <div className="lg:col-span-6 space-y-6">
            <BrandLogo />
            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.12]">
                <span className="block text-white">{t("heroLine1")}</span>
                <span className="block text-amber-500">{decodedTitle}</span>
              </h1>
              <p className={`text-zinc-400 text-sm sm:text-base leading-relaxed max-w-md min-h-[48px] ${typingDone ? "" : "type-caret"}`}>
                {typedSub}
              </p>
            </div>

            {/* 3D Floating Cards */}
            <div className="relative py-2 max-w-md" style={{ perspective: "1100px" }}>
              <div className="relative h-52 sm:h-56">
                <div className="absolute right-0 top-2 w-[82%] h-44 sm:h-48 rounded-2xl glass-card-amber opacity-45 anim-card-back" />
                <div
                  ref={heroCardRef}
                  onMouseMove={(e) => {
                    const el = heroCardRef.current;
                    if (!el) return;
                    const r = el.getBoundingClientRect();
                    const dx = (e.clientX - r.left) / r.width - 0.5;
                    const dy = (e.clientY - r.top) / r.height - 0.5;
                    el.style.animation = "none";
                    el.style.transform = `rotateY(${dx * 12}deg) rotateX(${-dy * 12}deg) translateY(-4px)`;
                  }}
                  onMouseLeave={() => {
                    const el = heroCardRef.current;
                    if (!el) return;
                    el.style.transform = "";
                    el.style.animation = "cardFloatFront 6s ease-in-out infinite";
                  }}
                  className="relative z-10 w-[88%] h-52 sm:h-56 anim-card-front"
                >
                  <UniversalShowcaseCard lang={lang} />
                </div>
              </div>
            </div>

            <div className="space-y-3.5 pt-1">
              {[
                { Icon: Zap, title: t("feat1Title"), desc: t("feat1Desc") },
                { Icon: ShieldCheck, title: t("feat2Title"), desc: t("feat2Desc") },
                { Icon: CreditCard, title: t("feat3Title"), desc: t("feat3Desc") },
              ].map(({ Icon, title, desc }) => (
                <div key={title} className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white leading-snug">{title}</div>
                    <div className="text-xs text-zinc-400">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Auth Card */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[430px]">
              <div className="ambient-glow-auth-right" />
              <div className="relative z-10 w-full rounded-3xl liquid-glass float-card p-6 sm:p-8">
                {screen === "verify" ? (
                  <div className="space-y-5 text-center panel-swap-up">
                    <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/10">
                      <Mail className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-lg font-bold text-white">{t("verifyTitle")}</h2>
                      <p className="text-xs text-zinc-400">{t("verifySub")}</p>
                      <p className="text-xs font-medium text-amber-400">{pending?.email || email}</p>
                    </div>
                    {error && (
                      <div className="rounded-xl bg-red-500/10 border border-red-500/45 px-3.5 py-2.5 flex items-center gap-2 text-xs text-red-300 text-left">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}
                    <form onSubmit={handleVerifySubmit} className="space-y-4">
                      <div className="grid grid-cols-6 gap-2">
                        {digits.map((d, idx) => (
                          <input
                            key={idx}
                            ref={(el) => (otpRefs.current[idx] = el)}
                            type="text"
                            maxLength={6}
                            inputMode="numeric"
                            disabled={busy}
                            value={d}
                            onChange={(e) => handleOtpChange(idx, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                            className={`w-full h-12 rounded-xl bg-zinc-950 border ${
                              d ? "border-amber-500/70" : "border-white/[0.08]"
                            } focus:border-amber-500 focus:outline-none disabled:opacity-60 text-center font-mono text-lg font-bold text-white`}
                          />
                        ))}
                      </div>
                      {challengeKind === "reset" && (
                        <div className="text-left">
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                            {t("newPasswordLabel")}
                          </label>
                          <input
                            type="password"
                            required
                            value={newResetPw}
                            onChange={(e) => setNewResetPw(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none"
                          />
                        </div>
                      )}
                      {pending?.authProvider === "local" && (
                        <div className="text-[11px] text-zinc-500">
                          {lang === "中文" ? "本地开发模式验证码：111111" : "Local dev verification code: 111111"}
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={busy || !otpComplete}
                        className="w-full py-2.5 rounded-xl magnetic-btn bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] hover:brightness-105 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:brightness-100 text-[#14110e] font-semibold text-sm transition flex items-center justify-center gap-2"
                      >
                        {busy ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{t("verifying")}</span>
                          </>
                        ) : (
                          <span>{t("verifyBtn")}</span>
                        )}
                      </button>
                    </form>
                    <button
                      type="button"
                      disabled={resendSec > 0 || busy}
                      onClick={handleResend}
                      className="text-xs text-zinc-400 hover:text-amber-400 disabled:text-zinc-600 transition"
                    >
                      {t("resendIn")} {resendSec > 0 ? `(${resendSec}s)` : ""}
                    </button>
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setError("");
                          setScreen("auth");
                        }}
                        className="text-xs text-zinc-400 hover:text-amber-400 transition"
                      >
                        {t("backToLogin")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {authTab !== "forgot" && (
                      <div className="relative grid grid-cols-2 p-1 rounded-xl bg-zinc-950/90 mb-6">
                        <div
                          className="tab-slider-pill absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-amber-500/15 border border-amber-500/45 pointer-events-none"
                          style={{ transform: `translateX(${isSignIn ? "0%" : "100%"})` }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setError("");
                            setAuthTab("signin");
                          }}
                          className={`relative z-10 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isSignIn ? "text-amber-400" : "text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {t("signIn")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setError("");
                            setAuthTab("signup");
                          }}
                          className={`relative z-10 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isSignUp ? "text-amber-400" : "text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {t("createAccount")}
                        </button>
                      </div>
                    )}

                    {authTab === "forgot" && (
                      <div className="mb-5">
                        <h2 className="text-lg font-bold text-white">{t("resetPassword")}</h2>
                        <p className="text-xs text-zinc-400 mt-1">
                          {lang === "中文"
                            ? "输入您的注册邮箱，我们将发送重置验证码。"
                            : "Enter your account email to receive a reset verification code."}
                        </p>
                      </div>
                    )}

                    <form onSubmit={handleAuthSubmit} noValidate className="space-y-4">
                      {error && (
                        <div className="rounded-xl bg-red-500/10 border border-red-500/45 px-3.5 py-2.5 flex items-center gap-2.5 text-xs text-red-300">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                          {t("emailLabel")}
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 focus:ring-2 focus:ring-amber-500/40 focus:outline-none text-sm text-zinc-100 placeholder-zinc-600 transition"
                          />
                        </div>
                      </div>

                      {authTab !== "forgot" && (
                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                            {t("passwordLabel")}
                          </label>
                          <div className="relative">
                            <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                              type={showPw ? "text" : "password"}
                              required
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-zinc-950 focus:ring-2 focus:ring-amber-500/40 focus:outline-none text-sm text-zinc-100 placeholder-zinc-600 transition"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPw((s) => !s)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                            >
                              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {isSignUp && password && (
                            <div className="mt-2 flex items-center gap-2.5">
                              <div className="flex-1 grid grid-cols-4 gap-1.5">
                                {[1, 2, 3, 4].map((n) => (
                                  <div
                                    key={n}
                                    className={`h-1 rounded-full transition-colors ${n <= strength.score ? strength.segCls : "bg-zinc-800"}`}
                                  />
                                ))}
                              </div>
                              <span className={`text-[11px] font-medium ${strength.textCls} shrink-0`}>{strength.label}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {isSignUp && (
                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                            {t("confirmPasswordLabel")}
                          </label>
                          <div className="relative">
                            <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                              type={showConfirm ? "text" : "password"}
                              required
                              value={confirmPw}
                              onChange={(e) => setConfirmPw(e.target.value)}
                              placeholder="••••••••"
                              className={`w-full pl-10 pr-10 py-2.5 rounded-xl bg-zinc-950 ${
                                mismatch ? "ring-1 ring-red-500/80" : ""
                              } focus:ring-2 focus:ring-amber-500/40 focus:outline-none text-sm text-zinc-100 placeholder-zinc-600 transition`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirm((s) => !s)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                            >
                              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {mismatch && <p className="text-[11px] text-red-400 mt-1.5">{t("pwMismatch")}</p>}
                        </div>
                      )}

                      {isSignIn && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setError("");
                              setAuthTab("forgot");
                            }}
                            className="text-xs font-medium text-amber-500 hover:text-amber-400 transition"
                          >
                            {t("forgotPassword")}
                          </button>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full py-2.5 rounded-xl magnetic-btn bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] hover:brightness-105 disabled:opacity-60 text-[#14110e] font-semibold text-sm transition shadow-[0_0_22px_rgba(245,158,11,0.28)] mt-2 flex items-center justify-center gap-2"
                      >
                        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>
                          {authTab === "forgot"
                            ? lang === "中文"
                              ? "发送重置验证码"
                              : "Send Reset Code"
                            : isSignIn
                              ? t("signIn")
                              : t("createAccount")}
                        </span>
                      </button>
                    </form>

                    <div className="mt-5 text-center text-xs text-zinc-400">
                      {authTab === "forgot" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setError("");
                            setAuthTab("signin");
                          }}
                          className="text-amber-500 hover:text-amber-400 font-medium"
                        >
                          {t("backToLogin")}
                        </button>
                      ) : isSignIn ? (
                        <>
                          <span>{t("noAccount")}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setError("");
                              setAuthTab("signup");
                            }}
                            className="text-amber-500 hover:text-amber-400 font-medium ml-1"
                          >
                            {t("createOneFree")}
                          </button>
                        </>
                      ) : (
                        <>
                          <span>{t("hasAccount")}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setError("");
                              setAuthTab("signin");
                            }}
                            className="text-amber-500 hover:text-amber-400 font-medium ml-1"
                          >
                            {t("signInLink")}
                          </button>
                        </>
                      )}
                    </div>
                    <div className="mt-6 pt-4 border-t border-white/[0.07] text-center text-[11px] text-zinc-500">
                      {t("authFooter")}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Supported Rails Infinite Marquee */}
        <div className="marquee-wrap mt-8 pt-4 border-t border-zinc-900/80 overflow-hidden opacity-75">
          <div className="marquee-track flex items-center gap-8 text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
            {[...RAILS, ...RAILS].map((item, i) => (
              <span key={i} className="flex items-center gap-2 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60" />
                <span>{item}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
