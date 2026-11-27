import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, X, CheckCircle2, AlertCircle, Shield } from "lucide-react";

export function Spinner({ size = 16, className = "" }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} />;
}

export function Skeleton({ compact = false }) {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-36 rounded-lg bg-white/[0.07]" />
      <div className={`rounded-3xl bg-white/[0.06] ${compact ? "h-28" : "h-52"}`} />
      {!compact && <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="h-32 rounded-2xl bg-white/[0.06]" /><div className="h-32 rounded-2xl bg-white/[0.06]" /></div>}
    </div>
  );
}

export function Modal({ open, onClose, title, maxWidth = "max-w-md", children, light = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#120e0b]/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || "Dialog"}
        className={`spring-modal relative w-full ${maxWidth} rounded-3xl overflow-hidden ${
          light ? "bg-white text-zinc-900 shadow-2xl" : "liquid-glass"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className={`flex items-center justify-between px-6 pt-5 pb-3 ${light ? "border-b border-zinc-100" : ""}`}>
            <h3 className={`text-base font-bold ${light ? "text-zinc-900" : "text-white"}`}>{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={`p-1 rounded-lg transition ${light ? "text-zinc-500 hover:text-zinc-900" : "text-zinc-400 hover:text-white"}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function ToastBanner({ toast }) {
  if (!toast?.message) return null;
  const isErr = toast.type === "error";
  const isInfo = toast.type === "info";
  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full px-4 sm:px-0 pointer-events-none">
      <div
        role="status"
        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md text-xs sm:text-sm panel-swap-up ${
          isErr
            ? "border-red-500/40 bg-red-950/95 text-red-100"
            : isInfo
              ? "border-amber-500/40 bg-zinc-900/95 text-zinc-100"
              : "border-emerald-500/40 bg-zinc-900/95 text-zinc-100"
        }`}
      >
        {isErr ? (
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
        ) : isInfo ? (
          <Shield className="w-4 h-4 shrink-0 text-amber-400" />
        ) : (
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
        )}
        <span className="flex-1">{toast.message}</span>
      </div>
    </div>
  );
}

export function FrostedSelect({ value, onChange, options, placeholder, className = "w-full" }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.095] text-zinc-200 text-xs text-left transition"
      >
        <span className="truncate">{selected ? selected.label : placeholder || "Select..."}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-amber-300/80 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="dropdown-pop-in absolute left-0 right-0 mt-1.5 p-1.5 rounded-2xl bg-[#221c17]/95 backdrop-blur-2xl shadow-2xl z-50 max-h-60 overflow-y-auto no-scrollbar">
          {options.map((opt) => {
            const isSel = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs text-left transition ${
                  isSel ? "bg-amber-400/15 text-amber-200 font-semibold" : "text-zinc-300 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSel && <Check className="w-3.5 h-3.5 text-amber-300 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
