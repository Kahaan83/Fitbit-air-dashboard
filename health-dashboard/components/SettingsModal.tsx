"use client";

import React, { useState, useEffect, useRef } from "react";
import { useDashboardStore } from "@/lib/store";
import { X, RefreshCw, Check } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings, dataMode, setDataMode, addToast, setIsLoadingLiveData, theme, setTheme } = useDashboardStore();

  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;

      const modalElement = modalRef.current;
      if (modalElement) {
        const focusableElements = modalElement.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
          return;
        }

        if (e.key === "Tab") {
          const modalElement = modalRef.current;
          if (!modalElement) return;

          const focusableElements = Array.from(
            modalElement.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          );

          if (focusableElements.length === 0) {
            e.preventDefault();
            return;
          }

          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement.focus();
              e.preventDefault();
            }
          }
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [isOpen, onClose]);

  // Local state for settings form
  const [clientId, setClientId] = useState("");
  const [age, setAge] = useState(28);
  const [maxHR, setMaxHR] = useState(185);
  const [restingHR, setRestingHR] = useState(58);
  const [targetSleepHours, setTargetSleepHours] = useState(8);
  const [loading, setLoading] = useState(false);

  // Sync state from store when modal opens or settings change
  useEffect(() => {
    if (isOpen) {
      setClientId("");
    }
    setAge(settings.age);
    setMaxHR(settings.maxHR);
    setRestingHR(settings.restingHR);
    setTargetSleepHours(settings.targetSleepHours);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    useDashboardStore.getState().setIsLoadingLiveData(true);

    let success = false;
    try {
      // 1. Send settings/credentials to the backend
      const settingsRes = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
          age,
          maxHR,
          restingHR,
          targetSleepHours,
        }),
      });

      if (!settingsRes.ok) {
        let errMsg = "Failed to save settings to Python gateway.";
        try {
          const errData = await settingsRes.json();
          if (errData && errData.message) {
            errMsg = errData.message;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      // Save to Zustand store settings configuration
      updateSettings({
        age,
        maxHR,
        restingHR,
        targetSleepHours,
      });

      // Clear the clientId local state so it is not sitting in memory
      setClientId("");

      console.log("Checking OAuth token status...");
      const statusRes = await fetch("/api/status");
      const statusData = await statusRes.json();

      if (statusData.token_valid) {
        console.log("Token valid! Fetching live health metrics payload...");
        const liveRes = await fetch("/api/live-data");
        
        if (!liveRes.ok) {
          let errMsg = "Failed to extract data payload from Python gateway.";
          try {
            const errData = await liveRes.json();
            if (errData && errData.message) {
              errMsg = errData.message;
            }
          } catch (_) {}
          throw new Error(errMsg);
        }
        
        const livePayload = await liveRes.json();
        
        // Populate live data in store
        const { setLiveData, setLastSync } = useDashboardStore.getState();
        setLiveData(livePayload);
        setLastSync(new Date().toISOString());
        setDataMode("live");
        success = true;
        useDashboardStore.getState().setIsLoadingLiveData(false);
        
        addToast("Connected — Live Data Mode active! Successfully synced physiological measurements.", "success");
        onClose();
      } else {
        // OAuth token not found: initiate login flow by fetching live-data which starts _run_browser_consent()
        addToast(
          "OAuth token not found. Launching browser login flow. Please complete authentication in the browser window.",
          "info"
        );
        const liveRes = await fetch("/api/live-data");
        
        if (!liveRes.ok) {
          let errMsg = "Authentication flow failed or was cancelled.";
          try {
            const errData = await liveRes.json();
            if (errData && errData.message) {
              errMsg = errData.message;
            }
          } catch (_) {}
          throw new Error(errMsg);
        }
        
        const livePayload = await liveRes.json();
        
        // Double check status to see if token is now valid
        const nextStatusRes = await fetch("/api/status");
        const nextStatusData = await nextStatusRes.json();
        
        if (nextStatusData.token_valid) {
          const { setLiveData, setLastSync } = useDashboardStore.getState();
          setLiveData(livePayload);
          setLastSync(new Date().toISOString());
          setDataMode("live");
          success = true;
          useDashboardStore.getState().setIsLoadingLiveData(false);
          addToast("Successfully connected to Google Health! Live Data Mode active.", "success");
          onClose();
        } else {
          throw new Error("Google OAuth authentication flow was not completed.");
        }
      }
    } catch (err: any) {
      console.error("Connection error:", err);
      addToast(
        `Could not connect to Google Health Gateway. Error: ${err.message}. Please verify backend configuration.`,
        "error"
      );
      setDataMode("sample");
    } finally {
      setLoading(false);
      if (!success) {
        useDashboardStore.getState().setIsLoadingLiveData(false);
      }
    }
  };

  const handleResetToSample = () => {
    setDataMode("sample");
    addToast("Reset dashboard to Sample Data Mode.", "info");
    onClose();
  };

  return (
    <div ref={modalRef} className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-hidden">
        {/* Backdrop overlay */}
        <div
          onClick={onClose}
          className="absolute inset-0 bg-[var(--bg-base)]/80 backdrop-blur-sm transition-opacity duration-300"
          aria-hidden="true"
        />

        <div className="pointer-events-none fixed inset-0 md:inset-y-0 md:right-0 md:left-auto flex max-w-full pl-0 md:pl-10">
          <div className="pointer-events-auto w-full md:w-screen max-w-none md:max-w-md transform transition-all duration-300 ease-in-out">
            <div className="flex h-full flex-col overflow-y-scroll border-0 md:border-l border-[var(--border-soft)] bg-[var(--bg-surface)] shadow-2xl">
              {/* Header */}
              <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[var(--text-primary)] text-sm" id="slide-over-title">Settings</span>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] transition-colors duration-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSave} className="flex-1 space-y-6 px-6 py-6 text-sm">
                {/* Mode Select Section */}
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)]/50 p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-[var(--text-primary)]">Data Source</h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">Toggle between mock and live data</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (dataMode === "live") {
                          setDataMode("sample");
                        } else {
                          // Try activating live mode
                          setLoading(true);
                          try {
                            const statusRes = await fetch("/api/status");
                            const statusData = await statusRes.json();
                            if (statusData.token_valid) {
                              const liveRes = await fetch("/api/live-data");
                              if (liveRes.ok) {
                                const livePayload = await liveRes.json();
                                const { setLiveData, setLastSync } = useDashboardStore.getState();
                                setLiveData(livePayload);
                                setLastSync(new Date().toISOString());
                                setDataMode("live");
                              } else {
                                addToast("Live data fetch failed. Ensure your Python backend is running.", "error");
                              }
                            } else {
                              addToast("No valid Google OAuth token found. Click 'Save & Connect Gateway' below to log in.", "error");
                            }
                          } catch (err) {
                            addToast("Backend is offline. Please make sure the Python server is running on port 8000.", "error");
                          } finally {
                            setLoading(false);
                          }
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        dataMode === "live" ? "bg-[var(--accent-primary)]" : "bg-[var(--border-medium)]"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          dataMode === "live" ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Appearance Section */}
                <div className="space-y-4">
                  <div className="text-[var(--text-secondary)] text-[11px] font-medium uppercase tracking-widest border-b border-[var(--border-subtle)] pb-1">
                    Appearance
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Premium Dark Theme Card */}
                    <button
                      type="button"
                      onClick={() => setTheme("premium")}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-left transition-all duration-200 cursor-pointer ${
                        theme === "premium"
                          ? "border-[var(--accent-primary)] bg-[var(--bg-card)] shadow-lg shadow-[var(--accent-primary)]/5"
                          : "border-[var(--border-soft)] bg-[var(--bg-card)]/30 hover:border-[var(--border-medium)] hover:bg-[var(--bg-card)]/50"
                      }`}
                    >
                      {/* 60x40px Color Swatch Grid */}
                      <div className="w-[60px] h-[40px] rounded-lg overflow-hidden border border-[var(--border-soft)] flex">
                        <div className="w-2/3 h-full p-1.5 flex flex-col gap-1 bg-[#09090F]">
                          <div className="h-1 w-full rounded-xs bg-[#16161F]" />
                          <div className="h-2 w-full rounded-xs bg-[#16161F]" />
                        </div>
                        <div className="w-1/3 h-full bg-[#7C6DFA]" />
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs font-semibold text-[var(--text-primary)]">Premium Dark</span>
                        {theme === "premium" && (
                          <Check className="h-3 w-3 text-[var(--accent-primary)]" />
                        )}
                      </div>
                    </button>

                    {/* Whoop Theme Card */}
                    <button
                      type="button"
                      onClick={() => setTheme("whoop")}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-left transition-all duration-200 cursor-pointer ${
                        theme === "whoop"
                          ? "border-[var(--accent-primary)] bg-[var(--bg-card)] shadow-lg shadow-[var(--accent-primary)]/5"
                          : "border-[var(--border-soft)] bg-[var(--bg-card)]/30 hover:border-[var(--border-medium)] hover:bg-[var(--bg-card)]/50"
                      }`}
                    >
                      {/* 60x40px Color Swatch Grid */}
                      <div className="w-[60px] h-[40px] rounded-lg overflow-hidden border border-[var(--border-soft)] flex">
                        <div className="w-2/3 h-full p-1.5 flex flex-col gap-1 bg-[#000000]">
                          <div className="h-1 w-full rounded-xs bg-[#111111]" />
                          <div className="h-2 w-full rounded-xs bg-[#111111]" />
                        </div>
                        <div className="w-1/3 h-full bg-[#00FF9C]" />
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs font-semibold text-[var(--text-primary)]">Whoop</span>
                        {theme === "whoop" && (
                          <Check className="h-3 w-3 text-[var(--accent-primary)]" />
                        )}
                      </div>
                    </button>
                  </div>
                </div>

                {/* API Credentials */}
                <div className="space-y-4">
                  <div className="text-[var(--text-secondary)] text-[11px] font-medium uppercase tracking-widest border-b border-[var(--border-subtle)] pb-1">
                    Google Cloud Credentials
                  </div>

                  <div>
                    <label className="block text-[var(--text-secondary)] font-medium mb-1.5">GCP Client ID</label>
                    <input
                      type="text"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="stored securely on backend"
                      className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Baselines Configuration */}
                <div className="space-y-4">
                  <div className="text-[var(--text-secondary)] text-[11px] font-medium uppercase tracking-widest border-b border-[var(--border-subtle)] pb-1">
                    Physiological Baselines
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[var(--text-secondary)] font-medium mb-1.5">Age</label>
                      <input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(parseInt(e.target.value) || 28)}
                        className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[var(--text-secondary)] font-medium mb-1.5">Target Sleep (hrs)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={targetSleepHours}
                        onChange={(e) => setTargetSleepHours(parseFloat(e.target.value) || 8)}
                        className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[var(--text-secondary)] font-medium mb-1.5">Resting HR (bpm)</label>
                      <input
                        type="number"
                        value={restingHR}
                        onChange={(e) => setRestingHR(parseInt(e.target.value) || 58)}
                        className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[var(--text-secondary)] font-medium mb-1.5">Tested Max HR (bpm)</label>
                      <input
                        type="number"
                        value={maxHR}
                        onChange={(e) => setMaxHR(parseInt(e.target.value) || 185)}
                        className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Google Health scopes checklist */}
                <div className="space-y-3">
                  <div className="text-[var(--text-secondary)] text-[11px] font-medium uppercase tracking-widest border-b border-[var(--border-subtle)] pb-1">
                    OAuth Required Scopes
                  </div>

                  <div className="space-y-2 text-xs">
                    {[
                      {
                        title: "Health Metrics & Measurements",
                        scope: ".../auth/googlehealth.health_metrics_and_measurements.readonly",
                        desc: "Covers raw heart rate, RMSSD HRV, resting HR, oxygen saturation (SpO2), and sleep temperature.",
                      },
                      {
                        title: "Sleep sessions",
                        scope: ".../auth/googlehealth.sleep.readonly",
                        desc: "Covers nocturnal sleep durations, start/end timestamps, and hypnogram sleep stages.",
                      },
                      {
                        title: "Activity & Fitness",
                        scope: ".../auth/googlehealth.activity_and_fitness.readonly",
                        desc: "Covers physical movements & steps (required for active/acute stress tracking filtering).",
                      },
                    ].map((scopeObj, i) => (
                      <div key={i} className="flex gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)]/40 p-2.5">
                        <span className="mt-0.5 text-[var(--text-secondary)] select-none">—</span>
                        <div>
                          <p className="font-semibold text-[var(--text-primary)]">{scopeObj.title}</p>
                          <p className="text-[10px] text-[var(--text-tertiary)] font-mono mb-1">{scopeObj.scope}</p>
                          <p className="text-[var(--text-secondary)] leading-relaxed">{scopeObj.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2.5 pt-4">
                  <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] hover:opacity-90 py-2.5 text-[var(--bg-base)] font-semibold text-sm transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      "Save & Connect Gateway"
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleResetToSample}
                    className="w-full py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm text-center transition-colors"
                  >
                    Reset to Sample Data
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default SettingsModal;
