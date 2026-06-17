import { create } from "zustand";

export interface Settings {
  clientId: string;
  clientSecret: string;
  maxHR: number;
  restingHR: number;
  targetSleepHours: number;
  age: number;
  scopes: string[];
}

interface DashboardState {
  dataMode: "sample" | "live";
  setDataMode: (mode: "sample" | "live") => void;
  lastSync: string | null;
  setLastSync: (ts: string | null) => void;
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;
  liveData: any | null;
  setLiveData: (data: any) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  dataMode: "sample",
  setDataMode: (mode) => set({ dataMode: mode }),
  lastSync: null,
  setLastSync: (ts) => set({ lastSync: ts }),
  settings: {
    clientId: "",
    clientSecret: "",
    maxHR: 185,
    restingHR: 58,
    targetSleepHours: 8,
    age: 28,
    scopes: [
      "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
      "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
      "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
    ],
  },
  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),
  liveData: null,
  setLiveData: (data) => set({ liveData: data }),
}));
