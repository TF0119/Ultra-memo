use serde::Serialize;
use tauri::State;
use crate::AppState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BacklinkNote {
    pub id: String,
    pub title: String,
    pub snippet: String,
}

fn escape_like(s: &str) -> String {
    s.chars()
        .flat_map(|c| match c {
            '%' | '_' | '\\' | '[' => vec!['\\', c],
            c => vec![c],
        })
        .collect()
}

#[tauri::command]
pub fn resolve_wiki_link(state: State<'_, AppState>, title: String) -> Result<Option<String>, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let trimmed = title.trim();

    let id: Option<i64> = conn
        .query_row(
            "SELECT id FROM notes WHERE is_deleted = 0 AND title = ?1 COLLATE NOCASE LIMIT 1",
            [trimmed],
            |row| row.get(0),
        )
        .ok();

    Ok(id.map(|i| i.to_string()))
}

#[tauri::command]
pub fn get_backlinks(state: State<'_, AppState>, note_id: String) -> Result<Vec<BacklinkNote>, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let id_int = note_id.parse::<i64>().map_err(|_| "Invalid note ID")?;

    let title: String = conn
        .query_row(
            "SELECT title FROM notes WHERE id = ?1 AND is_deleted = 0",
            [id_int],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let pattern = format!("%[[{}]]%", escape_like(&title));
    let mut stmt = conn
        .prepare(
            "SELECT id, title, content FROM notes
             WHERE is_deleted = 0 AND id != ?1 AND content LIKE ?2 ESCAPE '\\'
             ORDER BY updated_at DESC LIMIT 30",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![id_int, pattern], |row| {
            let content: String = row.get(2)?;
            let snippet = content
                .lines()
                .find(|l| l.contains(&format!("[[{}]]", title)))
                .unwrap_or("")
                .chars()
                .take(120)
                .collect();
            Ok(BacklinkNote {
                id: row.get::<_, i64>(0)?.to_string(),
                title: row.get(1)?,
                snippet,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}
