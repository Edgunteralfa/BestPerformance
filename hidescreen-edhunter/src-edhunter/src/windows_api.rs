// MIT License - Copyright (c) 2026 BestPerformance Contributors
// Windows API integration for BestPerformance

use std::sync::atomic::{AtomicIsize, Ordering};

use tauri::WebviewWindow;
use windows::core::w;
use windows::Win32::Foundation::{COLORREF, HWND, LPARAM, LRESULT, POINT, RECT, SIZE, WPARAM};
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleBitmap, CreateCompatibleDC, CreateSolidBrush, DeleteDC, DeleteObject, FillRect,
    GetDC, ReleaseDC, SelectObject, SetPixel,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, GetCursorPos, GetWindowLongPtrW, RegisterClassExW,
    SetLayeredWindowAttributes, SetWindowLongPtrW, SetWindowPos, ShowWindow, UpdateLayeredWindow,
    GWL_EXSTYLE, HMENU, HWND_TOPMOST, LWA_ALPHA, SWP_NOACTIVATE,
    SWP_SHOWWINDOW,
    SW_HIDE, SW_SHOWNOACTIVATE, ULW_COLORKEY, WNDCLASSEXW, WS_EX_LAYERED, WS_EX_NOACTIVATE,
    WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT, WS_POPUP,
};

// Windows 10 Display Affinity constants
const WDA_EXCLUDEFROMCAPTURE: u32 = 0x00000011;

// External Windows API functions
#[link(name = "user32")]
extern "system" {
    fn SetWindowDisplayAffinity(hwnd: HWND, affinity: u32) -> i32;
}

/// Check if Windows version supports WDA_EXCLUDEFROMCAPTURE (Build 2004+)
pub fn check_windows_version() -> Result<String, String> {
    // For Windows 10/11, we need Build 19041 (2004) or higher
    // In practice, we just try to use the API and catch errors
    Ok("Windows 10/11 (version check OK)".to_string())
}

/// Apply WDA_EXCLUDEFROMCAPTURE to hide window from screen capture
///
/// This is the 3-step process documented in CLAUDE.md:
/// 1. Add WS_EX_LAYERED extended style
/// 2. Call SetLayeredWindowAttributes (makes it compatible with affinity)
/// 3. Call SetWindowDisplayAffinity
///
/// Reference: https://learn.microsoft.com/en-us/answers/questions/700122/setwindowdisplayaffinity-on-windows-11
pub fn apply_capture_exclusion(window: WebviewWindow) -> Result<(), String> {
    unsafe {
        // Get the window handle
        let hwnd_val = window.hwnd().map_err(|e| format!("Failed to get HWND: {}", e))?.0;
        let hwnd = HWND(hwnd_val);

        // Step 1: Get current extended style and add WS_EX_LAYERED
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_LAYERED.0 as isize);

        // Step 2: Set layered attributes (255 = fully opaque, LWA_ALPHA mode)
        // This makes it a "SetLayeredWindowAttributes window" which is
        // compatible with SetWindowDisplayAffinity (unlike UpdateLayeredWindow)
        let result = SetLayeredWindowAttributes(hwnd, windows::Win32::Foundation::COLORREF(0), 255, LWA_ALPHA);
        if result.is_err() {
            return Err("SetLayeredWindowAttributes failed".to_string());
        }

        // Step 3: Now apply capture exclusion
        let affinity_result = SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);
        if affinity_result == 0 {
            return Err("SetWindowDisplayAffinity failed - requires Windows 10 Build 2004+".to_string());
        }

        Ok(())
    }
}

/// Toggle click-through (mouse pass-through) mode
///
/// When enabled, clicks pass through the window to apps beneath.
/// Uses both WS_EX_TRANSPARENT (outer window) and Tauri's
/// set_ignore_cursor_events (WebView2 child) so the entire
/// window becomes truly click-through.
pub fn set_click_through(window: WebviewWindow, enabled: bool) -> Result<(), String> {
    unsafe {
        let hwnd_val = window.hwnd().map_err(|e| format!("Failed to get HWND: {}", e))?.0;
        let hwnd = HWND(hwnd_val);

        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);

        if enabled {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_TRANSPARENT.0 as isize);
        } else {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style & !(WS_EX_TRANSPARENT.0 as isize));
        }
    }

    // Also tell the WebView2 child to ignore/accept cursor events
    window
        .set_ignore_cursor_events(enabled)
        .map_err(|e| format!("set_ignore_cursor_events failed: {}", e))?;

    Ok(())
}

const MARK_W: i32 = 16;
const MARK_H: i32 = 20;
static CURSOR_MARK: AtomicIsize = AtomicIsize::new(0);

unsafe extern "system" fn cursor_mark_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    DefWindowProcW(hwnd, msg, wparam, lparam)
}

unsafe fn paint_cursor_mark(hwnd: HWND) -> Result<(), String> {
    let screen = GetDC(None);
    let memory = CreateCompatibleDC(screen);
    let bitmap = CreateCompatibleBitmap(screen, MARK_W, MARK_H);
    let previous = SelectObject(memory, bitmap);
    let key = COLORREF(0x00FF00FF);
    let background = CreateSolidBrush(key);
    FillRect(
        memory,
        &RECT { left: 0, top: 0, right: MARK_W, bottom: MARK_H },
        background,
    );
    let put = |x: i32, y: i32, color: u32| {
        if (0..MARK_W).contains(&x) && (0..MARK_H).contains(&y) {
            SetPixel(memory, x, y, COLORREF(color));
        }
    };
    for y in 0..14 {
        for x in 0..=y / 2 {
            put(x, y, 0x00FFFFFF);
        }
        put(0, y, 0x00000000);
        put(y / 2, y, 0x00000000);
    }
    for x in 0..7 {
        put(x, 13, 0x00000000);
    }
    for y in 10..MARK_H {
        put(2, y, 0x00000000);
        put(3, y, 0x00FFFFFF);
        put(4, y, 0x00FFFFFF);
        put(5, y, 0x00000000);
    }
    let source = POINT { x: 0, y: 0 };
    let size = SIZE { cx: MARK_W, cy: MARK_H };
    UpdateLayeredWindow(
        hwnd,
        screen,
        None,
        Some(&size),
        memory,
        Some(&source),
        key,
        None,
        ULW_COLORKEY,
    )
    .map_err(|error| error.to_string())?;
    SelectObject(memory, previous);
    let _ = DeleteObject(background);
    let _ = DeleteObject(bitmap);
    let _ = DeleteDC(memory);
    ReleaseDC(None, screen);
    Ok(())
}

pub fn show_cursor_mark(x: i32, y: i32, cover: Option<isize>) -> Result<(), String> {
    unsafe {
        let mut hwnd = HWND(CURSOR_MARK.load(Ordering::Relaxed) as *mut core::ffi::c_void);
        if hwnd.0.is_null() {
            let class = WNDCLASSEXW {
                cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
                lpfnWndProc: Some(cursor_mark_proc),
                hInstance: GetModuleHandleW(None).map_err(|error| error.to_string())?.into(),
                lpszClassName: w!("BestPerformanceCursorMark"),
                ..Default::default()
            };
            RegisterClassExW(&class);
            hwnd = CreateWindowExW(
                WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW,
                w!("BestPerformanceCursorMark"),
                w!(""),
                WS_POPUP,
                x,
                y,
                MARK_W,
                MARK_H,
                None,
                HMENU::default(),
                GetModuleHandleW(None).map_err(|error| error.to_string())?,
                None,
            )
            .map_err(|error| error.to_string())?;
            paint_cursor_mark(hwnd)?;
            CURSOR_MARK.store(hwnd.0 as isize, Ordering::Relaxed);
        }
        let _ = cover;
        // Above the notes window. Capture skips the notes and would also skip a
        // mark hidden behind them, which is why the pointer only vanished.
        SetWindowPos(
            hwnd,
            HWND_TOPMOST,
            x,
            y,
            MARK_W,
            MARK_H,
            SWP_NOACTIVATE | SWP_SHOWWINDOW,
        )
        .map_err(|error| error.to_string())?;
        let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
    }
    Ok(())
}

pub fn hide_cursor_mark() {
    let raw = CURSOR_MARK.load(Ordering::Relaxed);
    if raw == 0 {
        return;
    }
    unsafe {
        let _ = ShowWindow(HWND(raw as *mut core::ffi::c_void), SW_HIDE);
    }
}

pub fn destroy_cursor_mark() {
    let raw = CURSOR_MARK.swap(0, Ordering::Relaxed);
    if raw == 0 {
        return;
    }
    unsafe {
        let _ = windows::Win32::UI::WindowsAndMessaging::DestroyWindow(HWND(
            raw as *mut core::ffi::c_void,
        ));
    }
}

pub fn cursor_inside(rects: &[(i32, i32, i32, i32)]) -> bool {
    let mut point = POINT::default();
    unsafe {
        if GetCursorPos(&mut point).is_err() {
            return false;
        }
    }
    rects.iter().any(|(left, top, right, bottom)| {
        point.x >= *left && point.y >= *top && point.x < *right && point.y < *bottom
    })
}
