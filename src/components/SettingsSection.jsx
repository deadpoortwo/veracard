import React, { useEffect, useState } from "react";
import { ChevronRight, PlayCircle, KeyRound, LogOut, Phone, Shield, Mail, Send, Smartphone, X, Check, AlertTriangle, Zap } from "lucide-react";
import { api } from "../api.js";
import { FrostedSelect, Modal } from "./UiPrimitives.jsx";
import { createTranslator } from "../i18n.js";

const COUNTRIES = [
  { value: "", label: "Select country..." },
  { value: "SG", label: "Singapore (SG)" },
  { value: "US", label: "United States (US)" },
  { value: "GB", label: "United Kingdom (GB)" },
  { value: "HK", label: "Hong Kong (HK)" },
  { value: "CN", label: "China (CN)" },
];

const GENDERS = [
  { value: "", label: "MALE or FEMALE" },
  { value: "MALE", label: "MALE" },
  { value: "FEMALE", label: "FEMALE" },
];

export function SettingsSection({ account, lang, onChangeLang, onReplayTour, onSignOut, notify }) {
  const t = createTranslator(lang);
  const [tab, setTab] = useState("profile"); // profile | security | notifications | language
  const [prefs, setPrefs] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    country: "",
    dob: "",
    gender: "",
    twoFactor: "off",
    notifTx: true,
    notifFreeze: true,
    notifLowBal: true,
    notifPromo: false,
  });
  const [saving, setSaving] = useState(false);
  const [tgModal, setTgModal] = useState(false);
  const [tgCode, setTgCode] = useState("");

  useEffect(() => {
    api
      .preferences()
      .then((saved) => {
        if (saved && typeof saved === "object") setPrefs((p) => ({ ...p, ...saved }));
      })
      .catch(() => {});
  }, [account?.id]);

  const savePrefs = async (next = prefs) => {
    setSaving(true);
    try {
      await api.savePreferences(next);
      notify(lang === "中文" ? "设置已保存" : "Preferences saved");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const openTelegramPair = async () => {
    setTgModal(true);
    try {
      const res = await api.pairTelegram();
      setTgCode(res.code || "123456");
    } catch {
      setTgCode("123456");
    }
  };

  const emailDisplay = account?.email || "account@veracard.io";
  const initials = emailDisplay.slice(0, 2).toUpperCase();

  const tabs = [
    { id: "profile", label: lang === "中文" ? "个人资料" : "Profile", sub: lang === "中文" ? "姓名、邮箱、电话" : "Name, email, phone" },
    { id: "security", label: lang === "中文" ? "安全" : "Security", sub: lang === "中文" ? "修改密码、两步验证" : "Password, 2FA" },
    { id: "notifications", label: lang === "中文" ? "通知" : "Notifications", sub: lang === "中文" ? "推送通知、电子邮件" : "Push, email alerts" },
    { id: "language", label: lang === "中文" ? "语言" : "Language", sub: lang === "中文" ? "英语、中文" : "English, Chinese" },
  ];

  return (
    <div className="space-y-6 panel-swap-up">
      <div>
        <h1 className="text-xl font-bold text-white">{t("navSettings")}</h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          {lang === "中文" ? "管理您的账户偏好设置" : "Manage your account preferences"}
        </p>
      </div>

      {/* Profile Banner */}
      <div className="float-card rounded-2xl bg-gradient-to-r from-white/[0.08] via-[#241e19]/85 to-[#33271a]/75 p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center font-bold text-amber-400 text-base">
          {initials}
        </div>
        <div>
          <div className="text-sm font-bold text-white">
            {[prefs.firstName, prefs.lastName].filter(Boolean).join(" ") || "VeraCard Account"}
          </div>
          <div className="text-xs text-zinc-400">{emailDisplay}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Settings Nav */}
        <div className="md:col-span-4 space-y-2 md:sticky md:top-20 self-start">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={`float-card w-full px-4 py-3 rounded-xl text-left flex items-center justify-between transition ${
                tab === tb.id ? "bg-amber-500/15 text-amber-400" : "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.09]"
              }`}
            >
              <div>
                <div className="text-xs font-semibold">{tb.label}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{tb.sub}</div>
              </div>
              {tab === tb.id && <ChevronRight className="w-4 h-4 text-amber-400" />}
            </button>
          ))}

          <div className="pt-3 mt-3 border-t border-white/[0.07] space-y-1.5">
            <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">QUICK ACTIONS</div>
            <button
              type="button"
              onClick={onReplayTour}
              className="float-card w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] text-left text-xs text-amber-400 flex items-center gap-2"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>{lang === "中文" ? "重新观看引导教程" : "Replay Setup Guide"}</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("security")}
              className="float-card w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] text-left text-xs text-zinc-300 flex items-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5 text-zinc-400" />
              <span>{lang === "中文" ? "修改密码" : "Change Password"}</span>
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="float-card w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] text-left text-xs text-red-400 flex items-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t("signOut")}</span>
            </button>
          </div>
        </div>

        {/* Right Settings Content */}
        <div className="md:col-span-8 rounded-3xl liquid-glass p-6 space-y-5">
          {tab === "profile" && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  savePrefs();
                }}
                className="space-y-4 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1.5">{lang === "中文" ? "名字" : "FIRST NAME"}</label>
                    <input
                      type="text"
                      value={prefs.firstName}
                      onChange={(e) => setPrefs({ ...prefs, firstName: e.target.value })}
                      placeholder="John"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1.5">{lang === "中文" ? "姓氏" : "LAST NAME"}</label>
                    <input
                      type="text"
                      value={prefs.lastName}
                      onChange={(e) => setPrefs({ ...prefs, lastName: e.target.value })}
                      placeholder="Doe"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1.5">{lang === "中文" ? "邮箱" : "EMAIL"}</label>
                  <input type="text" readOnly value={emailDisplay} className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] text-zinc-400" />
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1.5">{lang === "中文" ? "手机号" : "PHONE"}</label>
                  <input
                    type="tel"
                    value={prefs.phone}
                    onChange={(e) => setPrefs({ ...prefs, phone: e.target.value })}
                    placeholder="+1 5551234567"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] text-white focus:outline-none"
                  />
                </div>

                {/* Telegram Verification */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <Phone className="w-4 h-4 text-amber-400" />
                    <span>{lang === "中文" ? "手机号码验证" : "Phone verification"}</span>
                  </div>
                  <div className="rounded-xl bg-white/[0.06] p-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-zinc-400">
                      {lang === "中文"
                        ? "通过 Telegram 验证您的手机号码，无需输入短信验证码。"
                        : "Verify your phone via Telegram without SMS codes."}
                    </span>
                    <button
                      type="button"
                      onClick={openTelegramPair}
                      className="px-4 py-2 rounded-xl magnetic-btn bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] text-[#14110e] font-semibold shrink-0"
                    >
                      {lang === "中文" ? "通过 Telegram 验证" : "Verify via Telegram"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1.5">{lang === "中文" ? "国家/地区" : "COUNTRY"}</label>
                    <FrostedSelect
                      value={prefs.country}
                      onChange={(v) => setPrefs({ ...prefs, country: v })}
                      options={COUNTRIES}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1.5">{lang === "中文" ? "出生日期" : "DATE OF BIRTH"}</label>
                    <input
                      type="date"
                      value={prefs.dob}
                      onChange={(e) => setPrefs({ ...prefs, dob: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] text-zinc-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1.5">{lang === "中文" ? "性别" : "GENDER"}</label>
                    <FrostedSelect
                      value={prefs.gender}
                      onChange={(v) => setPrefs({ ...prefs, gender: v })}
                      options={GENDERS}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 rounded-xl magnetic-btn bg-gradient-to-r from-[#f3dfb8] via-[#e4c082] to-[#cfa057] text-[#14110e] font-semibold text-sm"
                >
                  {saving ? (lang === "中文" ? "保存中..." : "Saving...") : lang === "中文" ? "保存更改" : "Save Changes"}
                </button>
              </form>

              <div className="pt-5 border-t border-white/[0.07] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>{lang === "中文" ? "自动充值" : "Auto Top-Up"}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px]">0 GAS</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {lang === "中文"
                    ? "当 USDT 或 USDC 转入您的钱包时自动为已激活卡片充值，无需手动操作。"
                    : "Automatically load incoming USDT/USDC onto your verified active card with zero gas."}
                </p>
              </div>
            </>
          )}

          {tab === "security" && (
            <div className="space-y-5 text-xs">
              <div className="space-y-2">
                <div className="text-sm font-bold text-white">{lang === "中文" ? "账户密码" : "Account Password"}</div>
                <p className="text-zinc-400">
                  {lang === "中文"
                    ? "如需重置账户登录密码，请退出登录后通过邮箱验证码完成重置。"
                    : "To reset your account login password, sign out and use Forgot Password with email verification."}
                </p>
              </div>

              <div className="space-y-3 pt-2 border-t border-white/[0.07]">
                <div className="flex items-center gap-2 font-bold text-white">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>{lang === "中文" ? "两步验证" : "Two-factor authentication"}</span>
                </div>
                <div className="space-y-2.5">
                  {[
                    { id: "off", Icon: X, title: lang === "中文" ? "关闭" : "Off", sub: lang === "中文" ? "登录时不需要额外步骤。" : "No extra step when signing in." },
                    { id: "email", Icon: Mail, title: lang === "中文" ? "邮箱" : "Email", sub: lang === "中文" ? "每次登录通过邮件接收一次性验证码。" : "Receive a one-time code by email." },
                    { id: "telegram", Icon: Send, title: "Telegram", sub: lang === "中文" ? "通过 Telegram 接收验证码。" : "Receive one-time codes via Telegram." },
                    { id: "auth", Icon: Smartphone, title: lang === "中文" ? "身份验证器应用" : "Authenticator app", sub: "Google Authenticator, Authy, 1Password..." },
                  ].map((opt) => {
                    const sel = prefs.twoFactor === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          const next = { ...prefs, twoFactor: opt.id };
                          setPrefs(next);
                          savePrefs(next);
                        }}
                        className={`w-full p-3.5 rounded-xl flex items-center justify-between gap-3 text-left transition ${
                          sel ? "bg-amber-500/15 text-white" : "bg-white/[0.05] text-zinc-300 hover:bg-white/[0.08]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <opt.Icon className={`w-4 h-4 shrink-0 ${sel ? "text-amber-400" : "text-zinc-500"}`} />
                          <div>
                            <div className="font-semibold">{opt.title}</div>
                            <div className="text-[11px] text-zinc-400 mt-0.5">{opt.sub}</div>
                          </div>
                        </div>
                        {sel && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <div className="rounded-xl bg-amber-500/10 p-3.5 flex items-start gap-2.5 text-[11px] text-amber-300 leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    {lang === "中文"
                      ? "请务必备份您的身份验证器应用；丢失设备后客服无法重置。"
                      : "Back up your authenticator app; support cannot reset lost authenticator devices."}
                  </span>
                </div>
              </div>
            </div>
          )}

          {tab === "notifications" && (
            <div className="space-y-4">
              <div className="text-sm font-bold text-white">{lang === "中文" ? "通知偏好" : "Notifications"}</div>
              <div className="rounded-xl bg-white/[0.06] p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                    <Send className="w-4 h-4 text-amber-400" />
                  </span>
                  <div>
                    <div className="text-xs font-bold text-white">
                      {lang === "中文" ? "Telegram 通知" : "Telegram Notifications"}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {lang === "中文" ? "通过 Telegram 接收实时交易与安全提醒" : "Receive real-time alerts via Telegram"}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openTelegramPair}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#f3dfb8] to-[#d4a96a] text-[#14110e] font-semibold text-xs"
                >
                  {lang === "中文" ? "关联账号" : "Link Account"}
                </button>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {[
                  { key: "notifTx", title: lang === "中文" ? "交易实时提醒" : "Transaction Alerts", desc: lang === "中文" ? "每笔消费或入账时发送通知" : "Notify on every card spend or deposit" },
                  { key: "notifFreeze", title: lang === "中文" ? "锁卡 / 解冻提醒" : "Freeze & Unfreeze Alerts", desc: lang === "中文" ? "卡片状态变更时立即提醒" : "Instant alert when card status changes" },
                  { key: "notifLowBal", title: lang === "中文" ? "低余额预警" : "Low Balance Warning", desc: lang === "中文" ? "余额低于 $10 时提醒" : "Alert when balance drops below $10" },
                  { key: "notifPromo", title: lang === "中文" ? "产品更新与活动" : "Product Updates", desc: lang === "中文" ? "接收 VeraCard 新功能与返佣活动" : "Receive VeraCard news & rewards" },
                ].map((item) => (
                  <div key={item.key} className="py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold text-white">{item.title}</div>
                      <div className="text-[11px] text-zinc-400">{item.desc}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...prefs, [item.key]: !prefs[item.key] };
                        setPrefs(next);
                        savePrefs(next);
                      }}
                      className={`w-11 h-6 rounded-full p-0.5 transition ${prefs[item.key] ? "bg-amber-500" : "bg-zinc-700"}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-zinc-950 transition transform ${prefs[item.key] ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "language" && (
            <div className="space-y-5">
              <div>
                <div className="text-sm font-bold text-white">{lang === "中文" ? "语言" : "Language"}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{lang === "中文" ? "选择界面显示语言" : "Select display language"}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onChangeLang("EN")}
                  className={`py-3 rounded-xl text-xs font-medium transition ${
                    lang === "EN" ? "bg-amber-500/20 text-amber-300 font-semibold" : "bg-zinc-950 text-zinc-400"
                  }`}
                >
                  EN English
                </button>
                <button
                  type="button"
                  onClick={() => onChangeLang("中文")}
                  className={`py-3 rounded-xl text-xs font-medium transition ${
                    lang === "中文" ? "bg-amber-500/20 text-amber-300 font-semibold" : "bg-zinc-950 text-zinc-400"
                  }`}
                >
                  CN 中文
                </button>
              </div>
              <div className="space-y-1.5 pt-3 border-t border-white/[0.06]">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                  {lang === "中文" ? "货币" : "CURRENCY"}
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 text-xs font-semibold text-amber-400">$ USD</div>
                <div className="text-[11px] text-zinc-500">
                  {lang === "中文" ? "目前仅支持美元结算" : "Only USD is supported at this time"}
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t border-white/[0.06]">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                  {lang === "中文" ? "外观" : "APPEARANCE"}
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-950 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">{lang === "中文" ? "深色模式" : "Dark Mode"}</div>
                    <div className="text-[11px] text-zinc-500">
                      {lang === "中文" ? "应用默认使用深色主题" : "App uses dark mode by default"}
                    </div>
                  </div>
                  <div className="w-10 h-5 rounded-full bg-amber-500 p-0.5 flex justify-end opacity-80">
                    <div className="w-4 h-4 rounded-full bg-zinc-950" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal open={tgModal} onClose={() => setTgModal(false)} title={lang === "中文" ? "通过 Telegram 验证" : "Verify via Telegram"}>
        <div className="px-6 pb-6 text-center space-y-4">
          <p className="text-xs text-zinc-400">
            {lang === "中文"
              ? "在 Telegram 机器人中输入以下配对码以关联您的手机号："
              : "Enter this pairing code in the VeraCard Telegram bot to link your phone:"}
          </p>
          <div className="p-3 rounded-xl bg-zinc-950 font-mono text-lg font-bold tracking-widest text-amber-400">
            {tgCode || "123456"}
          </div>
          <button
            type="button"
            onClick={() => setTgModal(false)}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#f3dfb8] to-[#d4a96a] text-[#14110e] font-semibold text-xs"
          >
            {lang === "中文" ? "完成" : "Done"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
