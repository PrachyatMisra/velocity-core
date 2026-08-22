use std::process::Command;

pub fn read_all_smc_keys() -> Vec<(String, f32)> {
    let mut results = Vec::new();
    let out = Command::new("ioreg")
        .args(["-r", "-n", "AppleSMC", "-d", "1"])
        .output();

    if let Ok(o) = out {
        let text = String::from_utf8_lossy(&o.stdout);
        for line in text.lines() {
            if let Some((key, val)) = parse_smc_line(line) {
                results.push((key, val));
            }
        }
    }

    results.dedup_by_key(|(k, _)| k.clone());
    results
}

fn parse_smc_line(line: &str) -> Option<(String, f32)> {
    // Find a 4-char key starting with T/F/P in quotes
    let ki = line.find('"')?;
    let rest = &line[ki + 1..];
    let ke = rest.find('"')?;
    let key = &rest[..ke];

    if key.len() != 4 { return None; }
    let first = key.chars().next()?;
    if first != 'T' && first != 'F' && first != 'P' { return None; }

    let val = extract_val(line)?;
    Some((key.to_string(), val))
}

fn extract_val(line: &str) -> Option<f32> {
    let pos = line.rfind('=')?;
    let s = line[pos + 1..].trim().trim_end_matches('}').trim();
    let v: f32 = s.parse().ok()?;
    if v > 0.0 && v < 12_000.0 { Some(v) } else { None }
}
