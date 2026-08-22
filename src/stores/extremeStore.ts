import { create } from 'zustand';

interface ExtremeStore {
  extremeActive:    boolean;
  acknowledged:     boolean;
  reactorIntensity: number;
  cpuTempC:         number;
  fanRpms:          number[];
  setExtremeActive: (v: boolean) => void;
  setAcknowledged:  (v: boolean) => void;
  setReactorData:   (intensity: number, temp: number, fans: number[]) => void;
}

export const useExtremeStore = create<ExtremeStore>(set => ({
  extremeActive:    false,
  acknowledged:     false,
  reactorIntensity: 0,
  cpuTempC:         50,
  fanRpms:          [],
  setExtremeActive: v  => set({ extremeActive: v }),
  setAcknowledged:  v  => set({ acknowledged: v }),
  setReactorData:   (intensity, temp, fans) =>
    set({ reactorIntensity: intensity, cpuTempC: temp, fanRpms: fans }),
}));
