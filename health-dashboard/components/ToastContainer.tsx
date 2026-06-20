"use client";

import React from "react";
import { useDashboardStore } from "@/lib/store";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

export function ToastContainer() {
  const toasts = useDashboardStore((state) => state.toasts);
  const removeToast = useDashboardStore((state) => state.removeToast);

  return (
    <div className="fixed top-0 right-0 z-50 flex flex-col space-y-2 p-4 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let bgClass = "bg-[var(--bg-card)] border-[var(--border-medium)] text-[var(--text-primary)]";
        let icon = <Info className="h-4 w-4 text-[var(--accent-primary)]" />;

        if (toast.type === "success") {
          bgClass = "bg-[var(--accent-green)]/10 border-[var(--accent-green)]/30 text-[var(--accent-green)]";
          icon = <CheckCircle className="h-4 w-4 text-[var(--accent-green)]" />;
        } else if (toast.type === "error") {
          bgClass = "bg-[var(--accent-red)]/10 border-[var(--accent-red)]/30 text-[var(--accent-red)]";
          icon = <AlertCircle className="h-4 w-4 text-[var(--accent-red)]" />;
        } else if (toast.type === "info") {
          bgClass = "bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30 text-[var(--accent-primary)]";
          icon = <Info className="h-4 w-4 text-[var(--accent-primary)]" />;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-xl transition-all duration-300 animate-slideIn ${bgClass}`}
          >
            <div className="flex items-center gap-2">
              {icon}
              <span className="text-xs font-semibold tracking-wide leading-tight">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="rounded-lg p-0.5 opacity-80 hover:opacity-100 transition-opacity shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default ToastContainer;
