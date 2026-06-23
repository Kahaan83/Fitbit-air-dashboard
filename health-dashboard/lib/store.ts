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
  syncStartDate: string;
  setSyncStartDate: (date: string) => void;
  syncEndDate: string;
  setSyncEndDate: (date: string) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  userAge: number;
  syncInFlight: boolean;
  setSyncInFlight: (v: boolean) => void;
  previousLiveData: any | null;
  syncProgress: { step: string; done: number; total: number } | null;
  fetchLiveData: (dateRange?: { start_date: string; end_date: string }) => Promise<void>;
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
  userAge: 28,
  updateSettings: (newSettings) =>
    set((state) => {
      const nextSettings = { ...state.settings, ...newSettings };
      const updates: any = { settings: nextSettings };
      if (newSettings.age !== undefined) {
        updates.userAge = newSettings.age;
      }
      return updates;
    }),
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
  theme: "premium",
  setTheme: (t) => {
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("data-theme", t);
      localStorage.setItem("theme", t);
    }
    set({ theme: t });
  },
  syncStartDate: "",
  setSyncStartDate: (date) => set({ syncStartDate: date }),
  syncEndDate: "",
  setSyncEndDate: (date) => set({ syncEndDate: date }),
  isSettingsOpen: false,
  setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
  syncInFlight: false,
  setSyncInFlight: (v) => set({ syncInFlight: v }),
  previousLiveData: null,
  syncProgress: null,
  fetchLiveData: (dateRange) => {
    const { syncInFlight, syncStartDate, syncEndDate } = useDashboardStore.getState();
    if (syncInFlight) {
      console.debug("Sync already in flight — skipping duplicate call");
      return Promise.resolve();
    }

    set({
      syncInFlight: true,
      previousLiveData: useDashboardStore.getState().liveData,
      isLoadingLiveData: true,
      syncProgress: null,
    });

    const start = dateRange?.start_date || syncStartDate;
    const end = dateRange?.end_date || syncEndDate;

    const url = `/api/live-data?start_date=${start}&end_date=${end}`;

    return new Promise<void>((resolve, reject) => {
      const es = new EventSource(url);

      es.addEventListener("progress", (e: MessageEvent) => {
        try {
          const progressData = JSON.parse(e.data);
          set({ syncProgress: progressData });
        } catch (err) {
          console.error("Failed to parse progress event:", err);
        }
      });

      es.addEventListener("complete", (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          set({
            liveData: payload,
            lastSync: new Date().toISOString(),
            dataMode: "live",
            isLoadingLiveData: false,
            syncInFlight: false,
            syncProgress: null,
          });
          useDashboardStore.getState().addToast("Synchronized physiological data successfully!", "success");
          es.close();
          resolve();
        } catch (err) {
          console.error("Failed to parse complete event:", err);
          set({ isLoadingLiveData: false, syncInFlight: false });
          useDashboardStore.getState().addToast("Failed to parse sync data.", "error");
          es.close();
          reject(new Error("Failed to parse sync data"));
        }
      });

      es.addEventListener("error", (e) => {
        console.error("SSE connection error:", e);
        set({ isLoadingLiveData: false, syncInFlight: false });
        useDashboardStore.getState().addToast("Synchronization connection failed.", "error");
        es.close();
        reject(new Error("SSE sync failed"));
      });
    });
  },
}));
