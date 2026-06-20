import { create } from "zustand";

export interface Settings {
  maxHR: number;
  restingHR: number;
  targetSleepHours: number;
  age: number;
  scopes: string[];
}

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
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
  isLoadingLiveData: boolean;
  setIsLoadingLiveData: (loading: boolean) => void;
  toasts: Toast[];
  addToast: (message: string, type?: "success" | "error" | "info") => void;
  removeToast: (id: string) => void;
  theme: "premium" | "whoop";
  setTheme: (theme: "premium" | "whoop") => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  dataMode: "sample",
  setDataMode: (mode) => set({ dataMode: mode }),
  lastSync: null,
  setLastSync: (ts) => set({ lastSync: ts }),
  settings: {
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
  isLoadingLiveData: false,
  setIsLoadingLiveData: (loading) => set({ isLoadingLiveData: loading }),
  toasts: [],
  addToast: (message, type = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 3000);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  theme: typeof window !== "undefined" ? (localStorage.getItem("theme") as "premium" | "whoop") ?? "premium" : "premium",
  setTheme: (t) => {
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("data-theme", t);
      localStorage.setItem("theme", t);
    }
    set({ theme: t });
  },
}));
