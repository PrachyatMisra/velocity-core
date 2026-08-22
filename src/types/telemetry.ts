export interface CoreStat {
  id: number;
  kind: "performance" | "efficiency";
  usage_pct: number;
  freq_mhz: number;
  temp_c: number;
  power_mw: number;
  idle_residency_pct: number;
}

export interface CpuTelemetry {
  chip_name: string;
  total_usage_pct: number;
  user_pct: number;
  system_pct: number;
  idle_pct: number;
  cores: CoreStat[];
  perf_core_count: number;
  eff_core_count: number;
  all_core_avg_mhz: number;
  perf_core_avg_mhz: number;
  eff_core_avg_mhz: number;
  base_freq_mhz: number;
  package_power_mw: number;
  tdp_mw: number;
  load_avg_1: number;
  load_avg_5: number;
  load_avg_15: number;
  context_switches: number;
  interrupts: number;
}

export interface MemoryTelemetry {
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  wired_bytes: number;
  active_bytes: number;
  inactive_bytes: number;
  compressed_bytes: number;
  speculative_bytes: number;
  usage_pct: number;
  pressure_level: number;
  swap_used_bytes: number;
  swap_total_bytes: number;
  compressor_occupancy_pct: number;
  bandwidth_gbs: number;
  page_faults: number;
  page_ins: number;
  page_outs: number;
  zero_fill_pages: number;
}

export interface GpuTelemetry {
  name: string;
  vendor: string;
  usage_pct: number;
  vertex_usage_pct: number;
  fragment_usage_pct: number;
  tiler_usage_pct: number;
  compute_usage_pct: number;
  encoder_usage_pct: number;
  decoder_usage_pct: number;
  neural_engine_usage_pct: number;
  freq_mhz: number;
  power_mw: number;
  temp_c: number;
  memory_used_mb: number;
  memory_total_mb: number;
  memory_bandwidth_gbs: number;
}

export interface ThermalSensor {
  key: string;
  label: string;
  temp_c: number;
}

export interface ThermalTelemetry {
  cpu_die_temp: number;
  gpu_temp: number;
  nand_temp: number;
  battery_temp: number;
  memory_temp: number;
  ambient_temp: number;
  heatsink_temp: number;
  fan_rpm: number[];
  cpu_throttle_pct: number;
  thermal_pressure: number;
  all_sensors: ThermalSensor[];
}

export interface BatteryTelemetry {
  present: boolean;
  charging: boolean;
  charge_pct: number;
  health_pct: number;
  cycle_count: number;
  current_capacity_mah: number;
  max_capacity_mah: number;
  design_capacity_mah: number;
  amperage_ma: number;
  voltage_mv: number;
  temperature_c: number;
  time_remaining_min: number | null;
  power_watts: number;
  condition: string;
  optimized_charging: boolean;
}

export interface DiskInfo {
  device: string;
  mount_point: string;
  fs_type: string;
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  usage_pct: number;
  read_bps: number;
  write_bps: number;
  read_iops: number;
  write_iops: number;
  latency_p50_us: number;
  latency_p95_us: number;
  latency_p99_us: number;
  smart_status: string;
  smart: SmartAttributes | null;
}

export interface SmartAttributes {
  reallocated_sectors: number;
  pending_sectors: number;
  uncorrectable_errors: number;
  temperature_c: number;
  available_spare_pct: number;
  percentage_used: number;
  power_on_hours: number;
  predicted_life_pct: number;
}

export interface StorageTelemetry {
  disks: DiskInfo[];
  total_read_bps: number;
  total_write_bps: number;
  nvme_power_state: string;
}

export interface NetworkInterface {
  name: string;
  kind: string;
  ip4: string;
  ip6: string;
  ssid?: string;
  signal_rssi?: number;
  channel?: number;
  rx_bps: number;
  tx_bps: number;
  rx_total_bytes: number;
  tx_total_bytes: number;
  rx_errors: number;
  tx_errors: number;
}

export interface NetworkTelemetry {
  interfaces: NetworkInterface[];
  total_rx_bps: number;
  total_tx_bps: number;
  tcp_connections: number;
  udp_connections: number;
}

export interface ProcessEntry {
  pid: number;
  name: string;
  cpu_pct: number;
  memory_bytes: number;
  threads: number;
  user: string;
  gpu_pct: number;
  kind: string;
  power_impact: string;
  cpu_type: string;
  bloat_score: number;
}

export interface VelocityScore {
  cpu: number;
  gpu: number;
  memory: number;
  storage: number;
  overall: number;
  percentile: number;
}

export interface ThrottleRisk {
  level: "nominal" | "elevated" | "critical" | "emergency";
  score: number;
  forecast_30s: number;
  forecast_60s: number;
  forecast_300s: number;
  triggers: string[];
}

export interface DiagnosticAlert {
  id: string;
  kind: string;
  severity: "info" | "warn" | "critical" | "emergency";
  title: string;
  message: string;
  action?: string;
  timestamp_ms: number;
}

export interface TelemetrySnapshot {
  timestamp_ms: number;
  cpu: CpuTelemetry;
  memory: MemoryTelemetry;
  gpu: GpuTelemetry;
  thermal: ThermalTelemetry;
  battery: BatteryTelemetry;
  storage: StorageTelemetry;
  network: NetworkTelemetry;
  processes: ProcessEntry[];
  anomaly_score: number;
  throttle_risk: ThrottleRisk;
  velocity_score: VelocityScore;
  alerts: DiagnosticAlert[];
}

export interface BenchmarkResult {
  kind: string;
  score?: number;
  elapsed_ms: number;
  threads: number;
  mbps?: number;
  iops?: number;
  latency_p50_us?: number;
  latency_p95_us?: number;
  latency_p99_us?: number;
  timestamp: number;
  chip: string;
}

export interface HealAction {
  id: string;
  label: string;
  description: string;
  command: string;
  requires_sudo: boolean;
  destructive: boolean;
}

export interface Diagnostic {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  impact: string;
  actions: HealAction[];
  auto_fixable: boolean;
}
