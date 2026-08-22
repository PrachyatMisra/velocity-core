//! VELOCITY CORE APEX — Maintenance & Healing Suite
#![allow(dead_code)]
use serde::{Deserialize, Serialize};
use std::process::Command;

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanTarget {
    pub id:          String,
    pub label:       String,
    pub path:        String,
    pub size_bytes:  u64,
    pub file_count:  u32,
    pub category:    String,
    pub safe:        bool,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanResult {
    pub id:            String,
    pub freed_bytes:   u64,
    pub files_removed: u32,
    pub success:       bool,
    pub message:       String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkDetoxResult {
    pub dns_flushed:     bool,
    pub routes_reset:    bool,
    pub arp_cleared:     bool,
    pub mtu_optimized:   bool,
    pub bufferbloat_set: bool,
    pub details:         Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatteryPrediction {
    pub current_health_pct:   f64,
    pub predicted_12m_pct:    f64,
    pub predicted_24m_pct:    f64,
    pub cycles_per_month_est: f64,
    pub months_to_80pct:      Option<f64>,
    pub replacement_urgency:  String,
    pub monthly_degradation:  Vec<(u32, f64)>,
}

// ─────────────────────────────────────────────────────────────────────────────
//  Commands
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_maintenance_targets() -> Vec<CleanTarget> {
    let home = home_dir();
    let candidates: &[(&str, String, &str, &str, &str, bool)] = &[
        ("user_caches",    format!("{home}/Library/Caches"),                           "User Caches",          "App cache files regenerable on demand",     "caches",      true),
        ("xcode_derived",  format!("{home}/Library/Developer/Xcode/DerivedData"),      "Xcode DerivedData",    "Xcode build artefacts — always safe",       "development", true),
        ("xcode_sim_logs", format!("{home}/Library/Logs/CoreSimulator"),               "Simulator Logs",       "iOS Simulator log files",                   "development", true),
        ("brew_cache",     format!("{home}/Library/Caches/Homebrew"),                  "Homebrew Cache",       "Homebrew download cache",                   "development", true),
        ("npm_cache",      format!("{home}/.npm/_cacache"),                            "npm Cache",            "Node.js package download cache",            "development", true),
        ("pip_cache",      format!("{home}/Library/Caches/pip"),                       "pip Cache",            "Python pip download cache",                 "development", true),
        ("swift_pm",       format!("{home}/Library/Caches/org.swift.swiftpm"),         "Swift Package Cache",  "SPM resolved packages",                     "development", true),
        ("crash_reports",  format!("{home}/Library/Logs/DiagnosticReports"),           "Crash Reports",        "Application crash diagnostic reports",      "diagnostics", true),
        ("trash",          format!("{home}/.Trash"),                                   "Trash",                "Files currently in Trash",                  "user",        true),
        ("gradle_cache",   format!("{home}/.gradle/caches"),                           "Gradle Cache",         "Android/Java build cache",                  "development", true),
        ("xcode_archives", format!("{home}/Library/Developer/Xcode/Archives"),         "Xcode Archives",       "Old .xcarchive builds — review first",      "development", false),
        ("cocoapods",      format!("{home}/.cocoapods/repos"),                         "CocoaPods Repos",      "CocoaPods spec repo cache (large)",         "development", false),
        ("sim_devices",    format!("{home}/Library/Developer/CoreSimulator/Devices"),  "Simulator Devices",    "Full iOS Simulator images — very large",     "development", false),
    ];

    let mut targets: Vec<CleanTarget> = candidates
        .iter()
        .filter_map(|(id, path, label, desc, cat, safe)| {
            let (size, count) = measure_path(path)?;
            Some(CleanTarget {
                id: (*id).into(),
                label: (*label).into(),
                path: path.clone(),
                size_bytes: size,
                file_count: count,
                category: (*cat).into(),
                safe: *safe,
                description: (*desc).into(),
            })
        })
        .collect();

    targets.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    targets
}

#[tauri::command]
pub fn deep_clean(target_id: String) -> CleanResult {
    let targets = get_maintenance_targets();
    let target  = match targets.iter().find(|t| t.id == target_id) {
        Some(t) => t.clone(),
        None    => return fail(&target_id, "Target not found"),
    };

    if !std::path::Path::new(&target.path).exists() {
        return CleanResult { id: target_id, freed_bytes: 0, files_removed: 0, success: true, message: "Already clean".into() };
    }

    // Safety blocklist
    let blocked = ["/", "/System", "/usr", "/bin", "/etc", "/private/etc", "/Library"];
    for b in &blocked {
        if target.path == *b || target.path.starts_with(&format!("{b}/")) {
            return fail(&target_id, "Protected path");
        }
    }

    let size_before = target.size_bytes;

    let ok = match target_id.as_str() {
        "trash" => run("osascript", &["-e", "tell application \"Finder\" to empty trash"]),
        "brew_cache" => run("brew", &["cleanup", "--prune=0"]),
        _ if target.safe => run("rm", &["-rf", &target.path]),
        _ => return fail(&target_id, "Unsafe target — confirm manually"),
    };

    let freed = if ok {
        let after = measure_path(&target.path).map(|(s, _)| s).unwrap_or(0);
        size_before.saturating_sub(after)
    } else { 0 };

    CleanResult {
        id: target_id,
        freed_bytes: freed,
        files_removed: 0,
        success: ok,
        message: if ok { format!("Freed {freed} bytes") } else { "Command failed".into() },
    }
}

#[tauri::command]
pub fn network_detox() -> NetworkDetoxResult {
    let mut details = Vec::<String>::new();

    let dns = {
        let a = run("dscacheutil", &["-flushcache"]);
        let b = run("killall", &["-HUP", "mDNSResponder"]);
        details.push(format!("DNS Cache: {}", if a && b { "✓ Flushed" } else { "⚠ Partial (needs sudo)" }));
        a && b
    };

    let arp = {
        let ok = run("arp", &["-a", "-d"]);
        details.push(format!("ARP Cache: {}", if ok { "✓ Cleared" } else { "⚠ Needs sudo" }));
        ok
    };

    let routes = {
        let mut removed = 0u32;
        if let Ok(o) = Command::new("netstat").args(["-rn"]).output() {
            for line in String::from_utf8_lossy(&o.stdout).lines() {
                let cols: Vec<&str> = line.split_whitespace().collect();
                if cols.len() >= 3 && cols[2] == "UHl" {
                    if run("route", &["delete", "-host", cols[0]]) { removed += 1; }
                }
            }
        }
        details.push(format!("Stale Routes: ✓ Removed {removed}"));
        true
    };

    let mtu = {
        details.push("MTU: ℹ Run `sudo ifconfig en0 mtu 1500` manually".into());
        true
    };

    let bufferbloat = {
        let params = [
            ("kern.ipc.maxsockbuf",       "16777216"),
            ("net.inet.tcp.sendspace",     "1048576"),
            ("net.inet.tcp.recvspace",     "1048576"),
            ("net.inet.tcp.mssdflt",       "1440"),
        ];
        let ok = params.iter().all(|(k, v)| run("sysctl", &["-w", &format!("{k}={v}")]));
        details.push(format!("TCP Buffers: {}", if ok { "✓ Optimized" } else { "⚠ Needs sudo" }));
        ok
    };

    NetworkDetoxResult { dns_flushed: dns, routes_reset: routes, arp_cleared: arp, mtu_optimized: mtu, bufferbloat_set: bufferbloat, details }
}

#[tauri::command]
pub fn predict_battery_life(health_pct: f64, cycle_count: u32, design_capacity_mah: u32) -> BatteryPrediction {
    let _ = design_capacity_mah;
    let deg_per_cycle = if cycle_count > 0 {
        (100.0 - health_pct) / cycle_count as f64
    } else { 0.02 };
    let cycles_per_month = 36.0f64;

    let mut h = health_pct;
    let mut monthly: Vec<(u32, f64)> = Vec::new();
    let mut months_to_80: Option<f64> = None;

    for m in 1u32..=36 {
        h = (h - deg_per_cycle * cycles_per_month).max(0.0);
        monthly.push((m, h));
        if months_to_80.is_none() && h < 80.0 {
            months_to_80 = Some(m as f64);
        }
    }

    let pred_12 = monthly.get(11).map(|(_, v)| *v).unwrap_or(health_pct - 5.0);
    let pred_24 = monthly.get(23).map(|(_, v)| *v).unwrap_or(health_pct - 10.0);

    let urgency = if health_pct < 60.0 { "CRITICAL — Replace immediately" }
        else if health_pct < 70.0 || months_to_80.map_or(false, |m| m < 3.0) { "HIGH — Service within 1-3 months" }
        else if health_pct < 80.0 || months_to_80.map_or(false, |m| m < 6.0) { "MEDIUM — Plan service within 6 months" }
        else { "NOMINAL — Battery in excellent condition" };

    BatteryPrediction {
        current_health_pct: health_pct,
        predicted_12m_pct:  pred_12,
        predicted_24m_pct:  pred_24,
        cycles_per_month_est: cycles_per_month,
        months_to_80pct: months_to_80,
        replacement_urgency: urgency.into(),
        monthly_degradation: monthly.into_iter().take(24).collect(),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

fn home_dir() -> String {
    std::env::var("HOME").unwrap_or_else(|_| "/Users/Shared".into())
}

fn measure_path(path: &str) -> Option<(u64, u32)> {
    if !std::path::Path::new(path).exists() { return None; }
    let out   = Command::new("du").args(["-sk", path]).output().ok()?;
    let text  = String::from_utf8_lossy(&out.stdout);
    let kb: u64 = text.split_whitespace().next()?.parse().ok()?;
    Some((kb * 1024, 0))
}

fn run(cmd: &str, args: &[&str]) -> bool {
    Command::new(cmd).args(args).output().map(|o| o.status.success()).unwrap_or(false)
}

fn fail(id: &str, msg: &str) -> CleanResult {
    CleanResult { id: id.into(), freed_bytes: 0, files_removed: 0, success: false, message: msg.into() }
}
