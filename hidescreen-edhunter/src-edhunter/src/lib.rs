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

/// A cursor picture that stays in the capture. It is not a webview, so it cannot
/// take clicks from the notes window. The notes window is excluded and covers it
/// on the local screen.
#[tauri::command]
fn place_cursor_decoy(app: AppHandle, x: f64, y: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("cursor-decoy") {
        let _ = window.destroy();
    }
    #[cfg(windows)]
    {
        let main = app.get_webview_window("main");
        let scale = main
            .as_ref()
            .and_then(|window| window.scale_factor().ok())
            .unwrap_or(1.0);
        let cover = main.and_then(|window| window.hwnd().ok()).map(|hwnd| hwnd.0 as isize);
        return windows_api::show_cursor_mark((x * scale) as i32, (y * scale) as i32, cover);
    }
    #[cfg(not(windows))]
    {
        let _ = (x, y);
        Ok(())
    }
}

#[tauri::command]
fn cursor_inside_app(app: AppHandle) -> Result<bool, String> {
    #[cfg(windows)]
    {
        let mut rects = Vec::new();
        for label in ["main", "card"] {
            let Some(window) = app.get_webview_window(label) else {
                continue;
            };
            if !window.is_visible().unwrap_or(false) {
                continue;
            }
            let pos = window.outer_position().map_err(|error| error.to_string())?;
            let size = window.outer_size().map_err(|error| error.to_string())?;
            rects.push((
                pos.x,
                pos.y,
                pos.x + size.width as i32,
                pos.y + size.height as i32,
            ));
        }
        return Ok(windows_api::cursor_inside(&rects));
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Ok(false)
    }
}

#[tauri::command]
fn hide_cursor_decoy(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("cursor-decoy") {
        let _ = window.destroy();
    }
    #[cfg(windows)]
    windows_api::hide_cursor_mark();
    Ok(())
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
async fn fetch_latest_release() -> Result<String, String> {
    let client = reqwest::Client::builder()
        .http1_only()
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .get("https://api.github.com/repos/Edgunteralfa/BestPerformance/releases/latest")
        .header("User-Agent", concat!("BestPerformance/", env!("CARGO_PKG_VERSION")))
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("GitHub API returned {}", response.status()));
    }
    response.text().await.map_err(|error| error.to_string())
}

#[tauri::command]
async fn download_and_launch_update(url: String) -> Result<(), String> {
    let allowed = url.starts_with("https://github.com/")
        || url.starts_with("https://release-assets.githubusercontent.com/")
        || url.starts_with("https://objects.githubusercontent.com/");
    if !allowed {
        return Err("Unexpected update address".to_string());
    }

    let client = reqwest::Client::builder()
        .http1_only()
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|error| error.to_string())?;
    let response = client.get(&url).send().await.map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Download failed: {}", response.status()));
    }
    let bytes = response.bytes().await.map_err(|error| error.to_string())?;

    let filename = url
        .split('/')
        .next_back()
        .unwrap_or("BestPerformance-setup")
        .split('?')
        .next()
        .unwrap_or("BestPerformance-setup");
    let path = std::env::temp_dir().join(filename);
    std::fs::write(&path, &bytes).map_err(|error| error.to_string())?;
    launch_update_installer(path.to_string_lossy().to_string())
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
                if let Some(decoy) = window.app_handle().get_webview_window("cursor-decoy") {
                    let _ = decoy.destroy();
                }
                #[cfg(windows)]
                windows_api::destroy_cursor_mark();
            }
        })
        .invoke_handler(tauri::generate_handler![
            show_ethical_notice,
            check_windows_version,
            apply_capture_exclusion,
            set_click_through,
            place_cursor_decoy,
            hide_cursor_decoy,
            cursor_inside_app,
            get_screen_size,
            install_scroll_hook,
            uninstall_scroll_hook,
            install_keyboard_hook,
            uninstall_keyboard_hook,
            launch_update_installer,
            download_and_launch_update,
            fetch_latest_release,
            config_store_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
