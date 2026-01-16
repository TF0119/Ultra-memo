use serde::Serialize;
use tauri::State;
use crate::AppState;
use rusqlite::params;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletedNote {
    pub id: String,
    pub title: String,
    pub deleted_at: i64,
}

/// Get all deleted notes
#[tauri::command]
pub fn get_deleted_notes(state: State<'_, AppState>) -> Result<Vec<DeletedNote>, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    
    let mut stmt = conn.prepare(
        "SELECT id, title, updated_at FROM notes WHERE is_deleted = 1 ORDER BY updated_at DESC"
    ).map_err(|e| e.to_string())?;
    
    let notes = stmt.query_map([], |row| {
        Ok(DeletedNote {
            id: row.get::<_, i64>(0)?.to_string(),
            title: row.get(1)?,
            deleted_at: row.get(2)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut result = Vec::new();
    for note in notes {
        result.push(note.map_err(|e| e.to_string())?);
    }
    
    Ok(result)
}

/// Restore a deleted note
#[tauri::command]
pub fn restore_note(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let id_int = id.parse::<i64>().map_err(|_| "Invalid Note ID")?;
    
    conn.execute(
        "UPDATE notes SET is_deleted = 0 WHERE id = ?",
        params![id_int]
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

/// Permanently delete a note (hard delete)
#[tauri::command]
pub fn hard_delete_note(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let id_int = id.parse::<i64>().map_err(|_| "Invalid Note ID")?;
    
    // Delete the note and all its children (recursive)
    // First, collect all descendant IDs
    let mut ids_to_delete = vec![id_int];
    let mut i = 0;
    while i < ids_to_delete.len() {
        let current_id = ids_to_delete[i];
        let mut stmt = conn.prepare(
            "SELECT id FROM notes WHERE parent_id = ?"
        ).map_err(|e| e.to_string())?;
        
        let children: Vec<i64> = stmt.query_map([current_id], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        
        ids_to_delete.extend(children);
        i += 1;
    }
    
    // Delete all collected notes
    for delete_id in ids_to_delete {
        conn.execute(
            "DELETE FROM notes WHERE id = ?",
            params![delete_id]
        ).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
