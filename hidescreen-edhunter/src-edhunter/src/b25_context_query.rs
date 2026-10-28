// MIT License - Copyright (c) 2026 BestPerformance Contributors
//
// Separate localhost-only context intake for B25 Sokuji.
// Existing LinguaRelay single-word protocol on port 47631 is unchanged.
use std::io::Read;
use std::net::TcpListener;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub fn start(app: AppHandle) {
    thread::spawn(move || {
        let listener = match TcpListener::bind(("127.0.0.1", 47632)) {
            Ok(listener) => listener,
            Err(_) => return, // Another running BP instance owns the channel.
        };

        for connection in listener.incoming() {
            let Ok(socket) = connection else { continue };
            let _ = socket.set_read_timeout(Some(Duration::from_millis(900)));
            let mut bytes = Vec::new();
            // The sender closes after a single question. Keep an explicit bound.
            let Ok(_) = socket.take(1537).read_to_end(&mut bytes) else { continue };
            if bytes.is_empty() || bytes.len() > 1536 { continue }
            let Ok(query) = String::from_utf8(bytes) else { continue };
            let query = query.trim();
            if query.len() < 4 || query.chars().any(|c| c.is_control()) { continue }
            let _ = app.emit("b25-context-query", query.to_owned());
        }
    });
}
