use tauri::State;
use crate::AppState;
use rusqlite::params;

#[tauri::command]
pub fn batch_soft_delete(state: State<'_, AppState>, ids: Vec<String>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    for id_str in ids {
        if let Ok(id_int) = id_str.parse::<i64>() {
            let _ = conn.execute(
                "UPDATE notes SET is_deleted = 1, updated_at = ? WHERE id = ?",
                params![now, id_int],
            );
        }
    }
    Ok(())
}

#[tauri::command]
pub fn batch_toggle_pin(state: State<'_, AppState>, ids: Vec<String>, pin: bool) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let val = if pin { 1 } else { 0 };

    for id_str in ids {
        if let Ok(id_int) = id_str.parse::<i64>() {
            let _ = conn.execute(
                "UPDATE notes SET is_pinned = ? WHERE id = ?",
                params![val, id_int],
            );
        }
    }
    Ok(())
}
