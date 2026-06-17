"use client";

import React, { useState, useEffect } from "react";
import { useDashboardStore } from "@/lib/store";
import { X, Check, Cloud, RefreshCw, Key, Shield, User, Heart } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings, dataMode, setDataMode } = useDashboardStore();

  // Local state for settings form
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [age, setAge] = useState(28);
  const [maxHR, setMaxHR] = useState(185);
  const [restingHR, setRestingHR] = useState(58);
  const [targetSleepHours, setTargetSleepHours] = useState(8);
  const [loading, setLoading] = useState(false);

  // Sync state from store when modal opens or settings change
  useEffect(() => {
    setClientId(settings.clientId);
    setClientSecret(settings.clientSecret);
    setAge(settings.age);
    setMaxHR(settings.maxHR);
    setRestingHR(settings.restingHR);
    setTargetSleepHours(settings.targetSleepHours);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Save to Zustand store settings configuration
    updateSettings({
      clientId,
      clientSecret,
      age,
      maxHR,
      restingHR,
      targetSleepHours,
    });

    try {
      console.log("Checking OAuth token status...");
      const statusRes = await fetch("/api/status");
      const statusData = await statusRes.json();

      if (statusData.token_valid) {
        console.log("Token valid! Fetching live health metrics payload...");
        const liveRes = await fetch("/api/live-data");
        
        if (!liveRes.ok) {
          throw new Error("Failed to extract data payload from Python gateway.");
        }
        
        const livePayload = await liveRes.json();
        
        // Populate live data in store
        const { setLiveData, setLastSync } = useDashboardStore.getState();
        setLiveData(livePayload);
        setLastSync(new Date().toISOString());
        setDataMode("live");
        
        alert("Connected — Live Data Mode active! Successfully synced physiological measurements.");
        onClose();
      } else {
        alert(
          "OAuth token not found or invalid.\n\nPlease ensure you run the Python service (localhost:8000) and complete the browser authentication flow first."
        );
        setDataMode("sample");
      }
    } catch (err: any) {
      console.error("Connection error:", err);
      alert(
        "Could not connect to Google Health Gateway.\n\nPlease verify that the FastAPI backend is running on http://127.0.0.1:8000 and that you have completed the OAuth flow."
      );
      setDataMode("sample");
    } finally {
      setLoading(false);
    }
  };

  const handleResetToSample = () => {
    setDataMode("sample");
    alert("Reset dashboard to Sample Data Mode.");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-hidden">
        {/* Backdrop overlay */}
        <div
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300"
          aria-hidden="true"
        />

        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
          <div className="pointer-events-auto w-screen max-w-md transform transition-all duration-300 ease-in-out">
            <div className="flex h-full flex-col overflow-y-scroll border-l border-white/10 bg-slate-900 shadow-2xl">
              {/* Header */}
              <div className="px-6 py-5 border-b border-white/15 bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="h-5 w-5 text-indigo-400" />
                    <h2 className="text-lg font-bold text-white" id="slide-over-title">
                      Dashboard Settings
                    </h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors duration-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSave} className="flex-1 space-y-6 px-6 py-6 text-sm">
                {/* Mode Select Section */}
                <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-slate-200">Data Source</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Toggle between mock and live data</p>
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
                                alert("Live data fetch failed. Ensure your Python backend is running.");
                              }
                            } else {
                              alert("No valid Google OAuth token found. Click 'Save & Connect Gateway' below to log in.");
                            }
                          } catch (err) {
                            alert("Backend is offline. Please make sure the Python server is running on port 8000.");
                          } finally {
                            setLoading(false);
                          }
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        dataMode === "live" ? "bg-indigo-600" : "bg-slate-700"
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

                {/* API Credentials */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-indigo-400 font-semibold border-b border-white/5 pb-1">
                    <Key className="h-4 w-4" />
                    <span>Google Cloud Credentials</span>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1.5">GCP Client ID</label>
                    <input
                      type="text"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="OAuth 2.0 Client ID..."
                      className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1.5">GCP Client Secret</label>
                    <input
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="••••••••••••••••••••••••"
                      className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Baselines Configuration */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-indigo-400 font-semibold border-b border-white/5 pb-1">
                    <User className="h-4 w-4" />
                    <span>Physiological Baselines</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 font-medium mb-1.5">Age</label>
                      <input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(parseInt(e.target.value) || 28)}
                        className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-medium mb-1.5">Target Sleep (hrs)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={targetSleepHours}
                        onChange={(e) => setTargetSleepHours(parseFloat(e.target.value) || 8)}
                        className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 font-medium mb-1.5">Resting HR (bpm)</label>
                      <input
                        type="number"
                        value={restingHR}
                        onChange={(e) => setRestingHR(parseInt(e.target.value) || 58)}
                        className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-medium mb-1.5">Tested Max HR (bpm)</label>
                      <input
                        type="number"
                        value={maxHR}
                        onChange={(e) => setMaxHR(parseInt(e.target.value) || 185)}
                        className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Google Health scopes checklist */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-indigo-400 font-semibold border-b border-white/5 pb-1">
                    <Shield className="h-4 w-4" />
                    <span>OAuth Required Scopes</span>
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
                      <div key={i} className="flex gap-2.5 rounded-lg border border-white/5 bg-slate-950/40 p-2.5">
                        <div className="mt-0.5 rounded bg-indigo-500/20 text-indigo-400 p-0.5 flex h-4 w-4 items-center justify-center border border-indigo-500/30">
                          <Check className="h-3 w-3" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-200">{scopeObj.title}</p>
                          <p className="text-[10px] text-slate-500 font-mono mb-1">{scopeObj.scope}</p>
                          <p className="text-slate-400 leading-relaxed">{scopeObj.desc}</p>
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
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 py-2.5 text-white font-bold tracking-wide transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/20 disabled:opacity-50"
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
                    className="w-full py-2.5 rounded-lg border border-white/10 bg-transparent text-slate-300 hover:bg-white/5 font-semibold text-center transition-colors"
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
