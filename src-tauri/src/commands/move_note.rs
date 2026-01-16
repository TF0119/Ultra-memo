use tauri::State;
use crate::AppState;
use rusqlite::{params, OptionalExtension};

/// Move a note to a new position.
/// - new_parent_id: The new parent (null for root)
/// - after_id: Place the note AFTER this sibling. If None, place at the beginning.
#[tauri::command]
pub fn move_note(
    state: State<'_, AppState>,
    note_id: String,
    new_parent_id: Option<String>,
    _before_id: Option<String>, // Ignored in new simple system
    after_id: Option<String>,   // Place after this node
) -> Result<(), String> {
    let mut conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let note_id_int = note_id.parse::<i64>().map_err(|_| "Invalid Note ID")?;

    // Prevent moving into self
    if let Some(ref pid) = new_parent_id {
        if pid == &note_id {
            return Err("Cannot move node into itself".into());
        }
    }

    let new_parent_id_int: Option<i64> = match new_parent_id.as_ref() {
        Some(s) => Some(s.parse::<i64>().map_err(|_| "Invalid Parent ID")?),
        None => None,
    };

    // Cycle check: ensure new_parent is not a descendant of note_id
    if let Some(target_parent) = new_parent_id_int {
        let mut current = target_parent;
        loop {
            if current == note_id_int {
                return Err("Cannot move node into its own descendant".into());
            }
            // parent_id can be NULL (for root nodes), so read as Option<i64>
            let p_res: Option<Option<i64>> = conn.query_row(
                "SELECT parent_id FROM notes WHERE id = ?",
                [current],
                |row| row.get::<_, Option<i64>>(0)
            ).optional().map_err(|e| e.to_string())?;
            
            match p_res {
                Some(Some(pid)) => current = pid, // Has a parent, continue up the tree
                Some(None) => break,              // Reached root (parent_id is NULL)
                None => break,                    // Node not found
            }
        }
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Get all siblings of the target parent (excluding the moving node), sorted by order_key
    let mut siblings: Vec<i64> = {
        let (sql, params_vec): (&str, Vec<&dyn rusqlite::ToSql>) = match new_parent_id_int {
            Some(ref pid) => (
                "SELECT id FROM notes WHERE parent_id = ? AND is_deleted = 0 AND id != ? ORDER BY order_key",
                vec![pid, &note_id_int],
            ),
            None => (
                "SELECT id FROM notes WHERE parent_id IS NULL AND is_deleted = 0 AND id != ? ORDER BY order_key",
                vec![&note_id_int],
            ),
        };

        let mut stmt = tx.prepare(sql).map_err(|e| e.to_string())?;
        
        // Convert Vec<&dyn ToSql> to slice for query_map
        let rows = stmt.query_map(params_vec.as_slice(), |row| row.get(0))
            .map_err(|e| e.to_string())?;
        
        let mut ids = Vec::new();
        for row in rows {
            ids.push(row.map_err(|e| e.to_string())?);
        }
        ids
    };

    // Determine insertion index
    // We insert AT the position of target_id (pushing it down), not after it
    let insert_index = if let Some(target_id_str) = after_id {
        let target_id_int = target_id_str.parse::<i64>().map_err(|_| "Invalid Target ID")?;
        // Find position of target_id and insert AT that position
        match siblings.iter().position(|&id| id == target_id_int) {
            Some(pos) => pos, // Insert AT this position (target gets pushed down)
            None => siblings.len(), // If not found, append to end
        }
    } else {
        siblings.len() // No target means append to end
    };

    // Insert the moving node at the calculated position
    siblings.insert(insert_index, note_id_int);

    // Update order_key for all siblings: 0, 1000, 2000, 3000, ...
    // Using 1000 increments to leave room for future inserts without full reindex
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    for (i, sibling_id) in siblings.iter().enumerate() {
        let new_order = (i as f64) * 1000.0;
        tx.execute(
            "UPDATE notes SET order_key = ?, updated_at = ? WHERE id = ?",
            params![new_order, now, sibling_id]
        ).map_err(|e| e.to_string())?;
    }

    // Update parent_id for the moved note
    tx.execute(
        "UPDATE notes SET parent_id = ? WHERE id = ?",
        params![new_parent_id_int, note_id_int]
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}
