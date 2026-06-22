"use client";

import React from "react";
import { useDashboardStore } from "@/lib/store";

interface HeaderProps {
  date?: string;
  onPrev?: () => void;
  onNext?: () => void;
}

export default function Header({ date = "Today", onPrev, onNext }: HeaderProps = {}) {
  const { lastSync, setIsSettingsOpen } = useDashboardStore();

  const formatLastSync = () => {
    if (!lastSync) return "Not synced yet";
    try {
      const diffMs = Date.now() - new Date(lastSync).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Last synced just now";
      if (diffMins === 1) return "Last synced 1 min ago";
      return `Last synced ${diffMins} min ago`;
    } catch {
      return "Synced";
    }
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "20px 32px",
      borderBottom: "0.5px solid var(--border-soft)",
      width: "100%",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <i 
          className="ti ti-chevron-left" 
          onClick={onPrev} 
          style={{ color: "var(--text-tertiary)", cursor: "pointer", fontSize: 18 }} 
          role="button"
          aria-label="Previous day"
        />
        <div style={{ background: "var(--bg-card)", borderRadius: 20, padding: "6px 20px",
          fontWeight: 500, fontSize: 14, letterSpacing: "0.05em", color: "var(--text-primary)" }}>
          {date.toUpperCase()}
        </div>
        <i 
          className="ti ti-chevron-right" 
          onClick={onNext} 
          style={{ color: "var(--text-tertiary)", cursor: "pointer", fontSize: 18 }} 
          role="button"
          aria-label="Next day"
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{formatLastSync()}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", fontSize: 14 }}>
          <i className="ti ti-device-watch" style={{ fontSize: 20 }} />
        </div>
        <div 
          data-testid="user-profile-button"
          onClick={() => setIsSettingsOpen(true)}
          style={{ 
            width: 36, 
            height: 36, 
            borderRadius: "50%", 
            background: "var(--bg-card)",
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <i className="ti ti-user" style={{ fontSize: 16, color: "var(--text-secondary)" }} />
        </div>
      </div>
    </div>
  );
}
