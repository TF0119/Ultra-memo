use tauri::State;
use crate::AppState;
use rusqlite::params;

#[tauri::command]
pub fn batch_soft_delete(state: State<'_, AppState>, ids: Vec<String>) -> Result<(), String> {
    let mut conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    for id_str in ids {
        let id_int = id_str.parse::<i64>().map_err(|_| format!("Invalid ID: {}", id_str))?;
        tx.execute(
            "UPDATE notes SET is_deleted = 1, updated_at = ? WHERE id = ?",
            params![now, id_int],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "DELETE FROM open_state WHERE note_id = ?",
            params![id_int],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE notes SET is_open = 0 WHERE id = ?",
            params![id_int],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn batch_toggle_pin(state: State<'_, AppState>, ids: Vec<String>, pin: bool) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let val = if pin { 1 } else { 0 };

    for id_str in ids {
        if let Ok(id_int) = id_str.parse::<i64>() {
            conn.execute(
                "UPDATE notes SET is_pinned = ? WHERE id = ?",
                params![val, id_int],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
