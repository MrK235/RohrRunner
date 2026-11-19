use std::fs;
use tauri_plugin_dialog::DialogExt;

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
        .invoke_handler(tauri::generate_handler![save_export_file])
        .run(tauri::generate_context!())
        .expect("error while running RohrRunner");
}
