"use client";

import React from "react";
import { useDashboardStore } from "@/lib/store";

export default function SyncProgressBar() {
  const { isLoadingLiveData, syncProgress } = useDashboardStore();

  if (!isLoadingLiveData) return null;

  const done = syncProgress?.done ?? 0;
  const total = syncProgress?.total ?? 8;
  const step = syncProgress?.step ?? "initializing";
  const percentage = Math.min(100, Math.round((done / total) * 100));

  // Format step name nicely
  const stepLabel = step
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return (
    <>
      {/* Progress Bar Line */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: "rgba(16, 185, 129, 0.15)",
          zIndex: 9999,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percentage}%`,
            background: "linear-gradient(90deg, #10b981, #34d399)",
            transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: "0 0 8px rgba(16, 185, 129, 0.5)",
          }}
        />
      </div>

      {/* Floating Status Toast */}
      <div
        style={{
          position: "fixed",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9998,
          background: "var(--bg-card)",
          border: "0.5px solid var(--border-subtle)",
          borderRadius: 20,
          padding: "6px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--text-primary)",
          letterSpacing: "0.02em",
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#10b981",
            boxShadow: "0 0 6px #10b981",
          }}
        />
        <span>
          Fetching {stepLabel}... ({done}/{total})
        </span>
      </div>
    </>
  );
}
