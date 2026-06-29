use tauri::State;
use crate::AppState;

struct NoteRow {
    id: i64,
    parent_id: Option<i64>,
    title: String,
    content: String,
    order_key: f64,
}

fn build_markdown(notes: &[NoteRow], parent_id: Option<i64>, depth: usize) -> String {
    let mut children: Vec<&NoteRow> = notes
        .iter()
        .filter(|n| n.parent_id == parent_id)
        .collect();
    children.sort_by(|a, b| a.order_key.partial_cmp(&b.order_key).unwrap());

    let mut output = String::new();
    for child in children {
        let level = (depth + 1).min(6);
        let hashes = "#".repeat(level);
        output.push_str(&format!("{} {}\n\n", hashes, child.title));
        if !child.content.is_empty() {
            output.push_str(&child.content);
            if !child.content.ends_with('\n') {
                output.push('\n');
            }
            output.push('\n');
        }
        output.push_str(&build_markdown(notes, Some(child.id), depth + 1));
    }
    output
}

#[tauri::command]
pub fn export_markdown_tree(state: State<'_, AppState>) -> Result<String, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, parent_id, title, content, order_key
             FROM notes WHERE is_deleted = 0
             ORDER BY parent_id, order_key",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(NoteRow {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                order_key: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut notes = Vec::new();
    for row in rows {
        notes.push(row.map_err(|e| e.to_string())?);
    }

    Ok(build_markdown(&notes, None, 0))
}
