use std::sync::{
    atomic::{AtomicBool, Ordering as AtomicOrdering},
    Arc,
};

use tauri::{Manager, WindowEvent};
use tauri_plugin_window_state::{AppHandleExt, StateFlags, WindowExt};

#[derive(Default)]
pub(crate) struct AppRuntimeState {
    close_to_tray: AtomicBool,
}

pub(crate) fn window_state_flags() -> StateFlags {
    StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED
}

pub(crate) fn restore_main_window(app: &tauri::App) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.restore_state(window_state_flags())?;
        window.show()?;
        window.set_focus()?;
        let _ = app.handle().save_window_state(window_state_flags());
    }

    Ok(())
}

pub(crate) fn handle_main_window_event(window: &tauri::Window, event: &WindowEvent) {
    if window.label() != "main" {
        return;
    }

    match event {
        WindowEvent::Moved(_) | WindowEvent::Resized(_) | WindowEvent::CloseRequested { .. } => {
            let app = window.app_handle();
            let _ = app.save_window_state(window_state_flags());

            if let WindowEvent::CloseRequested { api, .. } = event {
                if app
                    .state::<Arc<AppRuntimeState>>()
                    .close_to_tray
                    .load(AtomicOrdering::Relaxed)
                {
                    api.prevent_close();
                    let _ = window.hide();
                } else {
                    app.exit(0);
                }
            }
        }
        _ => {}
    }
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn exit_app(app: &tauri::AppHandle) {
    let _ = app.save_window_state(window_state_flags());
    app.exit(0);
}

#[cfg(desktop)]
pub(crate) fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::{
        menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
        tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    };

    let show_item = MenuItemBuilder::with_id("show", "显示").build(app)?;
    let exit_item = MenuItemBuilder::with_id("exit", "退出").build(app)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = MenuBuilder::new(app)
        .items(&[&show_item, &separator, &exit_item])
        .build()?;

    let mut tray = TrayIconBuilder::with_id("rename-studio-tray")
        .tooltip("Rename Studio")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main_window(app),
            "exit" => exit_app(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        tray = tray.icon(icon);
    }

    tray.build(app)?;
    Ok(())
}

#[tauri::command]
pub(crate) fn set_close_to_tray_enabled(app: tauri::AppHandle, enabled: bool) {
    app.state::<Arc<AppRuntimeState>>()
        .close_to_tray
        .store(enabled, AtomicOrdering::Relaxed);
}

#[tauri::command]
pub(crate) fn save_main_window_state(app: tauri::AppHandle) -> Result<(), String> {
    app.save_window_state(window_state_flags())
        .map_err(|error| format!("保存窗口状态失败：{error}"))
}
