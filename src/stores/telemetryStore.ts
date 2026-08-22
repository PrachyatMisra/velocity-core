import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { TelemetrySnapshot, BenchmarkResult } from "../types/telemetry";

const MAX_HISTORY = 300;

interface TelemetryStore {
  snapshot: TelemetrySnapshot | null;
  history: TelemetrySnapshot[];
  connected: boolean;
  benchmarkResults: BenchmarkResult[];
  benchmarkRunning: boolean;
  activeTab: string;

  setSnapshot: (s: TelemetrySnapshot) => void;
  addBenchmark: (r: BenchmarkResult) => void;
  setBenchmarkRunning: (v: boolean) => void;
  setActiveTab: (t: string) => void;
  getHistory: (key: string, limit?: number) => number[];
}

export const useStore = create<TelemetryStore>()(
  subscribeWithSelector((set, get) => ({
    snapshot: null,
    history: [],
    connected: false,
    benchmarkResults: [],
    benchmarkRunning: false,
    activeTab: "overview",

    setSnapshot: (snap) =>
      set((state) => {
        const h = [...state.history, snap];
        if (h.length > MAX_HISTORY) h.shift();
        return { snapshot: snap, history: h, connected: true };
      }),

    addBenchmark: (r) =>
      set((state) => ({
        benchmarkResults: [...state.benchmarkResults, r].slice(-50),
      })),

    setBenchmarkRunning: (v) => set({ benchmarkRunning: v }),
    setActiveTab: (t) => set({ activeTab: t }),

    getHistory: (key, limit = 120) => {
      const { history } = get();
      const src = limit < history.length ? history.slice(-limit) : history;
      return src.map((snap) => {
        const keys = key.split(".");
        let val: unknown = snap;
        for (const k of keys) val = (val as Record<string, unknown>)?.[k];
        return typeof val === "number" ? val : 0;
      });
    },
  }))
);
