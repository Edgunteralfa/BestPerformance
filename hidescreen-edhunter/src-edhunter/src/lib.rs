// MIT License - Copyright (c) 2026 BestPerformance Contributors

#[cfg(windows)]
mod windows_api;
#[cfg(windows)]
mod mouse_hook;
#[cfg(windows)]
mod keyboard_hook;

use std::path::PathBuf;
use tauri::{AppHandle, Manager, WebviewWindow};

fn app_config_file(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("config.json")
}

/// Installed copies keep notes in the Windows profile. A portable copy, marked by
/// an empty `portable` file next to the exe, keeps them in `data` beside that exe
/// so a flash drive carries the pitches to another computer.
#[tauri::command]
fn config_store_path(app: AppHandle) -> Result<String, String> {
    let exe = std::env::current_exe().map_err(|error| error.to_string())?;
    let Some(dir) = exe.parent() else {
        return Ok(app_config_file(&app).to_string_lossy().to_string());
    };
    if !dir.join("portable").is_file() {
        return Ok(app_config_file(&app).to_string_lossy().to_string());
    }

    let data_dir = dir.join("data");
    std::fs::create_dir_all(&data_dir).map_err(|error| error.to_string())?;
    let dest = data_dir.join("config.json");
    if !dest.exists() {
        let src = app_config_file(&app);
        if src.is_file() {
            std::fs::copy(&src, &dest).map_err(|error| error.to_string())?;
        }
    }
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn show_ethical_notice() -> String {
    "BestPerformance keeps a private script on your own screen during a talk or a call.\n\n\
     Leave it unused for exams, for breaking a school or office rule, for sidestepping a service agreement, and for anything the law forbids.\n\n\
     How you use it is your decision.\n\n\
     Notes stay in a file on this PC. The only optional outbound request is an update check.\n\n\
     OK means you have read this."
        .to_string()
}

#[tauri::command]
fn apply_capture_exclusion(window: WebviewWindow) -> Result<(), String> {
    #[cfg(windows)]
    {
        return windows_api::apply_capture_exclusion(window);
    }
    #[cfg(target_os = "macos")]
    {
        // NSWindowSharingNone. ScreenCaptureKit on macOS 15.4 and later ignores this.
        return window
            .set_content_protected(true)
            .map_err(|e| e.to_string());
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = window;
        Err("Capture exclusion is only available on Windows and macOS".to_string())
    }
}

#[tauri::command]
fn set_click_through(window: WebviewWindow, enabled: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        return windows_api::set_click_through(window, enabled);
    }
    #[cfg(not(windows))]
    {
        window
            .set_ignore_cursor_events(enabled)
            .map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn get_screen_size(window: WebviewWindow) -> Result<(u32, u32), String> {
    if let Some(monitor) = window.current_monitor().map_err(|e| e.to_string())? {
        let size = monitor.size();
        Ok((size.width, size.height))
    } else {
        Err("No monitor found".to_string())
    }
}

#[tauri::command]
fn install_scroll_hook(window: WebviewWindow) -> Result<(), String> {
    #[cfg(windows)]
    {
        return mouse_hook::install_hook(window);
    }
    #[cfg(not(windows))]
    {
        let _ = window;
        Ok(())
    }
}

#[tauri::command]
fn uninstall_scroll_hook() -> Result<(), String> {
    #[cfg(windows)]
    {
        return mouse_hook::uninstall_hook();
    }
    #[cfg(not(windows))]
    {
        Ok(())
    }
}

#[tauri::command]
fn install_keyboard_hook(app_handle: tauri::AppHandle) -> Result<(), String> {
    #[cfg(windows)]
    {
        return keyboard_hook::install_hook(app_handle);
    }
    #[cfg(not(windows))]
    {
        let _ = app_handle;
        Ok(())
    }
}

#[tauri::command]
fn uninstall_keyboard_hook() -> Result<(), String> {
    #[cfg(windows)]
    {
        return keyboard_hook::uninstall_hook();
    }
    #[cfg(not(windows))]
    {
        Ok(())
    }
}

#[tauri::command]
fn launch_update_installer(path: String) -> Result<(), String> {
    #[cfg(windows)]
    let mut command = std::process::Command::new(&path);
    #[cfg(target_os = "macos")]
    let mut command = std::process::Command::new("open");
    #[cfg(target_os = "macos")]
    command.arg(&path);
    #[cfg(not(any(windows, target_os = "macos")))]
    let mut command = std::process::Command::new(&path);

    command
        .spawn()
        .map_err(|e| format!("Failed to launch installer: {}", e))?;
    Ok(())
}

#[tauri::command]
fn check_windows_version() -> Result<String, String> {
    #[cfg(windows)]
    {
        windows_api::check_windows_version()
    }
    #[cfg(target_os = "macos")]
    {
        Ok("macOS".to_string())
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        Err("BestPerformance supports Windows and macOS".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn show_running_app(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_running_app(&app);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_store::Builder::default()
                .build()
        )
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Share pickers list the OS window title, not the in-app title bar.
            for label in ["main", "card"] {
                let Some(window) = app.get_webview_window(label) else {
                    continue;
                };
                let _ = window.set_title("Node Terminal");
                if let Err(e) = apply_capture_exclusion(window) {
                    log::error!("Failed to apply capture exclusion: {}", e);
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // The facts window is created at startup and often stays hidden.
                // Leaving it open keeps the process alive with no taskbar icon.
                if let Some(card) = window.app_handle().get_webview_window("card") {
                    let _ = card.destroy();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            show_ethical_notice,
            check_windows_version,
            apply_capture_exclusion,
            set_click_through,
            get_screen_size,
            install_scroll_hook,
            uninstall_scroll_hook,
            install_keyboard_hook,
            uninstall_keyboard_hook,
            launch_update_installer,
            config_store_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
