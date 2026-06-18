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
        let bgClass = "bg-slate-700 border-slate-600";
        let icon = <Info className="h-4 w-4 text-white" />;

        if (toast.type === "success") {
          bgClass = "bg-emerald-600 border-emerald-500";
          icon = <CheckCircle className="h-4 w-4 text-white" />;
        } else if (toast.type === "error") {
          bgClass = "bg-red-600 border-red-500";
          icon = <AlertCircle className="h-4 w-4 text-white" />;
        } else if (toast.type === "info") {
          bgClass = "bg-slate-700 border-slate-600";
          icon = <Info className="h-4 w-4 text-white" />;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-white shadow-xl transition-all duration-300 animate-slideIn ${bgClass}`}
          >
            <div className="flex items-center gap-2">
              {icon}
              <span className="text-xs font-semibold tracking-wide leading-tight">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="rounded-lg p-0.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors shrink-0"
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
