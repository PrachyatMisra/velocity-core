use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatteryTelemetry {
    pub present: bool,
    pub charging: bool,
    pub charge_pct: f32,
    pub health_pct: f32,
    pub cycle_count: u32,
    pub current_capacity_mah: u32,
    pub max_capacity_mah: u32,
    pub design_capacity_mah: u32,
    pub amperage_ma: i32,
    pub voltage_mv: u32,
    pub temperature_c: f32,
    pub time_remaining_min: Option<u32>,
    pub power_watts: f32,
    pub condition: String,
    pub optimized_charging: bool,
}

pub fn collect() -> BatteryTelemetry {
    if let Some(b) = from_ioreg_raw() { return b; }
    if let Some(b) = from_system_profiler() { return b; }
    no_battery()
}

fn from_ioreg_raw() -> Option<BatteryTelemetry> {
    let out = Command::new("ioreg").args(["-r", "-n", "AppleSmartBattery", "-l"]).output().ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    if !text.contains("AppleSmartBattery") { return None; }

    let get_i64 = |key: &str| -> Option<i64> {
        let search = format!("\"{}\"", key);
        for line in text.lines() {
            if !line.contains(&search) { continue; }
            if let Some(eq) = line.find('=') {
                let s = line[eq+1..].trim().trim_start_matches('<').trim_end_matches('>').trim();
                if let Ok(v) = s.parse::<i64>() { return Some(v); }
            }
        }
        None
    };

    let raw_max:     u32 = get_i64("AppleRawMaxCapacity").map(|v| v.unsigned_abs() as u32).unwrap_or(0);
    let raw_cur:     u32 = get_i64("AppleRawCurrentCapacity").map(|v| v.unsigned_abs() as u32).unwrap_or(0);
    let design:      u32 = get_i64("DesignCapacity").map(|v| v.unsigned_abs() as u32).unwrap_or(0);
    let nominal:     u32 = get_i64("NominalChargeCapacity").map(|v| v.unsigned_abs() as u32).unwrap_or(0);
    let cycle_count: u32 = get_i64("CycleCount").map(|v| v.unsigned_abs() as u32).unwrap_or(0);

    let max_mah = if raw_max > 200 { raw_max } else if nominal > 200 { nominal } else { return None; };
    let design_mah = if design > 200 { design } else { max_mah };

    let health_pct = (max_mah as f32 / design_mah as f32 * 100.0).clamp(1.0, 105.0);

    let cur_mah = if raw_cur > 0 && raw_cur <= max_mah + 200 { raw_cur } else { 0 };
    let charge_pct = pmset_charge_pct().unwrap_or_else(|| {
        if max_mah > 0 { (cur_mah as f32 / max_mah as f32 * 100.0).clamp(0.0, 100.0) } else { 100.0 }
    });

    let amp_raw: i64 = get_i64("InstantAmperage").unwrap_or(0);
    let amperage_ma: i32 = if amp_raw > 2_000_000 { (amp_raw - 4_294_967_296_i64) as i32 } else { amp_raw as i32 };
    let voltage_mv: u32 = get_i64("Voltage").map(|v| v.unsigned_abs() as u32).unwrap_or(0);

    let temp_raw: i64 = get_i64("Temperature").unwrap_or(2500);
    let temperature_c: f32 = match temp_raw.unsigned_abs() as u32 {
        t if t > 5000 => temp_raw as f32 / 100.0,
        t if t > 500  => temp_raw as f32 / 10.0,
        t if t > 0    => temp_raw as f32,
        _ => 25.0,
    };

    let is_charging = get_i64("IsCharging").map(|v| v != 0).unwrap_or(false);
    let optimized_charging = text.contains("OptimizedChargingEngaged = Yes") || text.contains("OptimizedBatteryCharging = 1");
    let power_watts = if voltage_mv > 0 && amperage_ma != 0 {
        (voltage_mv as f32 / 1000.0 * amperage_ma.unsigned_abs() as f32 / 1000.0).abs()
    } else { 0.0 };
    let condition = infer_condition(health_pct);
    let time_remaining_min = if !is_charging { pmset_time_remaining() } else { None };

    Some(BatteryTelemetry {
        present: true, charging: is_charging, charge_pct, health_pct, cycle_count,
        current_capacity_mah: cur_mah, max_capacity_mah: max_mah, design_capacity_mah: design_mah,
        amperage_ma, voltage_mv, temperature_c, time_remaining_min,
        power_watts, condition, optimized_charging,
    })
}

fn infer_condition(health_pct: f32) -> String {
    if health_pct >= 80.0 { "Normal".into() }
    else if health_pct >= 60.0 { "Service Recommended".into() }
    else { "Replace Now".into() }
}

fn from_system_profiler() -> Option<BatteryTelemetry> {
    let out = Command::new("system_profiler").args(["SPPowerDataType"]).output().ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    if !text.contains("Battery") { return None; }
    let line_val = |label: &str| -> Option<String> {
        for line in text.lines() {
            let t = line.trim();
            if t.starts_with(label) { if let Some(c) = t.find(':') { return Some(t[c+1..].trim().to_string()); } }
        }
        None
    };
    let health_pct: f32 = if let Some(raw) = line_val("Maximum Capacity") {
        if raw.ends_with('%') { raw.trim_end_matches('%').parse::<f32>().ok().map(|v| v.clamp(1.0, 105.0)).unwrap_or(95.0) }
        else if let Ok(max_mah) = raw.parse::<f32>() {
            let design: f32 = line_val("Full Charge Capacity (mAh)").or_else(|| line_val("Design Capacity (mAh)")).and_then(|s| s.parse().ok()).unwrap_or(0.0);
            if design > 200.0 { (max_mah / design * 100.0).clamp(1.0, 105.0) } else { 95.0 }
        } else { 95.0 }
    } else { 95.0 };
    let cycle_count: u32 = line_val("Cycle Count").and_then(|s| s.parse().ok()).unwrap_or(0);
    let is_charging = line_val("Charging").map(|s| s.eq_ignore_ascii_case("yes")).unwrap_or(false);
    let condition = line_val("Condition").map(|s| {
        if s.to_lowercase().contains("replace") { "Replace Now".into() }
        else if s.to_lowercase().contains("service") { "Service Recommended".into() }
        else { "Normal".into() }
    }).unwrap_or_else(|| infer_condition(health_pct));
    let (temperature_c, amperage_ma, voltage_mv, optimized_charging) = ioreg_electrical();
    let power_watts = if voltage_mv > 0 && amperage_ma != 0 { (voltage_mv as f32 / 1000.0 * amperage_ma.unsigned_abs() as f32 / 1000.0).abs() } else { 0.0 };
    Some(BatteryTelemetry {
        present: true, charging: is_charging, charge_pct: pmset_charge_pct().unwrap_or(100.0),
        health_pct, cycle_count, current_capacity_mah: 0, max_capacity_mah: 0, design_capacity_mah: 0,
        amperage_ma, voltage_mv, temperature_c, time_remaining_min: pmset_time_remaining(),
        power_watts, condition, optimized_charging,
    })
}

fn ioreg_electrical() -> (f32, i32, u32, bool) {
    let out = match Command::new("ioreg").args(["-r", "-n", "AppleSmartBattery"]).output() { Ok(o) => o, Err(_) => return (25.0, 0, 0, false) };
    let text = String::from_utf8_lossy(&out.stdout);
    let mut temp_c = 25.0f32; let mut amp = 0i32; let mut volt = 0u32; let mut optimized = false;
    for line in text.lines() {
        let get_val = || -> Option<i64> { let eq = line.find('=')?; let s = line[eq+1..].trim().trim_start_matches('<').trim_end_matches('>').trim(); s.parse().ok() };
        if line.contains("\"Temperature\"") {
            if let Some(v) = get_val() { let r = v.unsigned_abs() as u32; temp_c = match r { t if t > 5000 => v as f32 / 100.0, t if t > 500 => v as f32 / 10.0, t if t > 0 => v as f32, _ => 25.0 }; }
        } else if line.contains("\"InstantAmperage\"") {
            if let Some(v) = get_val() { amp = if v > 2_000_000 { (v - 4_294_967_296_i64) as i32 } else { v as i32 }; }
        } else if line.contains("\"Voltage\"") && !line.contains("Max") && !line.contains("Min") {
            if let Some(v) = get_val() { volt = v.unsigned_abs() as u32; }
        } else if line.contains("OptimizedCharging") { optimized = line.contains("Yes") || line.contains('1'); }
    }
    (temp_c, amp, volt, optimized)
}

fn pmset_charge_pct() -> Option<f32> {
    let out = Command::new("pmset").args(["-g", "batt"]).output().ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    for line in text.lines() {
        for tok in line.split_whitespace() {
            let clean = tok.trim_end_matches(';').trim_end_matches('%');
            if clean != tok.trim_end_matches(';') { if let Ok(v) = clean.parse::<f32>() { if v >= 0.0 && v <= 100.0 { return Some(v); } } }
        }
    }
    None
}

fn pmset_time_remaining() -> Option<u32> {
    let out = Command::new("pmset").args(["-g", "batt"]).output().ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    for line in text.lines() {
        if line.contains("remaining") {
            for tok in line.split_whitespace() {
                if let Some((h, m)) = tok.split_once(':') {
                    let hours: u32 = h.parse().ok()?;
                    let mins: u32 = m.parse().ok()?;
                    let total = hours * 60 + mins;
                    if total > 0 && total < 2000 { return Some(total); }
                }
            }
        }
    }
    None
}

fn no_battery() -> BatteryTelemetry {
    BatteryTelemetry {
        present: false, charging: false, charge_pct: 100.0, health_pct: 100.0,
        cycle_count: 0, current_capacity_mah: 0, max_capacity_mah: 0, design_capacity_mah: 0,
        amperage_ma: 0, voltage_mv: 0, temperature_c: 25.0, time_remaining_min: None,
        power_watts: 0.0, condition: "Not Applicable".into(), optimized_charging: false,
    }
}
