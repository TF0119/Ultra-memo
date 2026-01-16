use tauri::{State};
use crate::AppState;
use crate::commands::tree::TreeNode;
use rusqlite::{params, OptionalExtension};

#[derive(serde::Serialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub updated_at: i64,
}

#[tauri::command]
pub fn get_note(state: State<'_, AppState>, id: String) -> Result<Note, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let id_int = id.parse::<i64>().map_err(|_| "Invalid ID format")?;

    let note = conn.query_row(
        "SELECT id, title, content, updated_at FROM notes WHERE id = ?",
        [id_int],
        |row| {
            Ok(Note {
                id: row.get::<_, i64>(0)?.to_string(),
                title: row.get(1)?,
                content: row.get(2)?,
                updated_at: row.get(3)?,
            })
        },
    ).map_err(|e| e.to_string())?;

    Ok(note)
}

#[tauri::command]
pub fn update_note(
    state: State<'_, AppState>,
    id: String,
    title: Option<String>,
    content: Option<String>,
) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let id_int = id.parse::<i64>().map_err(|_| "Invalid ID format")?;
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;

    if title.is_none() && content.is_none() {
        return Ok(now);
    }

    if let Some(t) = title {
        conn.execute("UPDATE notes SET title = ?, updated_at = ? WHERE id = ?", params![t, now, id_int]).map_err(|e| e.to_string())?;
    }
    if let Some(c) = content {
        conn.execute("UPDATE notes SET content = ?, updated_at = ? WHERE id = ?", params![c, now, id_int]).map_err(|e| e.to_string())?;
    }

    Ok(now)
}

#[tauri::command]
pub fn create_sibling(state: State<'_, AppState>, selected_id: String) -> Result<TreeNode, String> {
    let mut conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let selected_id_int = selected_id.parse::<i64>().map_err(|_| "Invalid ID format")?;
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let (parent_id, order_key): (Option<i64>, f64) = tx.query_row(
        "SELECT parent_id, order_key FROM notes WHERE id = ?",
        [selected_id_int],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).map_err(|e| e.to_string())?;

    let next_order: Option<f64> = match parent_id {
        Some(pid) => tx.query_row(
            "SELECT order_key FROM notes WHERE parent_id = ? AND order_key > ? ORDER BY order_key ASC LIMIT 1",
            params![pid, order_key],
            |row| row.get(0)
        ).optional().map_err(|e| e.to_string())?,
        None => tx.query_row(
            "SELECT order_key FROM notes WHERE parent_id IS NULL AND order_key > ? ORDER BY order_key ASC LIMIT 1",
            params![order_key],
            |row| row.get(0)
        ).optional().map_err(|e| e.to_string())?,
    };

    let new_order = match next_order {
        Some(next) => (order_key + next) / 2.0,
        None => order_key + 1024.0,
    };

    tx.execute(
        "INSERT INTO notes (parent_id, title, content, order_key, is_open, is_deleted, created_at, updated_at) 
         VALUES (?, ?, ?, ?, 0, 0, ?, ?)",
        params![parent_id, "New Note", "", new_order, now, now]
    ).map_err(|e| e.to_string())?;

    let new_id = tx.last_insert_rowid();
    tx.commit().map_err(|e| e.to_string())?;

    Ok(TreeNode {
        id: new_id.to_string(),
        parent_id: parent_id.map(|id| id.to_string()),
        title: "New Note".to_string(),
        content: "".to_string(),
        order_key: new_order,
        is_open: false,
        is_pinned: false,
        created_at: now,
        updated_at: now,
        has_children: false,
    })
}

#[tauri::command]
pub fn create_child(state: State<'_, AppState>, parent_id: Option<String>) -> Result<TreeNode, String> {
    let mut conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let parent_id_int = match parent_id.as_ref() {
        Some(id_str) => Some(id_str.parse::<i64>().map_err(|_| "Invalid Parent ID")?),
        None => None,
    };
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let max_order: Option<f64> = match parent_id_int {
        Some(pid) => tx.query_row(
            "SELECT MAX(order_key) FROM notes WHERE parent_id = ?",
            [pid],
            |row| row.get::<_, Option<f64>>(0)
        ).map_err(|e| e.to_string())?,
        None => tx.query_row(
            "SELECT MAX(order_key) FROM notes WHERE parent_id IS NULL",
            [],
            |row| row.get::<_, Option<f64>>(0)
        ).map_err(|e| e.to_string())?,
    };

    let new_order = max_order.unwrap_or(0.0) + 1024.0;

    tx.execute(
        "INSERT INTO notes (parent_id, title, content, order_key, is_open, is_deleted, created_at, updated_at) 
         VALUES (?, ?, ?, ?, 0, 0, ?, ?)",
        params![parent_id_int, "New Child", "", new_order, now, now]
    ).map_err(|e| e.to_string())?;

    let new_id = tx.last_insert_rowid();
    tx.commit().map_err(|e| e.to_string())?;

    Ok(TreeNode {
        id: new_id.to_string(),
        parent_id: parent_id,
        title: "New Child".to_string(),
        content: "".to_string(),
        order_key: new_order,
        is_open: false,
        is_pinned: false,
        created_at: now,
        updated_at: now,
        has_children: false,
    })
}

#[tauri::command]
pub fn rename_note(state: State<'_, AppState>, id: String, new_title: String) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let id_int = id.parse::<i64>().map_err(|_| "Invalid ID format")?;
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;

    conn.execute(
        "UPDATE notes SET title = ?, updated_at = ? WHERE id = ?",
        params![new_title, now, id_int],
    ).map_err(|e| e.to_string())?;

    Ok(now)
}

#[tauri::command]
pub fn soft_delete_note(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let id_int = id.parse::<i64>().map_err(|_| "Invalid ID format")?;
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;

    // Soft delete: is_deleted = 1
    // Does not delete children? Plan says "soft_delete_note".
    // Usually tree delete implies recursive delete or hiding children.
    // Logic: Frontend hides children if parent is deleted?
    // DB layer: Cascading? SQLite "ON DELETE CASCADE" is for hard delete.
    // For soft delete, we should ideally mark children too, or just mark target and let frontend/query handle it.
    // Tree query `get_tree_snapshot` filters `is_deleted = 0`.
    // If a parent is deleted but children are not, children become orphans or just disappear from tree view?
    // They are physically children of deleted node.
    // `get_tree_snapshot` query returns "WHERE is_deleted = 0".
    // If parent is filtered out, children (with valid parent_id) will be returned but might not show in UI if UI builds tree starting from root?
    // Frontend `TreeSidebar` filters `rootNodes` (parent=null).
    // Children are rendered recursively. If parent is gone, children won't be reached.
    // So masking parent is enough for UI.
    
    conn.execute(
        "UPDATE notes SET is_deleted = 1, updated_at = ? WHERE id = ?",
        params![now, id_int],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn toggle_pin_note(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let id_int = id.parse::<i64>().map_err(|_| "Invalid ID format")?;

    // Get current pin state
    let is_pinned: i64 = conn.query_row(
        "SELECT is_pinned FROM notes WHERE id = ?",
        [id_int],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;

    let new_state = if is_pinned == 0 { 1 } else { 0 };

    conn.execute(
        "UPDATE notes SET is_pinned = ? WHERE id = ?",
        params![new_state, id_int],
    ).map_err(|e| e.to_string())?;

    Ok(new_state == 1)
}
