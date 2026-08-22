use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryTelemetry {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub wired_bytes: u64,
    pub active_bytes: u64,
    pub inactive_bytes: u64,
    pub compressed_bytes: u64,
    pub speculative_bytes: u64,
    pub usage_pct: f32,
    pub pressure_level: u8,
    pub swap_used_bytes: u64,
    pub swap_total_bytes: u64,
    pub compressor_occupancy_pct: f32,
    pub bandwidth_gbs: f32,
    pub page_faults: u64,
    pub page_ins: u64,
    pub page_outs: u64,
    pub zero_fill_pages: u64,
}

pub fn collect() -> MemoryTelemetry {
    let total = physical_memory();
    let (wired, active, inactive, compressed, free, spec) = vm_stats(total);
    let (swap_used, swap_total) = swap_info();

    let used = wired + active + compressed;
    let usage_pct = (used as f32 / total.max(1) as f32 * 100.0).clamp(0.0, 100.0);
    let pressure_level = if usage_pct >= 95.0 { 3 }
        else if usage_pct >= 85.0 { 2 }
        else if usage_pct >= 70.0 { 1 }
        else { 0 };

    let compressor_occupancy_pct = if used > 0 {
        compressed as f32 / used as f32 * 100.0
    } else { 0.0 };

    MemoryTelemetry {
        total_bytes: total, used_bytes: used, free_bytes: free,
        wired_bytes: wired, active_bytes: active, inactive_bytes: inactive,
        compressed_bytes: compressed, speculative_bytes: spec,
        usage_pct, pressure_level, swap_used_bytes: swap_used,
        swap_total_bytes: swap_total, compressor_occupancy_pct,
        bandwidth_gbs: bandwidth_gbs(total),
        page_faults: 0, page_ins: 0, page_outs: 0, zero_fill_pages: 0,
    }
}

fn physical_memory() -> u64 {
    Command::new("sysctl").args(["-n", "hw.memsize"]).output().ok()
        .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse().ok())
        .unwrap_or(8_589_934_592)
}

fn vm_stats(total: u64) -> (u64, u64, u64, u64, u64, u64) {
    let page = 16384u64;
    let mut wired = 0u64; let mut active = 0u64; let mut inactive = 0u64;
    let mut compressed = 0u64; let mut spec = 0u64;

    if let Ok(out) = Command::new("vm_stat").output() {
        for line in String::from_utf8_lossy(&out.stdout).lines() {
            let parts: Vec<&str> = line.splitn(2, ':').collect();
            if parts.len() != 2 { continue; }
            let val: u64 = parts[1].trim().trim_end_matches('.').parse().unwrap_or(0);
            match parts[0].trim() {
                "Pages wired down" => wired = val * page,
                "Pages active" => active = val * page,
                "Pages inactive" => inactive = val * page,
                "Pages occupied by compressor" => compressed = val * page,
                "Pages speculative" => spec = val * page,
                _ => {}
            }
        }
    }
    let used = wired + active + compressed;
    let free = total.saturating_sub(used);
    (wired, active, inactive, compressed, free, spec)
}

fn swap_info() -> (u64, u64) {
    let out = Command::new("sysctl").args(["-n", "vm.swapusage"]).output();
    if let Ok(o) = out {
        let text = String::from_utf8_lossy(&o.stdout);
        let nums: Vec<f64> = text.split_whitespace()
            .filter_map(|s| s.trim_end_matches('M').parse().ok())
            .collect();
        if nums.len() >= 2 {
            return ((nums[1] * 1024.0 * 1024.0) as u64, (nums[0] * 1024.0 * 1024.0) as u64);
        }
    }
    (0, 0)
}

fn bandwidth_gbs(total: u64) -> f32 {
    let gb = total / (1024 * 1024 * 1024);
    match gb {
        0..=8  => 68.0,
        9..=16 => 100.0,
        17..=32 => 200.0,
        33..=64 => 400.0,
        65..=96 => 546.0,
        _ => 819.0,
    }
}
