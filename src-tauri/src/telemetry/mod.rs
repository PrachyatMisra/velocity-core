pub mod battery;
pub mod cpu;
pub mod gpu;
pub mod memory;
pub mod network;
pub mod process;
pub mod smc;
pub mod storage;
pub mod thermal;

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::time::{SystemTime, UNIX_EPOCH};

pub use battery::BatteryTelemetry;
pub use cpu::CpuTelemetry;
pub use gpu::GpuTelemetry;
pub use memory::MemoryTelemetry;
pub use network::NetworkTelemetry;
pub use process::ProcessEntry;
pub use storage::StorageTelemetry;
pub use thermal::ThermalTelemetry;

// ── Score models ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VelocityScore {
    pub cpu: u32,
    pub gpu: u32,
    pub memory: u32,
    pub storage: u32,
    pub overall: u32,
    pub percentile: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThrottleRisk {
    pub level: String, // "nominal" | "elevated" | "critical" | "emergency"
    pub score: f32,
    pub forecast_30s: f32,
    pub forecast_60s: f32,
    pub forecast_300s: f32,
    pub triggers: Vec<String>,
}

impl Default for ThrottleRisk {
    fn default() -> Self {
        Self {
            level: "nominal".into(),
            score: 0.0,
            forecast_30s: 0.0,
            forecast_60s: 0.0,
            forecast_300s: 0.0,
            triggers: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticAlert {
    pub id: String,
    pub kind: String, // "thermal" | "process" | "disk" | "memory" | "anomaly"
    pub severity: String, // "info" | "warn" | "critical" | "emergency"
    pub title: String,
    pub message: String,
    pub action: Option<String>,
    pub timestamp_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetrySnapshot {
    pub timestamp_ms: u64,
    pub cpu: CpuTelemetry,
    pub memory: MemoryTelemetry,
    pub gpu: GpuTelemetry,
    pub thermal: ThermalTelemetry,
    pub battery: BatteryTelemetry,
    pub storage: StorageTelemetry,
    pub network: NetworkTelemetry,
    pub processes: Vec<ProcessEntry>,
    pub anomaly_score: f32,
    pub throttle_risk: ThrottleRisk,
    pub velocity_score: VelocityScore,
    pub alerts: Vec<DiagnosticAlert>,
}

// ── Engine ────────────────────────────────────────────────────────────────────

pub struct TelemetryEngine {
    history: VecDeque<TelemetrySnapshot>,
    tick: u64,
    process_cache: Vec<ProcessEntry>,
    alert_cooldown: std::collections::HashMap<String, u64>,
}

impl TelemetryEngine {
    pub fn new() -> Self {
        Self {
            history: VecDeque::with_capacity(300),
            tick: 0,
            process_cache: vec![],
            alert_cooldown: std::collections::HashMap::new(),
        }
    }

    pub fn poll(&mut self) -> TelemetrySnapshot {
        self.tick += 1;

        let cpu = cpu::collect();
        let memory = memory::collect();
        let gpu = gpu::collect();
        let thermal = thermal::collect();
        let battery = battery::collect();
        let storage = storage::collect();
        let raw_network = network::collect();

        let timestamp_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        let network = enrich_network_rates(
            raw_network,
            self.history.back(),
            timestamp_ms,
        );

        // Processes every 5 ticks (2.5s)
        if self.tick % 5 == 0 {
            self.process_cache = process::collect();
        }
        let processes = self.process_cache.clone();

        let throttle_risk = compute_throttle_risk(&cpu, &thermal);
        let anomaly_score = compute_anomaly_score(&cpu, &memory, &thermal, &self.history);
        let velocity_score = compute_velocity_score(&cpu, &gpu, &memory, &storage);
        let alerts = self.generate_alerts(&cpu, &memory, &thermal, &storage, &processes, anomaly_score);

        let snapshot = TelemetrySnapshot {
            timestamp_ms,
            cpu,
            memory,
            gpu,
            thermal,
            battery,
            storage,
            network,
            processes,
            anomaly_score,
            throttle_risk,
            velocity_score,
            alerts,
        };

        if self.history.len() >= 300 {
            self.history.pop_front();
        }
        self.history.push_back(snapshot.clone());
        snapshot
    }

    fn generate_alerts(
        &mut self,
        _cpu: &CpuTelemetry,
        memory: &MemoryTelemetry,
        thermal: &ThermalTelemetry,
        storage: &StorageTelemetry,
        processes: &[ProcessEntry],
        anomaly_score: f32,
    ) -> Vec<DiagnosticAlert> {
        let mut alerts = vec![];
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        let cooldown_ms = 30_000u64;

        // Thermal emergency
        if thermal.cpu_die_temp >= 90.0 {
            let key = "thermal_critical".to_string();
            let last = self.alert_cooldown.get(&key).copied().unwrap_or(0);
            if now - last > cooldown_ms {
                self.alert_cooldown.insert(key, now);
                alerts.push(DiagnosticAlert {
                    id: format!("thermal_{}", now),
                    kind: "thermal".into(),
                    severity: if thermal.cpu_die_temp >= 100.0 { "emergency" } else { "critical" }.into(),
                    title: "Thermal Emergency".into(),
                    message: format!("CPU at {:.0}°C — throttling imminent. Close background apps.", thermal.cpu_die_temp),
                    action: Some("close_background".into()),
                    timestamp_ms: now,
                });
            }
        }

        // Memory pressure
        if memory.pressure_level >= 3 {
            let key = "memory_critical".to_string();
            let last = self.alert_cooldown.get(&key).copied().unwrap_or(0);
            if now - last > cooldown_ms {
                self.alert_cooldown.insert(key, now);
                alerts.push(DiagnosticAlert {
                    id: format!("mem_{}", now),
                    kind: "memory".into(),
                    severity: "critical".into(),
                    title: "Memory Pressure Critical".into(),
                    message: format!("{:.0}% used — system is swapping. Run `sudo purge` to free inactive memory.", memory.usage_pct),
                    action: Some("purge_memory".into()),
                    timestamp_ms: now,
                });
            }
        }

        // Cryptominer detection
        for proc in processes {
            if proc.kind == "cryptominer" {
                let key = format!("miner_{}", proc.pid);
                let last = self.alert_cooldown.get(&key).copied().unwrap_or(0);
                if now - last > 60_000 {
                    self.alert_cooldown.insert(key, now);
                    alerts.push(DiagnosticAlert {
                        id: format!("miner_{}_{}", proc.pid, now),
                        kind: "process".into(),
                        severity: "emergency".into(),
                        title: format!("Cryptominer Detected: {}", proc.name),
                        message: format!("PID {} consuming {:.0}% CPU with mining signature", proc.pid, proc.cpu_pct),
                        action: Some(format!("kill_{}", proc.pid)),
                        timestamp_ms: now,
                    });
                }
            }
        }

        // High anomaly score
        if anomaly_score >= 0.8 {
            let key = "anomaly_high".to_string();
            let last = self.alert_cooldown.get(&key).copied().unwrap_or(0);
            if now - last > 30_000 {
                self.alert_cooldown.insert(key, now);
                alerts.push(DiagnosticAlert {
                    id: format!("anomaly_{}", now),
                    kind: "anomaly".into(),
                    severity: "warn".into(),
                    title: "Behavioral Anomaly Detected".into(),
                    message: format!("System behavior score {:.0}% outside baseline — unusual workload pattern.", anomaly_score * 100.0),
                    action: None,
                    timestamp_ms: now,
                });
            }
        }

        // SMART disk warning
        for disk in &storage.disks {
            if disk.smart_status != "Verified" {
                let key = format!("smart_{}", disk.device);
                let last = self.alert_cooldown.get(&key).copied().unwrap_or(0);
                if now - last > 300_000 {
                    self.alert_cooldown.insert(key, now);
                    alerts.push(DiagnosticAlert {
                        id: format!("smart_{}_{}", disk.device, now),
                        kind: "disk".into(),
                        severity: "critical".into(),
                        title: format!("Disk Warning: {}", disk.mount_point),
                        message: format!("SMART status: {} — backup data immediately.", disk.smart_status),
                        action: Some("open_time_machine".into()),
                        timestamp_ms: now,
                    });
                }
            }
        }

        alerts
    }
}

// ── Computations ──────────────────────────────────────────────────────────────

fn enrich_network_rates(
    mut current: NetworkTelemetry,
    previous: Option<&TelemetrySnapshot>,
    now_ms: u64,
) -> NetworkTelemetry {
    if let Some(prev) = previous {
        let elapsed_secs = (now_ms.saturating_sub(prev.timestamp_ms) as f64 / 1000.0).max(0.1);
        for iface in &mut current.interfaces {
            if let Some(prev_iface) = prev.network.interfaces.iter().find(|p| p.name == iface.name) {
                let rx_delta = iface.rx_total_bytes.saturating_sub(prev_iface.rx_total_bytes) as f64;
                let tx_delta = iface.tx_total_bytes.saturating_sub(prev_iface.tx_total_bytes) as f64;
                iface.rx_bps = (rx_delta / elapsed_secs).max(0.0);
                iface.tx_bps = (tx_delta / elapsed_secs).max(0.0);
            }
        }
    }

    current.total_rx_bps = current
        .interfaces
        .iter()
        .filter(|i| i.kind != "loopback")
        .map(|i| i.rx_bps)
        .sum();
    current.total_tx_bps = current
        .interfaces
        .iter()
        .filter(|i| i.kind != "loopback")
        .map(|i| i.tx_bps)
        .sum();

    current
}

fn compute_throttle_risk(cpu: &CpuTelemetry, thermal: &ThermalTelemetry) -> ThrottleRisk {
    let mut triggers = vec![];
    let mut score = 0.0f32;

    if thermal.cpu_die_temp >= 95.0 {
        let excess = ((thermal.cpu_die_temp - 95.0) / 15.0).clamp(0.0, 1.0);
        score = score.max(0.6 + excess * 0.4);
        triggers.push(format!("CPU temp {:.0}°C exceeds 95°C", thermal.cpu_die_temp));
    } else if thermal.cpu_die_temp >= 85.0 {
        score = score.max(0.4);
        triggers.push(format!("CPU temp {:.0}°C approaching limit", thermal.cpu_die_temp));
    }

    if thermal.gpu_temp >= 95.0 {
        score = score.max(0.7);
        triggers.push(format!("GPU temp {:.0}°C critical", thermal.gpu_temp));
    }

    let freq_ratio = if cpu.base_freq_mhz > 0.0 {
        cpu.all_core_avg_mhz / cpu.base_freq_mhz
    } else {
        1.0
    };
    if freq_ratio < 0.7 && cpu.total_usage_pct > 50.0 {
        score = score.max(0.5);
        triggers.push(format!("Freq ratio {:.2} — throttle active", freq_ratio));
    }

    let power_ratio = if cpu.tdp_mw > 0.0 {
        cpu.package_power_mw / cpu.tdp_mw
    } else {
        0.0
    };
    if power_ratio > 1.1 {
        score = score.max(0.4);
        triggers.push(format!("Power {:.0}% over TDP", (power_ratio - 1.0) * 100.0));
    }

    let level = if score >= 0.9 { "emergency" }
    else if score >= 0.7 { "critical" }
    else if score >= 0.4 { "elevated" }
    else { "nominal" };

    ThrottleRisk {
        level: level.to_string(),
        score,
        forecast_30s: (score * 0.95).clamp(0.0, 1.0),
        forecast_60s: (score * 0.88).clamp(0.0, 1.0),
        forecast_300s: (score * 0.65).clamp(0.0, 1.0),
        triggers,
    }
}

fn compute_anomaly_score(
    cpu: &CpuTelemetry,
    memory: &MemoryTelemetry,
    thermal: &ThermalTelemetry,
    history: &VecDeque<TelemetrySnapshot>,
) -> f32 {
    if history.len() < 30 { return 0.0; }

    let window: Vec<&TelemetrySnapshot> = history.iter().rev().take(30).collect();
    let cpu_vals: Vec<f32> = window.iter().map(|s| s.cpu.total_usage_pct).collect();
    let mean = cpu_vals.iter().sum::<f32>() / cpu_vals.len() as f32;
    let std = (cpu_vals.iter().map(|v| (v - mean).powi(2)).sum::<f32>()
        / cpu_vals.len() as f32).sqrt().max(1.0);
    let cpu_z = ((cpu.total_usage_pct - mean).abs() / std / 3.0).clamp(0.0, 1.0);

    let thermal_contrib = ((thermal.cpu_die_temp - 70.0) / 40.0).clamp(0.0, 1.0);
    let mem_contrib = if memory.pressure_level >= 3 { 0.5 } else { memory.pressure_level as f32 * 0.15 };

    (cpu_z * 0.5 + thermal_contrib * 0.3 + mem_contrib * 0.2).clamp(0.0, 1.0)
}

fn compute_velocity_score(
    cpu: &CpuTelemetry,
    gpu: &GpuTelemetry,
    memory: &MemoryTelemetry,
    storage: &StorageTelemetry,
) -> VelocityScore {
    // Normalize against reference M2 Pro scores
    let cpu_score = ((cpu.base_freq_mhz / 3490.0)
        * (cpu.perf_core_count as f32 / 6.0).min(2.0)
        * 1000.0) as u32;

    let gpu_score = ((gpu.memory_bandwidth_gbs / 200.0) * 1500.0) as u32;

    let mem_score = ((memory.bandwidth_gbs / 200.0)
        * (memory.total_bytes as f32 / (16.0 * 1024.0 * 1024.0 * 1024.0)).min(2.0)
        * 800.0) as u32;

    let read_mbs = storage.total_read_bps / (1024.0 * 1024.0);
    let storage_score = ((read_mbs / 5000.0).min(1.0) * 600.0) as u32;

    let overall = (cpu_score + gpu_score + mem_score + storage_score) / 4;

    // Rough percentile vs M2 Pro baseline of ~900
    let percentile = ((overall as f32 / 900.0) * 50.0).clamp(1.0, 99.0);

    VelocityScore { cpu: cpu_score, gpu: gpu_score, memory: mem_score, storage: storage_score, overall, percentile }
}
