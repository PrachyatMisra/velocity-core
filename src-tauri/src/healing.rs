use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub id: String,
    pub category: String,
    pub severity: String,
    pub title: String,
    pub description: String,
    pub impact: String,
    pub actions: Vec<HealAction>,
    pub auto_fixable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealAction {
    pub id: String,
    pub label: String,
    pub description: String,
    pub command: String,
    pub requires_sudo: bool,
    pub destructive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealResult {
    pub action_id: String,
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

#[tauri::command]
pub fn get_diagnostics() -> Vec<Diagnostic> {
    let mut diagnostics = vec![];

    // 1. Check memory pressure
    let mem = check_memory_pressure();
    if let Some(d) = mem { diagnostics.push(d); }

    // 2. Check kernel extensions
    let kext = check_legacy_kexts();
    for d in kext { diagnostics.push(d); }

    // 3. Check disk space
    let disk = check_disk_space();
    for d in disk { diagnostics.push(d); }

    // 4. Check Rosetta processes
    let rosetta = check_rosetta_processes();
    if let Some(d) = rosetta { diagnostics.push(d); }

    // 5. Check swap activity
    let swap = check_swap();
    if let Some(d) = swap { diagnostics.push(d); }

    // 6. Check Time Machine status
    let tm = check_time_machine();
    if let Some(d) = tm { diagnostics.push(d); }

    diagnostics
}

fn check_memory_pressure() -> Option<Diagnostic> {
    let out = Command::new("vm_stat").output().ok()?;
    let text = String::from_utf8_lossy(&out.stdout);

    let mut pageouts = 0u64;
    for line in text.lines() {
        if line.contains("Pageouts:") {
            if let Some(v) = line.split(':').nth(1) {
                pageouts = v.trim().trim_end_matches('.').parse().unwrap_or(0);
            }
        }
    }

    if pageouts > 10_000 {
        return Some(Diagnostic {
            id: "mem_pressure".into(),
            category: "memory".into(),
            severity: "warn".into(),
            title: "Elevated Memory Pressure Detected".into(),
            description: format!("{} page-outs detected — system is swapping to disk", pageouts),
            impact: "Disk I/O spikes, application slowdowns, increased SSD wear".into(),
            actions: vec![
                HealAction {
                    id: "purge_memory".into(),
                    label: "Purge Inactive Memory".into(),
                    description: "Frees inactive memory pages (requires sudo)".into(),
                    command: "sudo purge".into(),
                    requires_sudo: true,
                    destructive: false,
                },
                HealAction {
                    id: "close_electron".into(),
                    label: "Identify Memory Hogs".into(),
                    description: "List top memory-consuming processes".into(),
                    command: "ps aux -r | head -20".into(),
                    requires_sudo: false,
                    destructive: false,
                },
            ],
            auto_fixable: false,
        });
    }
    None
}

fn check_legacy_kexts() -> Vec<Diagnostic> {
    let mut diags = vec![];
    let out = Command::new("kmutil").args(["inspect", "-show", "loaded"]).output();
    if let Ok(o) = out {
        let text = String::from_utf8_lossy(&o.stdout);
        let legacy_count = text.lines().filter(|l| l.contains("(unsigned)") || l.contains("(invalid)")).count();
        if legacy_count > 0 {
            diags.push(Diagnostic {
                id: "legacy_kexts".into(),
                category: "security".into(),
                severity: "warn".into(),
                title: format!("{} Unsigned Kernel Extensions Loaded", legacy_count),
                description: "Legacy or unsigned kexts reduce security and may cause instability on Apple Silicon".into(),
                impact: "Reduced security, potential system instability, SIP bypass required".into(),
                actions: vec![
                    HealAction {
                        id: "list_kexts".into(),
                        label: "List Unsigned Kexts".into(),
                        description: "Show all loaded kernel extensions".into(),
                        command: "kmutil inspect -show loaded".into(),
                        requires_sudo: false,
                        destructive: false,
                    },
                ],
                auto_fixable: false,
            });
        }
    }
    diags
}

fn check_disk_space() -> Vec<Diagnostic> {
    let mut diags = vec![];
    let out = Command::new("df").args(["-P", "-l", "-k"]).output();
    if let Ok(o) = out {
        for line in String::from_utf8_lossy(&o.stdout).lines().skip(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 6 { continue; }
            if !parts[0].starts_with("/dev/disk") { continue; }
            let total: u64 = parts[1].parse().unwrap_or(0);
            let used: u64 = parts[2].parse().unwrap_or(0);
            if total == 0 { continue; }
            let pct = used as f32 / total as f32 * 100.0;
            if pct >= 85.0 {
                let free_gb = (total - used) as f32 / (1024.0 * 1024.0);
                diags.push(Diagnostic {
                    id: format!("disk_space_{}", parts[5]),
                    category: "storage".into(),
                    severity: if pct >= 95.0 { "critical" } else { "warn" }.into(),
                    title: format!("Low Disk Space on {}", parts[5]),
                    description: format!("{:.0}% used, {:.1} GB remaining", pct, free_gb),
                    impact: "Time Machine backups may fail, virtual memory expansion blocked".into(),
                    actions: vec![
                        HealAction {
                            id: "open_storage_management".into(),
                            label: "Open Storage Management".into(),
                            description: "Open macOS built-in storage optimizer".into(),
                            command: "open x-apple.systempreferences:com.apple.settings.Storage".into(),
                            requires_sudo: false,
                            destructive: false,
                        },
                        HealAction {
                            id: "clean_caches".into(),
                            label: "Clean System Caches".into(),
                            description: "Remove /Library/Caches contents (safe)".into(),
                            command: "sudo rm -rf /Library/Caches/com.apple.* 2>/dev/null; echo done".into(),
                            requires_sudo: true,
                            destructive: false,
                        },
                    ],
                    auto_fixable: false,
                });
            }
        }
    }
    diags
}

fn check_rosetta_processes() -> Option<Diagnostic> {
    // Check if any x86_64 processes are running under Rosetta
    let out = Command::new("ps").args(["axo", "pid,comm"]).output().ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    let rosetta_count = text.lines()
        .filter(|l| l.contains("(x86_64)") || l.contains("oah") || l.contains("runtime"))
        .count();
    if rosetta_count > 3 {
        return Some(Diagnostic {
            id: "rosetta_procs".into(),
            category: "performance".into(),
            severity: "info".into(),
            title: format!("{} Rosetta (x86_64) Processes Running", rosetta_count),
            description: "Intel processes running under Rosetta 2 emulation consume more power".into(),
            impact: "~20-40% higher power draw, reduced performance vs native arm64".into(),
            actions: vec![
                HealAction {
                    id: "list_rosetta".into(),
                    label: "List Rosetta Processes".into(),
                    description: "Show all processes running under Rosetta".into(),
                    command: "ps axo pid,comm | grep x86_64".into(),
                    requires_sudo: false,
                    destructive: false,
                },
            ],
            auto_fixable: false,
        });
    }
    None
}

fn check_swap() -> Option<Diagnostic> {
    let out = Command::new("sysctl").args(["-n", "vm.swapusage"]).output().ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    // Parse "total = 2048.00M  used = 512.00M  free = 1536.00M"
    let used_mb: f64 = text.split_whitespace()
        .skip_while(|&s| s != "used")
        .nth(2)
        .and_then(|s| s.trim_end_matches('M').parse().ok())
        .unwrap_or(0.0);

    if used_mb > 512.0 {
        return Some(Diagnostic {
            id: "swap_high".into(),
            category: "memory".into(),
            severity: "warn".into(),
            title: format!("{:.0} MB Swap in Use", used_mb),
            description: "Significant swap usage detected — RAM is overcommitted".into(),
            impact: "SSD wear (each NVMe cell has limited write cycles), system slowdown".into(),
            actions: vec![
                HealAction {
                    id: "purge_swap".into(),
                    label: "Purge Inactive Memory".into(),
                    description: "Frees inactive pages to reduce swap pressure".into(),
                    command: "sudo purge".into(),
                    requires_sudo: true,
                    destructive: false,
                },
            ],
            auto_fixable: false,
        });
    }
    None
}

fn check_time_machine() -> Option<Diagnostic> {
    let out = Command::new("tmutil").args(["latestbackup"]).output().ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    // If output is empty, no backup has been done
    if text.trim().is_empty() || text.contains("No backups") {
        return Some(Diagnostic {
            id: "no_time_machine".into(),
            category: "storage".into(),
            severity: "warn".into(),
            title: "No Time Machine Backup Found".into(),
            description: "System has no recent Time Machine backup detected".into(),
            impact: "Data loss risk if disk fails or system corruption occurs".into(),
            actions: vec![
                HealAction {
                    id: "open_time_machine".into(),
                    label: "Open Time Machine Settings".into(),
                    description: "Configure Time Machine backup destination".into(),
                    command: "open x-apple.systempreferences:com.apple.preference.timemachine".into(),
                    requires_sudo: false,
                    destructive: false,
                },
                HealAction {
                    id: "start_backup".into(),
                    label: "Start Backup Now".into(),
                    description: "Trigger an immediate Time Machine backup".into(),
                    command: "tmutil startbackup --auto".into(),
                    requires_sudo: false,
                    destructive: false,
                },
            ],
            auto_fixable: false,
        });
    }
    None
}

// ── Apply healing action ──────────────────────────────────────────────────────

#[tauri::command]
pub fn apply_healing_action(diagnostic_id: String, action_id: String) -> HealResult {
    let diagnostics = get_diagnostics();
    let Some(diagnostic) = diagnostics.into_iter().find(|d| d.id == diagnostic_id) else {
        return HealResult {
            action_id,
            success: false,
            output: String::new(),
            error: Some("Diagnostic not found".into()),
        };
    };

    let Some(action) = diagnostic.actions.into_iter().find(|a| a.id == action_id) else {
        return HealResult {
            action_id,
            success: false,
            output: String::new(),
            error: Some("Action not found".into()),
        };
    };

    // Keep a hard blocklist as a defense in depth layer.
    let blocked = [
        "rm -rf /",
        "sudo rm -rf /",
        ":(){ :|:& };:",
        "dd if=/dev/zero of=/dev/disk",
    ];
    if blocked.iter().any(|b| action.command.contains(b)) {
        return HealResult {
            action_id: action.id,
            success: false,
            output: String::new(),
            error: Some("Blocked: destructive command rejected".into()),
        };
    }

    let out = Command::new("sh").args(["-c", &action.command]).output();
    match out {
        Ok(o) => HealResult {
            action_id: action.id,
            success: o.status.success(),
            output: String::from_utf8_lossy(&o.stdout).to_string(),
            error: if o.status.success() {
                None
            } else {
                Some(String::from_utf8_lossy(&o.stderr).to_string())
            },
        },
        Err(e) => HealResult {
            action_id: action.id,
            success: false,
            output: String::new(),
            error: Some(e.to_string()),
        },
    }
}
