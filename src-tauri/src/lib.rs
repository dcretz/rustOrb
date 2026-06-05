// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::path::{Path, PathBuf};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000; // don't flash a console window

#[cfg(target_os = "windows")]
const CREATE_NEW_CONSOLE: u32 = 0x0000_0010; // open a fresh visible console window

/// Returns true if at least one Obsidian.exe process is running.
#[tauri::command]
fn is_obsidian_running() -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        if let Ok(out) = Command::new("tasklist")
            .args(["/FI", "IMAGENAME eq Obsidian.exe", "/NH"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        {
            let s = String::from_utf8_lossy(&out.stdout).to_lowercase();
            return s.contains("obsidian.exe");
        }
    }
    false
}

/// Force-closes all Obsidian.exe processes.
#[tauri::command]
fn close_obsidian() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        Command::new("taskkill")
            .args(["/IM", "Obsidian.exe", "/F"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(serde::Serialize)]
struct Project {
    /// folder name inside "10 Projects"
    name: String,
    /// code folder to open in VSCode, read from `path:` in details.md (if present)
    path: Option<String>,
    /// absolute path to the project's details.md note (for opening in Obsidian)
    note: String,
    /// ssh command line read from `ssh.md` — when present this is not a real
    /// project but an SSH target that opens a terminal on click
    ssh: Option<String>,
}

/// Opens a new console window running the given SSH command (kept open via /k).
#[tauri::command]
fn open_ssh(command: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        Command::new("cmd")
            .args(["/k", &command])
            .creation_flags(CREATE_NEW_CONSOLE)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = command;
    }
    Ok(())
}

/// Opens a project folder in a brand-new VSCode window, leaving any current
/// session untouched (`code --new-window`).
#[tauri::command]
fn open_in_vscode(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        // `code` is code.cmd on Windows, so go through cmd
        Command::new("cmd")
            .args(["/c", "code", "--new-window", &path])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        Command::new("code")
            .args(["--new-window", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Finds the open Obsidian vault path from Obsidian's own config.
fn obsidian_vault() -> Option<PathBuf> {
    let appdata = std::env::var("APPDATA").ok()?;
    let cfg = Path::new(&appdata).join("obsidian").join("obsidian.json");
    let data = std::fs::read_to_string(cfg).ok()?;
    let json: serde_json::Value = serde_json::from_str(&data).ok()?;
    let vaults = json.get("vaults")?.as_object()?;

    let mut first: Option<PathBuf> = None;
    for (_id, v) in vaults {
        if let Some(p) = v.get("path").and_then(|p| p.as_str()) {
            if v.get("open").and_then(|o| o.as_bool()).unwrap_or(false) {
                return Some(PathBuf::from(p));
            }
            if first.is_none() {
                first = Some(PathBuf::from(p));
            }
        }
    }
    first
}

/// Resolves a project's code path.
/// Preference: a dedicated `path.md` note (its first non-empty line) — else a
/// `path:` line inside `details.md`.
fn read_project_path(folder: &Path) -> Option<String> {
    // 1) dedicated path.md note — whole content is the path
    if let Ok(content) = std::fs::read_to_string(folder.join("path.md")) {
        for line in content.lines() {
            let l = line.trim().trim_matches('"').trim();
            // skip yaml fences / empty lines
            if l.is_empty() || l == "---" {
                continue;
            }
            // allow "path: C:\..." too, just in case
            let val = l.strip_prefix("path:").map(|s| s.trim()).unwrap_or(l);
            if !val.is_empty() {
                return Some(val.to_string());
            }
        }
    }

    // 2) fallback: a `path:` line in details.md
    if let Ok(content) = std::fs::read_to_string(folder.join("details.md")) {
        for line in content.lines() {
            let l = line.trim();
            if l.to_lowercase().starts_with("path:") {
                let val = l[5..].trim().trim_matches('"').trim().to_string();
                if !val.is_empty() {
                    return Some(val);
                }
            }
        }
    }

    None
}

/// Reads an SSH command from a project's `ssh.md` (first meaningful line).
/// Its presence marks the folder as an SSH target rather than a code project.
fn read_project_ssh(folder: &Path) -> Option<String> {
    let content = std::fs::read_to_string(folder.join("ssh.md")).ok()?;
    for line in content.lines() {
        let l = line.trim();
        if l.is_empty() || l == "---" {
            continue;
        }
        return Some(l.to_string());
    }
    None
}

/// Lists the project folders inside "<vault>/10 Projects".
#[tauri::command]
fn list_projects() -> Result<Vec<Project>, String> {
    let vault = obsidian_vault().ok_or("Obsidian vault not found")?;
    let dir = vault.join("10 Projects");

    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if !entry.file_type().map_err(|e| e.to_string())?.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let folder = entry.path();
        let ssh = read_project_ssh(&folder);
        // an SSH target ignores any code path so it never opens VSCode
        let path = if ssh.is_some() { None } else { read_project_path(&folder) };
        out.push(Project {
            name,
            path,
            note: folder.join("details.md").to_string_lossy().to_string(),
            ssh,
        });
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            is_obsidian_running,
            close_obsidian,
            list_projects,
            open_ssh,
            open_in_vscode
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
