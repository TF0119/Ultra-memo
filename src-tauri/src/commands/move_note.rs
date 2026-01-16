use tauri::State;
use crate::AppState;
use rusqlite::{params, OptionalExtension};

#[tauri::command]
pub fn move_note(
    state: State<'_, AppState>,
    note_id: String,
    new_parent_id: Option<String>,
    before_id: Option<String>,
    after_id: Option<String>,
) -> Result<(), String> {
    let mut conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let note_id_int = note_id.parse::<i64>().map_err(|_| "Invalid Note ID")?;
    match &new_parent_id {
        Some(s) => if s == &note_id { return Err("Cannot move node into itself".into()); },
        None => {}
    };

    let new_parent_id_int = match new_parent_id.as_ref() {
        Some(s) => Some(s.parse::<i64>().map_err(|_| "Invalid Parent ID")?),
        None => None,
    };

    // Cycle check
    // If moving to a new parent, ensure that new parent is not a descendant of note_id (or note_id itself).
    if let Some(target_parent) = new_parent_id_int {
        let mut current = target_parent; // i64
        loop {
            if current == note_id_int {
                return Err("Cannot move node into its own descendant".into());
            }
            // Get parent of current
            let p_res: Option<i64> = conn.query_row(
                "SELECT parent_id FROM notes WHERE id = ?",
                [current],
                |row| row.get(0)
            ).optional().map_err(|e| e.to_string())?;

            match p_res {
                Some(pid) => current = pid,
                None => break, // Reached root or node not found
            }
        }
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    // Calculate new order
    // fetch order of before and after
    let before_order: Option<f64> = match before_id {
        Some(s) => {
            let id = s.parse::<i64>().map_err(|_| "Invalid Before ID")?;
            tx.query_row("SELECT order_key FROM notes WHERE id = ?", [id], |r| r.get(0))
              .optional().map_err(|e| e.to_string())?
        },
        None => None
    };

    let after_order: Option<f64> = match after_id {
        Some(s) => {
            let id = s.parse::<i64>().map_err(|_| "Invalid After ID")?;
            tx.query_row("SELECT order_key FROM notes WHERE id = ?", [id], |r| r.get(0))
              .optional().map_err(|e| e.to_string())?
        },
        None => None
    };

    let new_order = match (before_order, after_order) {
        (Some(b), Some(a)) => (b + a) / 2.0,
        (Some(b), None) => b + 1024.0, // After 'before' (at end?) -> Wait. before_id is the node ABOVE?
        // Usually "before" means "places before this node" in API terms? 
        // Or "node that is before me"? 
        // Plan says: "before_id?, after_id? -> before/after from order_key".
        // Let's assume `before_id` is the node immediately PRECEDING the new position (above).
        // `after_id` is the node immediately FOLLOWING the new position (below).
        
        // Case: Insert between A (before) and B (after). New = (A+B)/2.
        // ((Some(b), Some(a)) => (b + a)/2.0)
        
        // Case: Insert at end (after A). `before_id` = A, `after_id` = None.
        // New = A + 1024.0.
        
        // Case: Insert at start (before B). `before_id` = None, `after_id` = B.
        // New = B / 2.0? Or B - 1024.0?
        // Order keys are REAL.
        // If B is 1024, B/2 = 512.
        // If B is negative? Unlikely, created > 0.
        // Anyhow B - constant or B/2 works.
        (None, Some(a)) => a - 1024.0, 
        
        (None, None) => 1024.0, // No siblings, becomes first child.
    };

    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;

    tx.execute(
        "UPDATE notes SET parent_id = ?, order_key = ?, updated_at = ? WHERE id = ?",
        params![new_parent_id_int, new_order, now, note_id_int]
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}
