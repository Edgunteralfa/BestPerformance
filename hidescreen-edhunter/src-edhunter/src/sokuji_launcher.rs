// Local, auditable Windows launcher for the user's chosen Sokuji fork.
// B25 subtitle requests are restricted to 127.0.0.1 and trigger UI only;
// they do not start Soniox recognition or expose transcript/audio data.
use std::time::{Duration, Instant};

fn request_subtitle_mode() -> bool {
    use std::io::{Read, Write};
    use std::net::{SocketAddr, TcpStream, Ipv4Addr};
    let target = SocketAddr::from((Ipv4Addr::LOCALHOST, 47633));
    let Ok(mut socket) = TcpStream::connect_timeout(&target, Duration::from_millis(350)) else {
        return false;
    };
    let _ = socket.set_read_timeout(Some(Duration::from_millis(700)));
    let _ = socket.set_write_timeout(Some(Duration::from_millis(700)));
    if socket.write_all(b"SUBTITLE\n").is_err() { return false; }
    let mut ack = [0u8; 3];
    socket.read_exact(&mut ack).is_ok() && &ack == b"OK\n"
}

#[tauri::command]
pub async fn launch_sokuji(launcher_path: String, open_subtitles: bool) -> Result<String, String> {
    // The cold dev launch may take seconds. Never block Tauri's UI thread.
    tauri::async_runtime::spawn_blocking(move || launch_sync(&launcher_path, open_subtitles))
        .await.map_err(|e| format!("Sokuji launcher task failed: {e}"))?
}

fn launch_sync(raw: &str, open_subtitles: bool) -> Result<String, String> {
    if raw.trim().is_empty() || raw.len() > 800 || raw.contains(['\n', '\r', '"']) {
        return Err("Choose the local Sokuji .exe or .bat in BestPerformance settings".into());
    }
    let path = std::path::Path::new(raw.trim());
    if !path.is_absolute() || !path.is_file() {
        return Err("Configured Sokuji launcher does not exist. Check the path in settings".into());
    }
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase();
    if ext != "exe" && ext != "bat" && ext != "cmd" {
        return Err("Only a local Sokuji .exe, .bat or .cmd launcher is allowed".into());
    }
    // Existing B25 fork: signal subtitle mode rather than spawning a duplicate.
    if open_subtitles && request_subtitle_mode() {
        return Ok("subtitles-opened".into());
    }
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows::core::PCWSTR;
        use windows::Win32::UI::Shell::ShellExecuteW;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
        // ShellExecute correctly handles absolute paths containing spaces.
        let dir = path.parent().ok_or("Invalid Sokuji launcher location")?;
        let wide = |s: &std::ffi::OsStr| s.encode_wide().chain(Some(0)).collect::<Vec<_>>();
        let file = wide(path.as_os_str());
        let cwd = wide(dir.as_os_str());
        let result = unsafe {
            ShellExecuteW(None, PCWSTR::null(), PCWSTR(file.as_ptr()),
                PCWSTR::null(), PCWSTR(cwd.as_ptr()), SW_SHOWNORMAL)
        };
        if result.0 as isize <= 32 {
            return Err(format!("Windows ShellExecute failed (code {})", result.0 as isize));
        }
    }
    #[cfg(not(windows))]
    { return Err("The Sokuji launcher currently supports Windows only".into()); }
    if !open_subtitles { return Ok("started".into()); }
    // Only acknowledge subtitle mode when the fork's own receiver confirms it.
    // Waiting includes cold Vite/Electron initialization; UI displays a spinner.
    let deadline = Instant::now() + Duration::from_secs(28);
    while Instant::now() < deadline {
        if request_subtitle_mode() { return Ok("subtitles-opened".into()); }
        std::thread::sleep(Duration::from_millis(450));
    }
    Err("Sokuji was launched, but did not confirm subtitle mode. Check its console window and select the updated B25 fork.".into())
}

#[cfg(test)]
mod tests {
    use super::launch_sync;
    #[test]
    fn refuses_invalid_and_nonexistent_launchers() {
        assert!(launch_sync("", true).is_err());
        assert!(launch_sync("https://example.com/sokuji.exe", false).is_err());
        assert!(launch_sync("relative.bat", true).is_err());
        assert!(launch_sync("C:\\unreal-b25-test\\missing.exe", false).is_err());
    }
}
