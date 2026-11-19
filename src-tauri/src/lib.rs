use std::{fs, time::Duration};
use serde::Serialize;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_updater::UpdaterExt;

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

#[derive(Serialize)]
struct UpdateInfo {
    version: String,
    notes: Option<String>,
}

#[tauri::command]
async fn check_for_update(app: tauri::AppHandle) -> Result<Option<UpdateInfo>, String> {
    let updater = app
        .updater_builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| format!("Updater konnte nicht gestartet werden: {error}"))?;
    let update = updater
        .check()
        .await
        .map_err(|error| format!("Update konnte nicht geprüft werden: {error}"))?;
    Ok(update.map(|update| UpdateInfo {
        version: update.version,
        notes: update.body,
    }))
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app
        .updater_builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| format!("Updater konnte nicht gestartet werden: {error}"))?;
    let update = updater
        .check()
        .await
        .map_err(|error| format!("Update konnte nicht geprüft werden: {error}"))?;
    let Some(update) = update else {
        return Err("Es ist kein Update mehr verfügbar.".to_string());
    };
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|error| format!("Update konnte nicht installiert werden: {error}"))?;
    app.restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![save_export_file, check_for_update, install_update])
        .run(tauri::generate_context!())
        .expect("error while running RohrRunner");
}
