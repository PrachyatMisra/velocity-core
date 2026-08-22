use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuTelemetry {
    pub name: String,
    pub vendor: String,
    pub usage_pct: f32,
    pub vertex_usage_pct: f32,
    pub fragment_usage_pct: f32,
    pub tiler_usage_pct: f32,
    pub compute_usage_pct: f32,
    pub encoder_usage_pct: f32,
    pub decoder_usage_pct: f32,
    pub neural_engine_usage_pct: f32,
    pub freq_mhz: f32,
    pub power_mw: f32,
    pub temp_c: f32,
    pub memory_used_mb: f32,
    pub memory_total_mb: f32,
    pub memory_bandwidth_gbs: f32,
}

pub fn collect() -> GpuTelemetry {
    let (name, vendor) = gpu_name();
    let ram_gb = physical_memory_gb();
    let stats = ioreg_stats();

    GpuTelemetry {
        name, vendor,
        usage_pct: stats.0,
        vertex_usage_pct: stats.1,
        fragment_usage_pct: stats.2,
        tiler_usage_pct: stats.3,
        compute_usage_pct: stats.4,
        encoder_usage_pct: stats.5,
        decoder_usage_pct: stats.6,
        neural_engine_usage_pct: stats.7,
        freq_mhz: 1398.0,
        power_mw: stats.0 * 400.0,
        temp_c: 38.0 + stats.0 * 0.6,
        memory_used_mb: stats.8,
        memory_total_mb: ram_gb * 1024.0,
        memory_bandwidth_gbs: bw_from_ram(ram_gb),
    }
}

fn gpu_name() -> (String, String) {
    static CACHE: std::sync::OnceLock<(String, String)> = std::sync::OnceLock::new();
    CACHE.get_or_init(|| {
        if let Ok(out) = Command::new("system_profiler").args(["SPDisplaysDataType"]).output() {
            for line in String::from_utf8_lossy(&out.stdout).lines() {
                if line.contains("Chipset Model:") {
                    if let Some(v) = line.split(':').nth(1) {
                        return (v.trim().to_string(), "Apple".into());
                    }
                }
            }
        }
        ("Apple GPU".into(), "Apple".into())
    }).clone()
}

fn ioreg_stats() -> (f32, f32, f32, f32, f32, f32, f32, f32, f32) {
    let out = Command::new("ioreg")
        .args(["-r", "-c", "IOGPU"])
        .output();

    if let Ok(o) = out {
        let text = String::from_utf8_lossy(&o.stdout);
        let mut device = 0.0f32; let mut vertex = 0.0f32; let mut frag = 0.0f32;
        let mut tiler = 0.0f32; let mut compute = 0.0f32;
        let enc = 0.0f32; let dec = 0.0f32; let neural = 0.0f32;
        let mut mem = 0.0f32;

        for line in text.lines() {
            let parse = |l: &str| l.split('=').nth(1)
                .and_then(|s| s.trim().parse::<f32>().ok())
                .unwrap_or(0.0);
            if line.contains("Device Utilization %") { device = parse(line); }
            else if line.contains("Vertex Utilization") { vertex = parse(line); }
            else if line.contains("Fragment Utilization") { frag = parse(line); }
            else if line.contains("Tiler Utilization") { tiler = parse(line); }
            else if line.contains("Compute Utilization") { compute = parse(line); }
            else if line.contains("IOGPUBytesAllocated") {
                mem = parse(line) / (1024.0 * 1024.0);
            }
        }
        if device > 0.0 {
            return (device, vertex, frag, tiler, compute, enc, dec, neural, mem);
        }
    }
    (0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
}

fn physical_memory_gb() -> f32 {
    static CACHE: std::sync::OnceLock<f32> = std::sync::OnceLock::new();
    *CACHE.get_or_init(|| {
        Command::new("sysctl").args(["-n", "hw.memsize"]).output().ok()
            .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<f64>().ok())
            .map(|v| (v / (1024.0 * 1024.0 * 1024.0)) as f32)
            .unwrap_or(8.0)
    })
}

fn bw_from_ram(gb: f32) -> f32 {
    match gb as u32 {
        0..=8  => 68.0,
        9..=16 => 100.0,
        17..=32 => 200.0,
        33..=64 => 400.0,
        _ => 546.0,
    }
}
