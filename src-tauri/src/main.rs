// Windows screensaver shell. Rename the built exe to `.scr`; Windows then launches it with:
//   /s          run full screen
//   /c[:HWND]   open settings (also what a plain double-click gets: no arguments)
//   /p HWND     draw into the Control Panel preview box (not supported: exit, preview stays blank)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{AppHandle, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder};

#[derive(Clone, Copy)]
enum Mode {
    Saver,
    Config,
    Preview,
}

fn parse_mode() -> Mode {
    let first = std::env::args().nth(1).unwrap_or_default().to_ascii_lowercase();
    match first.trim_start_matches(['/', '-']).chars().next() {
        Some('s') => Mode::Saver,
        Some('p') => Mode::Preview,
        _ => Mode::Config,
    }
}

/// Any window seeing the user come back ends the whole screensaver.
#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

/// Tells the page which mode it is in before any of its scripts run.
fn mode_script(mode: &str) -> String {
    format!("window.__SHARKS_MODE__ = {mode:?};")
}

fn open_savers(app: &AppHandle) -> tauri::Result<()> {
    let monitors = app.available_monitors()?;
    // One window per monitor, each with its own ocean. Physical units sidestep mixed-DPI setups.
    let screens: Vec<Option<(PhysicalPosition<i32>, PhysicalSize<u32>)>> = if monitors.is_empty() {
        vec![None]
    } else {
        monitors.iter().map(|m| Some((*m.position(), *m.size()))).collect()
    };
    for (i, screen) in screens.into_iter().enumerate() {
        let win = WebviewWindowBuilder::new(app, format!("saver-{i}"), WebviewUrl::App("index.html".into()))
            .initialization_script(&mode_script("saver"))
            .title("terminal-sharks")
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .visible(false)
            .build()?;
        if let Some((position, size)) = screen {
            win.set_position(position)?;
            win.set_size(size)?;
        }
        win.set_fullscreen(true)?;
        win.show()?;
        win.set_focus()?;
    }
    Ok(())
}

fn open_config(app: &AppHandle) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, "config", WebviewUrl::App("index.html".into()))
        .initialization_script(&mode_script("config"))
        .title("terminal-sharks 設定")
        .inner_size(480.0, 220.0)
        .resizable(false)
        .center()
        .build()?;
    Ok(())
}

fn main() {
    let mode = parse_mode();
    if let Mode::Preview = mode {
        return;
    }
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![quit])
        .setup(move |app| {
            let handle = app.handle();
            match mode {
                Mode::Saver => open_savers(handle)?,
                _ => open_config(handle)?,
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to start terminal-sharks");
}
