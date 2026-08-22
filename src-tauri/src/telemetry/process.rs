use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessEntry {
    pub pid: u32,
    pub name: String,
    pub cpu_pct: f32,
    pub memory_bytes: u64,
    pub threads: u32,
    pub user: String,
    pub gpu_pct: f32,
    pub kind: String,
    pub power_impact: String,
    pub cpu_type: String,  // "arm64" | "x86_64" | "universal"
    pub bloat_score: u32,  // Electron-specific shame score 0-100
}

pub fn collect() -> Vec<ProcessEntry> {
    let mut procs = vec![];

    if let Ok(out) = Command::new("ps").args(["axo", "pid,user,%cpu,rss,comm"]).output() {
        for line in String::from_utf8_lossy(&out.stdout).lines().skip(1) {
            let parts: Vec<&str> = line.splitn(5, ' ')
                .filter(|s| !s.is_empty())
                .collect();
            if parts.len() < 5 { continue; }

            let pid: u32 = parts[0].trim().parse().unwrap_or(0);
            let user = parts[1].trim().to_string();
            let cpu_pct: f32 = parts[2].trim().parse().unwrap_or(0.0);
            let rss: u64 = parts[3].trim().parse().unwrap_or(0);
            let cmd = parts[4].trim();
            let name = cmd.split('/').last().unwrap_or(cmd).to_string();
            let cmd_lower = cmd.to_lowercase();
            let name_lower = name.to_lowercase();

            let memory_bytes = rss * 1024;
            let kind = fingerprint(&name_lower, &cmd_lower);
            let bloat_score = bloat(&kind, memory_bytes, cpu_pct);
            let power_impact = power(&kind, cpu_pct, memory_bytes);

            procs.push(ProcessEntry {
                pid, name, cpu_pct, memory_bytes, threads: 1,
                user, gpu_pct: 0.0, kind, power_impact,
                cpu_type: "arm64".into(), bloat_score,
            });
        }
    }

    procs.sort_by(|a, b| b.cpu_pct.partial_cmp(&a.cpu_pct).unwrap_or(std::cmp::Ordering::Equal));
    procs.truncate(60);
    procs
}

fn fingerprint(name: &str, cmd: &str) -> String {
    if cmd.contains("xmrig") || name.contains("miner") || cmd.contains("monero") { return "cryptominer".into(); }
    if name.contains("slack") || name.contains("discord") || name.contains("electron")
        || name.contains("code") || name.contains("notion") || name.contains("figma")
        || name.contains("linear") || name.contains("zoom") || cmd.contains("--type=renderer") {
        return "electron".into();
    }
    if name.contains("python") || cmd.contains("torch") || cmd.contains("tensorflow")
        || cmd.contains("jupyter") || name.contains("ollama") || name.contains("llama") {
        return "ml_workload".into();
    }
    if name.contains("clang") || name.contains("swiftc") || name.contains("rustc")
        || name.contains("xcodebuild") || name.contains("make") || name.contains("ninja") {
        return "compiler".into();
    }
    if name.contains("ffmpeg") || name.contains("compressor") || name.contains("davinci") {
        return "media".into();
    }
    if name.contains("kernel_task") || name.contains("launchd") || name.contains("windowserver")
        || name.contains("loginwindow") || name.contains("mds") || name.contains("coreaudiod") {
        return "system".into();
    }
    "normal".into()
}

fn bloat(kind: &str, mem: u64, cpu: f32) -> u32 {
    if kind != "electron" { return 0; }
    let mem_gb = mem as f32 / (1024.0 * 1024.0 * 1024.0);
    let mem_score = (mem_gb / 2.0 * 50.0).clamp(0.0, 50.0);
    let cpu_score = (cpu / 2.0).clamp(0.0, 30.0);
    let base = 20.0;
    (mem_score + cpu_score + base).clamp(0.0, 100.0) as u32
}

fn power(kind: &str, cpu: f32, mem: u64) -> String {
    let mem_gb = mem as f32 / (1024.0 * 1024.0 * 1024.0);
    let electron_penalty = if kind == "electron" { 2.0 } else { 0.0 };
    let score = cpu * 0.7 + mem_gb * 2.0 + electron_penalty;
    if score >= 30.0 { "very high" }
    else if score >= 15.0 { "high" }
    else if score >= 5.0 { "medium" }
    else { "low" }
    .into()
}
