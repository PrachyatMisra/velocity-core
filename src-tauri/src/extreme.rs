//! VELOCITY CORE APEX — Extreme Mode
#![allow(dead_code)]
use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtremeModeActivation {
    pub success:  bool,
    pub fan_rpms: Vec<u32>,
    pub message:  String,
}

#[tauri::command]
pub fn activate_extreme_mode() -> ExtremeModeActivation {
    // Prevent system sleep during extreme mode (background, non-blocking)
    let _ = Command::new("caffeinate").args(["-d", "-s", "-t", "3600"]).spawn();

    let fan_rpms = read_fans();
    ExtremeModeActivation {
        success: true,
        fan_rpms: fan_rpms.clone(),
        message: format!(
            "EXTREME MODE ACTIVE — {} fan(s) detected. Sleep disabled.",
            fan_rpms.len()
        ),
    }
}

#[tauri::command]
pub fn deactivate_extreme_mode() -> bool {
    let _ = Command::new("killall").args(["caffeinate"]).output();
    true
}

#[tauri::command]
pub fn get_extreme_telemetry() -> serde_json::Value {
    let cpu_temp = read_smc_f32("TC0P")
        .or_else(|| read_smc_f32("Tp0P"))
        .or_else(|| read_smc_f32("TCXC"))
        .unwrap_or(50.0_f32);

    let fans = read_fans();
    let intensity = ((cpu_temp as f64 - 40.0) / 70.0).clamp(0.0, 1.0);

    serde_json::json!({
        "cpu_temp_c":      cpu_temp,
        "fan_rpms":        fans,
        "reactor_intensity": intensity,
        "thermal_state":   thermal_state(cpu_temp),
    })
}

fn thermal_state(t: f32) -> &'static str {
    match t as u32 {
        0..=59  => "COOL",
        60..=74 => "WARM",
        75..=84 => "HOT",
        85..=94 => "CRITICAL",
        _       => "EMERGENCY",
    }
}

fn read_smc_f32(key: &str) -> Option<f32> {
    let out = Command::new("ioreg")
        .args(["-r", "-n", "AppleSMC", "-l"])
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    let needle = format!("\"{key}\"");
    for line in text.lines() {
        if !line.contains(&needle) { continue; }
        if let Some(eq) = line.find('=') {
            let s = line[eq + 1..]
                .trim()
                .trim_start_matches('<')
                .trim_end_matches('>')
                .trim();
            if let Ok(v) = s.parse::<i64>() {
                let t = match v.unsigned_abs() as u32 {
                    n if n > 5000 => v as f64 / 100.0,
                    n if n > 500  => v as f64 / 10.0,
                    n if n > 0    => v as f64,
                    _             => return None,
                };
                if t > 0.0 && t < 150.0 { return Some(t as f32); }
            }
        }
    }
    None
}

fn read_fans() -> Vec<u32> {
    let mut rpms = Vec::new();
    let out = Command::new("ioreg")
        .args(["-r", "-n", "AppleSMC", "-l"])
        .output();
    if let Ok(o) = out {
        let text = String::from_utf8_lossy(&o.stdout);
        for line in text.lines() {
            if line.contains("\"F0Ac\"") || line.contains("\"F1Ac\"") {
                if let Some(eq) = line.find('=') {
                    let s = line[eq + 1..]
                        .trim()
                        .trim_start_matches('<')
                        .trim_end_matches('>')
                        .trim();
                    if let Ok(v) = s.parse::<f64>() {
                        let r = v as u32;
                        if r > 0 && r < 12_000 { rpms.push(r); }
                    }
                }
            }
        }
    }
    rpms
}
