use tauri::State;
use crate::AppState;
use rusqlite::params;

#[tauri::command]
pub fn mark_open(state: State<'_, AppState>, id: String, is_open: bool) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let id_int = id.parse::<i64>().map_err(|_| "Invalid ID format")?;
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
    
    // Update notes table
    conn.execute(
        "UPDATE notes SET is_open = ? WHERE id = ?",
        params![if is_open { 1 } else { 0 }, id_int]
    ).map_err(|e| e.to_string())?;

    // Update open_state table
    if is_open {
        conn.execute(
            "INSERT OR REPLACE INTO open_state (note_id, last_opened_at) VALUES (?, ?)",
            params![id_int, now]
        ).map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "DELETE FROM open_state WHERE note_id = ?",
            params![id_int]
        ).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
pub fn touch_open(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let id_int = id.parse::<i64>().map_err(|_| "Invalid ID format")?;
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
    
    // Ensure entry exists and update time
    conn.execute(
        "INSERT OR REPLACE INTO open_state (note_id, last_opened_at) VALUES (?, ?)",
        params![id_int, now]
    ).map_err(|e| e.to_string())?;
    
    // Ensure is_open is set
    conn.execute(
        "UPDATE notes SET is_open = 1 WHERE id = ?", 
        params![id_int]
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_open_list(state: State<'_, AppState>, limit: i64) -> Result<Vec<String>, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    
    let mut stmt = conn.prepare(
        "SELECT note_id FROM open_state ORDER BY last_opened_at DESC LIMIT ?"
    ).map_err(|e| e.to_string())?;
    
    let ids = stmt.query_map([limit], |row| {
        Ok(row.get::<_, i64>(0)?.to_string())
    }).map_err(|e| e.to_string())?;
    
    let mut result = Vec::new();
    for id in ids {
        result.push(id.map_err(|e| e.to_string())?);
    }
    Ok(result)
}
