// MIT License - Copyright (c) 2026 BestPerformance Contributors

//! Loopback-only intake for one search word from LinguaRelay.
//! Binds 127.0.0.1:47631 and emits `lingua-query`. Nothing here is reachable
//! from another machine, and the payload is cut down to a short ASCII token.

use std::io::Read;
use std::net::TcpListener;
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter};

const PORT: u16 = 47631;

pub fn start(app: AppHandle) {
    thread::spawn(move || {
        let listener = match TcpListener::bind(("127.0.0.1", PORT)) {
            Ok(listener) => listener,
            Err(error) => {
                log::warn!("lingua search listener failed: {error}");
                return;
            }
        };
        for stream in listener.incoming() {
            let Ok(mut stream) = stream else {
                continue;
            };
            let _ = stream.set_read_timeout(Some(Duration::from_millis(400)));
            let mut buf = [0u8; 80];
            let Ok(n) = stream.read(&mut buf) else {
                continue;
            };
            let word = sanitize(&buf[..n]);
            if word.is_empty() {
                continue;
            }
            let _ = app.emit("lingua-query", word);
        }
    });
}

fn sanitize(bytes: &[u8]) -> String {
    let text = String::from_utf8_lossy(bytes);
    text.chars()
        .take(48)
        .filter(|ch| ch.is_ascii_alphanumeric() || *ch == '-' || *ch == '\'')
        .collect()
}
