import { useStore } from '../stores/telemetryStore';

export const useTelemetry  = () => useStore(s => s.snapshot);
export const useHistory    = (key: string, limit = 120) => useStore(s => s.getHistory(key, limit));
export const useCpuHistory = (n = 120) => useHistory('cpu.total_usage_pct', n);
export const useGpuHistory = (n = 120) => useHistory('gpu.usage_pct', n);
export const useMemHistory = (n = 120) => useHistory('memory.usage_pct', n);
export const useTempHistory = (n = 120) => useHistory('thermal.cpu_die_temp', n);

function safeNumber(v: number, fallback = 0): number {
  return Number.isFinite(v) ? v : fallback;
}

// ── Formatters ──────────────────────────────────────────────────────────
export function fmtBytes(b: number): string {
  b = safeNumber(b);
  if (b < 0) return '0 B';
  if (b >= 1e12) return `${(b/1e12).toFixed(2)} TB`;
  if (b >= 1e9)  return `${(b/1e9).toFixed(2)} GB`;
  if (b >= 1e6)  return `${(b/1e6).toFixed(1)} MB`;
  if (b >= 1e3)  return `${(b/1e3).toFixed(0)} KB`;
  return `${b.toFixed(0)} B`;
}
export function fmtBps(bps: number): string {
  bps = safeNumber(bps);
  if (bps < 0) return '0 bps';
  if (bps >= 1e9) return `${(bps/1e9).toFixed(2)} Gbps`;
  if (bps >= 1e6) return `${(bps/1e6).toFixed(1)} Mbps`;
  if (bps >= 1e3) return `${(bps/1e3).toFixed(0)} Kbps`;
  return `${bps.toFixed(0)} bps`;
}
export function fmtFreq(mhz: number): string {
  mhz = safeNumber(mhz);
  return mhz >= 1000 ? `${(mhz/1000).toFixed(2)} GHz` : `${mhz.toFixed(0)} MHz`;
}
export function fmtPower(mw: number): string {
  mw = safeNumber(mw);
  return mw >= 1000 ? `${(mw/1000).toFixed(1)} W` : `${mw.toFixed(0)} mW`;
}
export function fmtTemp(c: number): string { return `${safeNumber(c).toFixed(1)}°C`; }
export function fmtTime(min: number): string {
  min = safeNumber(min);
  if (min <= 0) return '0m';
  if (min >= 60) return `${Math.floor(min/60)}h ${Math.round(min%60)}m`;
  return `${Math.round(min)}m`;
}

// ── Color helpers ────────────────────────────────────────────────────────
export function tempColor(c: number): string {
  if (c >= 95) return '#ff0000';
  if (c >= 85) return '#ff2200';
  if (c >= 75) return '#ff6600';
  if (c >= 65) return '#ff9900';
  if (c >= 50) return '#ffcc00';
  return '#00e5ff';
}
export function usageColor(pct: number): string {
  pct = safeNumber(pct);
  if (pct >= 90) return '#ff0044';
  if (pct >= 75) return '#ff6600';
  if (pct >= 50) return '#ff9900';
  return '#00e5ff';
}
export function pressureColor(level: number): string {
  return ['#00ff7f', '#ffaa00', '#ff6600', '#ff0044'][level] ?? '#ff0044';
}
