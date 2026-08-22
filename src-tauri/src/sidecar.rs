use tauri_plugin_shell::ShellExt;

pub async fn launch(app: &tauri::AppHandle) {
    match app.shell().sidecar("vcx") {
        Ok(cmd) => {
            match cmd.args(["--mode", "daemon"]).spawn() {
                Ok(_) => log::info!("AI sidecar launched"),
                Err(e) => log::warn!("Sidecar spawn failed: {}", e),
            }
        }
        Err(e) => log::warn!("Sidecar not found (AI features unavailable): {}", e),
    }
}
