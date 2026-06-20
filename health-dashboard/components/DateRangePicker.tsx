"use client";

import React, { useState, useEffect } from "react";
import { useDashboardStore } from "@/lib/store";
import { Calendar, RefreshCw } from "lucide-react";

const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function DateRangePicker() {
  const {
    syncStartDate,
    syncEndDate,
    setSyncStartDate,
    setSyncEndDate,
    dataMode,
    addToast,
    setLiveData,
    setLastSync,
    setIsLoadingLiveData,
  } = useDashboardStore();

  const [activePreset, setActivePreset] = useState<"7d" | "30d" | "90d" | "custom">("30d");
  const [isSyncing, setIsSyncing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Validation logic for custom date ranges
  useEffect(() => {
    if (!mounted) return;
    if (activePreset !== "custom") {
      setValidationError(null);
      return;
    }
    if (!syncStartDate || !syncEndDate) {
      setValidationError("Start and end dates must not be empty");
      return;
    }

    const startDateObj = new Date(syncStartDate + "T00:00:00");
    const endDateObj = new Date(syncEndDate + "T00:00:00");

    const today = new Date();
    const todayLocalMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (startDateObj > todayLocalMidnight || endDateObj > todayLocalMidnight) {
      setValidationError("Dates cannot be in the future");
      return;
    }

    if (startDateObj > endDateObj) {
      setValidationError("End date must be after start date");
      return;
    }

    const diffTime = Math.abs(endDateObj.getTime() - startDateObj.getTime());
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 90) {
      setValidationError("Date range cannot exceed 90 days");
      return;
    }

    setValidationError(null);
  }, [syncStartDate, syncEndDate, activePreset, mounted]);

  // Initialize dates safely on mount to prevent SSR hydration mismatches
  useEffect(() => {
    setMounted(true);
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const todayStr = getLocalDateString(today);
    const thirtyAgoStr = getLocalDateString(thirtyDaysAgo);

    if (!syncStartDate) setSyncStartDate(thirtyAgoStr);
    if (!syncEndDate) setSyncEndDate(todayStr);
  }, [syncStartDate, syncEndDate, setSyncStartDate, setSyncEndDate]);

  const handlePresetChange = (preset: "7d" | "30d" | "90d" | "custom") => {
    setActivePreset(preset);
    if (preset === "custom") return;

    const today = new Date();
    const start = new Date();
    
    if (preset === "7d") {
      start.setDate(today.getDate() - 7);
    } else if (preset === "30d") {
      start.setDate(today.getDate() - 30);
    } else if (preset === "90d") {
      start.setDate(today.getDate() - 90);
    }

    setSyncStartDate(getLocalDateString(start));
    setSyncEndDate(getLocalDateString(today));
  };

  const handleSync = async () => {
    if (dataMode !== "live") {
      addToast("Switch to Live Data Mode to sync with Google Health API.", "info");
      return;
    }

    if (!syncStartDate || !syncEndDate) {
      addToast("Please select a valid date range.", "error");
      return;
    }

    setIsSyncing(true);
    setIsLoadingLiveData(true);
    try {
      const res = await fetch("/api/trigger-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start_date: syncStartDate,
          end_date: syncEndDate,
        }),
      });

      if (res.status === 429) {
        const data = await res.json();
        addToast(`Sync cooldown active. Please wait ${data.retry_after}s before syncing again.`, "error");
        return;
      }

      if (!res.ok) {
        let errorMsg = "Synchronization request failed.";
        try {
          const errData = await res.json();
          if (errData?.message) errorMsg = errData.message;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      addToast("Synchronized physiological data successfully!", "success");

      // Reload cached payload from backend
      const liveRes = await fetch("/api/live-data");
      if (liveRes.ok) {
        const payload = await liveRes.json();
        setLiveData(payload);
        setLastSync(new Date().toISOString());
      } else {
        addToast("Data synced, but failed to fetch fresh cache from backend.", "error");
      }
    } catch (err: any) {
      console.error(err);
      addToast(`Sync failed: ${err.message || "Unknown error"}`, "error");
    } finally {
      setIsSyncing(false);
      setIsLoadingLiveData(false);
    }
  };

  if (!mounted) {
    return (
      <div className="h-9 w-48 animate-pulse rounded-lg bg-[var(--border-subtle)]" />
    );
  }

  return (
    <div className="flex flex-col gap-1 items-end sm:items-start lg:items-end">
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-[var(--bg-card)]/50 border border-[var(--border-soft)] rounded-xl p-1.5 text-xs">
        {/* Preset selection tabs */}
        <div className="flex bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-lg p-0.5">
          {(["7d", "30d", "90d", "custom"] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handlePresetChange(preset)}
              className={`px-3 py-1 rounded-md font-semibold transition-all uppercase cursor-pointer ${
                activePreset === preset
                  ? "bg-[var(--accent-primary)] text-[var(--bg-base)] shadow-sm font-bold"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Date input boxes for Custom range */}
        {activePreset === "custom" && (
          <div className="flex items-center gap-2 animate-fadeIn">
            <input
              type="date"
              value={syncStartDate}
              onChange={(e) => setSyncStartDate(e.target.value)}
              disabled={isSyncing}
              className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-base)] px-2.5 py-1 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors disabled:opacity-50 cursor-pointer"
            />
            <span className="text-[var(--text-secondary)] font-medium">to</span>
            <input
              type="date"
              value={syncEndDate}
              onChange={(e) => setSyncEndDate(e.target.value)}
              disabled={isSyncing}
              className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-base)] px-2.5 py-1 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors disabled:opacity-50 cursor-pointer"
            />
          </div>
        )}

        {/* Sync Action Button */}
        <button
          type="button"
          onClick={handleSync}
          disabled={isSyncing || !!validationError}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold tracking-wide transition-all uppercase shadow-md cursor-pointer select-none focus:outline-none ${
            dataMode === "live"
              ? "border-[var(--accent-primary)]/45 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 shadow-[0_0_8px_-2px_rgba(124,109,250,0.2)]"
              : "border-[var(--border-medium)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          } disabled:opacity-50`}
          title={dataMode === "live" ? "Sync data for range" : "Live data mode required"}
        >
          <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
          <span>{isSyncing ? "Syncing..." : "Sync"}</span>
        </button>
      </div>
      {activePreset === "custom" && validationError && (
        <span className="text-red-500 text-[10px] font-semibold pr-2 select-none animate-fadeIn">
          {validationError}
        </span>
      )}
    </div>
  );
}

export default DateRangePicker;
