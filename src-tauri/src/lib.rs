use std::fs;
use tauri_plugin_dialog::DialogExt;
use std::process::Command;

#[tauri::command]
fn open_release_page(version: String) -> Result<(), String> {
    let valid = version.split('.').count() == 3
        && version.split('.').all(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit()));
    if !valid {
        return Err("Ungültige Release-Version.".into());
    }
    let url = format!("https://github.com/MrK235/RohrRunner/releases/tag/v{version}");
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        Command::new("cmd")
            .args(["/C", "start", "", &url])
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|error| format!("Browser konnte nicht gestartet werden: {error}"))?;
    }
    #[cfg(target_os = "linux")]
    Command::new("xdg-open")
        .arg(&url)
        .spawn()
        .map_err(|error| format!("Browser konnte nicht gestartet werden: {error}"))?;
    Ok(())
}

#[tauri::command]
async fn save_export_file(
    app: tauri::AppHandle,
    default_name: String,
    filter_name: String,
    extension: String,
    data: Vec<u8>,
) -> Result<Option<String>, String> {
    let selected = app
        .dialog()
        .file()
        .set_file_name(default_name)
        .add_filter(&filter_name, &[extension.as_str()])
        .blocking_save_file();
    let Some(file_path) = selected else {
        return Ok(None);
    };
    let path = file_path
        .into_path()
        .map_err(|error| format!("Zieldatei konnte nicht bestimmt werden: {error}"))?;
    fs::write(&path, data).map_err(|error| format!("Datei konnte nicht gespeichert werden: {error}"))?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_export_file, open_release_page])
        .run(tauri::generate_context!())
        .expect("error while running RohrRunner");
}
