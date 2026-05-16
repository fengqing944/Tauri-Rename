mod app_runtime;
mod classification;
mod models;
mod naming;
mod processing;
mod report;
mod sorting;

use std::sync::Arc;

use app_runtime::{
    handle_main_window_event, restore_main_window, save_main_window_state,
    set_close_to_tray_enabled, setup_tray, window_state_flags, AppRuntimeState,
};
use processing::process_rename;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Arc::new(AppRuntimeState::default()))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(window_state_flags())
                .build(),
        )
        .setup(|app| {
            #[cfg(desktop)]
            {
                restore_main_window(app)?;
                setup_tray(app)?;
            }

            Ok(())
        })
        .on_window_event(handle_main_window_event)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            process_rename,
            set_close_to_tray_enabled,
            save_main_window_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
