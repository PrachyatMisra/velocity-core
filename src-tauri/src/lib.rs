// Minimal tauri imports are used directly via fully-qualified paths in handlers.
// Avoid top-level imports that may trigger unused-import warnings across builds.

pub mod benchmark_engine;
pub mod commands;
pub mod extreme;
pub mod healing;
pub mod maintenance;
pub mod sidecar;
pub mod telemetry;

use parking_lot::RwLock;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use telemetry::{TelemetryEngine, TelemetrySnapshot};
use tokio::sync::broadcast;

pub struct AppState {
    pub engine: Arc<RwLock<TelemetryEngine>>,
    pub tx:     broadcast::Sender<TelemetrySnapshot>,
    pub stress_running: Arc<AtomicBool>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    let _ = env_logger::try_init();
    
    // Catch panics globally
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        eprintln!("🔴 PANIC CAUGHT: {:?}", panic_info);
        default_hook(panic_info);
    }));
    
    let (tx, _rx) = broadcast::channel::<TelemetrySnapshot>(64);
    let engine = Arc::new(RwLock::new(TelemetryEngine::new()));
    let stress_running = Arc::new(AtomicBool::new(false));
    let state = AppState {
        engine: engine.clone(),
        tx: tx.clone(),
        stress_running: stress_running.clone(),
    };

    // Unique benchmark commands (not in commands.rs)
    #[tauri::command]
    fn run_quick_benchmark(threads: Option<usize>) -> serde_json::Value {
        let tc = threads.unwrap_or_else(|| std::thread::available_parallelism().map(|n| n.get()).unwrap_or(8)).max(1);
        let cpu_int = benchmark_engine::bench_cpu_int(1000, tc);
        let cpu_float = benchmark_engine::bench_cpu_float(1000, tc);
        let cpu_comp = benchmark_engine::bench_cpu_compression(1000, tc);
        let overall = ((cpu_int as u64 + cpu_float as u64 + cpu_comp as u64) / 3) as u32;
        serde_json::json!({
            "cpu_int": cpu_int,
            "cpu_float": cpu_float,
            "cpu_compression": cpu_comp,
            "overall_score": overall,
            "threads": tc,
            "timestamp_ms": std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        })
    }

    #[tauri::command]
    fn run_comprehensive_benchmark() -> serde_json::Value {
        eprintln!("🚀 Starting comprehensive benchmark suite...");
        let tc = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(8).max(1);
        let start = std::time::Instant::now();
        
        let cpu_int = benchmark_engine::bench_cpu_int(2000, tc);
        let cpu_float = benchmark_engine::bench_cpu_float(2000, tc);
        let cpu_comp = benchmark_engine::bench_cpu_compression(2000, tc);
        let overall = ((cpu_int as u64 + cpu_float as u64 + cpu_comp as u64) / 3) as u32;
        
        let elapsed = start.elapsed().as_secs();
        eprintln!("✅ Benchmark completed in {}s", elapsed);
        
        serde_json::json!({
            "cpu_int": cpu_int,
            "cpu_float": cpu_float,
            "cpu_compression": cpu_comp,
            "overall_score": overall,
            "threads": tc,
            "elapsed_secs": elapsed,
            "timestamp_ms": std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        })
    }

    // Safe telemetry thread with panic recovery
    let telemetry_thread_running = Arc::new(AtomicBool::new(true));
    let _running_clone = telemetry_thread_running.clone();
    
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .manage(state)
        .setup(|_app| Ok(()))
        .invoke_handler(tauri::generate_handler![
            // Core telemetry (from commands.rs)
            commands::get_snapshot,
            commands::console_log,
            commands::get_smc_keys,
            commands::get_process_list,
            commands::kill_process,
            commands::get_disk_health,
            commands::get_benchmark_history,
            commands::run_benchmark,
            commands::start_stress_test,
            commands::stop_stress_test,
            // Unique benchmark commands (local to lib.rs)
            run_quick_benchmark,
            run_comprehensive_benchmark,
            // Healing module
            healing::get_diagnostics,
            healing::apply_healing_action,
            // Maintenance module
            maintenance::get_maintenance_targets,
            maintenance::deep_clean,
            maintenance::network_detox,
            maintenance::predict_battery_life,
            // Extreme mode module
            extreme::activate_extreme_mode,
            extreme::deactivate_extreme_mode,
            extreme::get_extreme_telemetry,
        ]);

    match builder.run(tauri::generate_context!()) {
        Ok(_) => eprintln!("✅ App closed normally"),
        Err(e) => eprintln!("❌ App error: {}", e),
    }
}
