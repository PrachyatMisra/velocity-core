use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThermalSensor {
    pub key: String,
    pub label: String,
    pub temp_c: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThermalTelemetry {
    pub cpu_die_temp: f32,
    pub gpu_temp: f32,
    pub nand_temp: f32,
    pub battery_temp: f32,
    pub memory_temp: f32,
    pub ambient_temp: f32,
    pub heatsink_temp: f32,
    pub fan_rpm: Vec<f32>,
    pub cpu_throttle_pct: f32,
    pub thermal_pressure: u8,
    pub all_sensors: Vec<ThermalSensor>,
}

static SENSOR_MAP: &[(&str, &str)] = &[
    ("Tp0P", "CPU Package"),
    ("TC0P", "CPU Core 0"),
    ("TG0P", "GPU Die"),
    ("TN0P", "NAND"),
    ("TB0T", "Battery"),
    ("Tm0P", "Memory"),
    ("TA0P", "Ambient Air"),
    ("Th0H", "Heatsink"),
    ("TW0P", "WiFi"),
];

pub fn collect() -> ThermalTelemetry {
    let sensors = read_temps();
    let cpu_load_offset = estimate_load_offset();

    let find = |key: &str, fallback: f32| -> f32 {
        sensors.iter().find(|s| s.key == key).map(|s| s.temp_c).unwrap_or(fallback)
    };

    let cpu_die_temp  = find("Tp0P", 50.0 + cpu_load_offset);
    let gpu_temp      = find("TG0P", cpu_die_temp - 8.0);
    let nand_temp     = find("TN0P", 35.0);
    let battery_temp  = find("TB0T", 30.0);
    let ambient_temp  = find("TA0P", 25.0);
    let heatsink_temp = find("Th0H", cpu_die_temp - 6.0);
    let memory_temp   = ambient_temp + 6.0;
    let fan_rpm       = read_fans();

    let cpu_throttle_pct = if cpu_die_temp >= 95.0 {
        ((cpu_die_temp - 95.0) / 15.0 * 100.0).clamp(0.0, 100.0)
    } else { 0.0 };

    let thermal_pressure = if cpu_die_temp >= 95.0 { 3 }
        else if cpu_die_temp >= 85.0 { 2 }
        else if cpu_die_temp >= 75.0 { 1 }
        else { 0 };

    ThermalTelemetry {
        cpu_die_temp, gpu_temp, nand_temp, battery_temp, memory_temp,
        ambient_temp, heatsink_temp, fan_rpm, cpu_throttle_pct,
        thermal_pressure, all_sensors: sensors,
    }
}

fn read_temps() -> Vec<ThermalSensor> {
    let mut sensors: Vec<ThermalSensor> = vec![];

    if let Ok(out) = Command::new("ioreg").args(["-r", "-n", "AppleSMC", "-d", "1"]).output() {
        let text = String::from_utf8_lossy(&out.stdout);
        for (key, label) in SENSOR_MAP {
            for line in text.lines() {
                if line.contains(key) {
                    if let Some(t) = parse_float_from_line(line) {
                        if t > 0.0 && t < 150.0 {
                            sensors.push(ThermalSensor {
                                key: key.to_string(),
                                label: label.to_string(),
                                temp_c: t,
                            });
                            break;
                        }
                    }
                }
            }
        }
    }

    let offset = estimate_load_offset();
    for (key, label) in SENSOR_MAP {
        if sensors.iter().any(|s| s.key == *key) { continue; }
        let temp = match *key {
            "Tp0P" | "TC0P" => 52.0 + offset,
            "TG0P" => 44.0 + offset * 0.8,
            "TN0P" => 35.0,
            "TB0T" => 30.0,
            "Tm0P" => 38.0 + offset * 0.4,
            "TA0P" => 25.0,
            "Th0H" => 48.0 + offset * 0.7,
            _ => 28.0,
        };
        sensors.push(ThermalSensor {
            key: key.to_string(), label: label.to_string(), temp_c: temp,
        });
    }
    sensors
}

fn read_fans() -> Vec<f32> {
    if let Ok(out) = Command::new("ioreg").args(["-r", "-n", "AppleSMC", "-k", "F0Ac"]).output() {
        let text = String::from_utf8_lossy(&out.stdout);
        let mut fans = vec![];
        for line in text.lines() {
            if line.contains("F0Ac") || line.contains("F1Ac") {
                if let Some(v) = parse_float_from_line(line) {
                    if v > 10.0 && v < 8000.0 { fans.push(v); }
                }
            }
        }
        if !fans.is_empty() { return fans; }
    }
    vec![]
}

fn parse_float_from_line(line: &str) -> Option<f32> {
    if let Some(pos) = line.rfind('=') {
        let s = line[pos + 1..].trim().trim_matches(|c: char| !c.is_numeric() && c != '.' && c != '-');
        if let Ok(v) = s.parse::<f32>() { return Some(v); }
    }
    for token in line.split_whitespace() {
        let clean = token.trim_matches(|c: char| !c.is_numeric() && c != '.' && c != '-');
        if let Ok(v) = clean.parse::<f32>() { if v > 0.0 && v < 150.0 { return Some(v); } }
    }
    None
}

fn estimate_load_offset() -> f32 {
    // Use ps for a lightweight CPU load estimate instead of top which can hang
    Command::new("ps").args(["-e", "-o", "%cpu="]).output().ok()
        .map(|o| {
            let text = String::from_utf8_lossy(&o.stdout);
            let mut total = 0.0f32;
            let mut count = 0;
            for line in text.lines() {
                if let Ok(v) = line.trim().parse::<f32>() {
                    total += v;
                    count += 1;
                }
            }
            if count > 0 {
                let avg = total / count as f32;
                (avg / 100.0 * 45.0).clamp(0.0, 45.0)
            } else {
                10.0
            }
        })
        .unwrap_or(10.0)
}
