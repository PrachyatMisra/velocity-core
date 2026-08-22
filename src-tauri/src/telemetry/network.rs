use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInterface {
    pub name: String,
    pub kind: String,
    pub ip4: String,
    pub ip6: String,
    pub ssid: Option<String>,
    pub signal_rssi: Option<i32>,
    pub channel: Option<u32>,
    pub rx_bps: f64,
    pub tx_bps: f64,
    pub rx_total_bytes: u64,
    pub tx_total_bytes: u64,
    pub rx_errors: u64,
    pub tx_errors: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkTelemetry {
    pub interfaces: Vec<NetworkInterface>,
    pub total_rx_bps: f64,
    pub total_tx_bps: f64,
    pub tcp_connections: u32,
    pub udp_connections: u32,
}

pub fn collect() -> NetworkTelemetry {
    let interfaces = ifaces();
    let total_rx = interfaces.iter().filter(|i| i.kind != "loopback").map(|i| i.rx_bps).sum();
    let total_tx = interfaces.iter().filter(|i| i.kind != "loopback").map(|i| i.tx_bps).sum();
    let (tcp, udp) = connections();
    NetworkTelemetry { interfaces, total_rx_bps: total_rx, total_tx_bps: total_tx, tcp_connections: tcp, udp_connections: udp }
}

fn ifaces() -> Vec<NetworkInterface> {
    let mut by_name: HashMap<String, NetworkInterface> = HashMap::new();

    if let Ok(out) = Command::new("netstat").args(["-b", "-I", "all", "-n"]).output() {
        for line in String::from_utf8_lossy(&out.stdout).lines().skip(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 10 { continue; }
            let name = parts[0].trim_end_matches('*');
            if name.contains(':') || name == "lo0" { continue; }
            let rx: u64 = parts[6].parse().unwrap_or(0);
            let tx: u64 = parts[9].parse().unwrap_or(0);
            by_name
                .entry(name.to_string())
                .and_modify(|iface| {
                    iface.rx_total_bytes = rx;
                    iface.tx_total_bytes = tx;
                })
                .or_insert_with(|| NetworkInterface {
                    name: name.into(), kind: classify(name),
                    ip4: String::new(), ip6: String::new(),
                    ssid: None, signal_rssi: None, channel: None,
                    rx_bps: 0.0, tx_bps: 0.0,
                    rx_total_bytes: rx, tx_total_bytes: tx,
                    rx_errors: 0, tx_errors: 0,
                });
        }
    }

    let mut ifaces: Vec<NetworkInterface> = by_name.into_values().collect();
    ifaces.sort_by(|a, b| a.name.cmp(&b.name));
    fill_ips(&mut ifaces);
    wifi_info(&mut ifaces);
    ifaces
}

fn classify(name: &str) -> String {
    if name == "lo0" { "loopback" }
    else if name == "en0" { "wifi" }
    else if name.starts_with("en") { "ethernet" }
    else if name.starts_with("utun") || name.starts_with("ppp") || name.starts_with("ipsec") { "vpn" }
    else { "other" }
    .into()
}

fn fill_ips(ifaces: &mut Vec<NetworkInterface>) {
    if let Ok(out) = Command::new("ifconfig").output() {
        let text = String::from_utf8_lossy(&out.stdout);
        let mut current = String::new();
        for line in text.lines() {
            if !line.starts_with('\t') && !line.starts_with(' ') {
                current = line.split(':').next().unwrap_or("").to_string();
            } else if line.trim_start().starts_with("inet ") && !line.contains("inet6") {
                if let Some(iface) = ifaces.iter_mut().find(|i| i.name == current) {
                    if let Some(addr) = line.split_whitespace().nth(1) {
                        iface.ip4 = addr.to_string();
                    }
                }
            }
        }
    }
}

fn wifi_info(ifaces: &mut Vec<NetworkInterface>) {
    let airport = "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport";
    if let Ok(out) = Command::new(airport).arg("-I").output() {
        let text = String::from_utf8_lossy(&out.stdout);
        let mut ssid = None;
        let mut rssi: Option<i32> = None;
        let mut channel: Option<u32> = None;
        for line in text.lines() {
            let p: Vec<&str> = line.splitn(2, ':').collect();
            if p.len() != 2 { continue; }
            match p[0].trim() {
                "SSID" | " SSID" => ssid = Some(p[1].trim().to_string()),
                "agrCtlRSSI" => rssi = p[1].trim().parse().ok(),
                "channel" => channel = p[1].trim().split(',').next().and_then(|v| v.parse().ok()),
                _ => {}
            }
        }
        if let Some(iface) = ifaces.iter_mut().find(|i| i.kind == "wifi") {
            iface.ssid = ssid;
            iface.signal_rssi = rssi;
            iface.channel = channel;
        }
    }
}

fn connections() -> (u32, u32) {
    let mut tcp = 0u32; let mut udp = 0u32;
    if let Ok(out) = Command::new("netstat").args(["-a", "-n", "-p", "tcp"]).output() {
        for line in String::from_utf8_lossy(&out.stdout).lines() {
            if line.starts_with("tcp") { tcp += 1; }
        }
    }
    if let Ok(out) = Command::new("netstat").args(["-a", "-n", "-p", "udp"]).output() {
        for line in String::from_utf8_lossy(&out.stdout).lines() {
            if line.starts_with("udp") { udp += 1; }
        }
    }
    (tcp, udp)
}
