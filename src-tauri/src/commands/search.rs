use tauri::State;
use crate::AppState;
use rusqlite::params;

#[derive(serde::Serialize)]
pub struct SearchResult {
    id: String,
    title: String,
    snippet: String,
    rank: f64,
}

/// Quote each whitespace-separated token for safe FTS5 MATCH queries.
fn fts_query(raw: &str) -> Option<String> {
    let terms: Vec<String> = raw
        .split_whitespace()
        .filter(|t| !t.is_empty())
        .map(|t| {
            let escaped = t.replace('"', "\"\"");
            format!("\"{}\"", escaped)
        })
        .collect();
    if terms.is_empty() {
        return None;
    }
    Some(terms.join(" "))
}

#[tauri::command]
pub fn search_notes(state: State<'_, AppState>, query: String, limit: i64) -> Result<Vec<SearchResult>, String> {
    let fts = match fts_query(&query) {
        Some(q) => q,
        None => return Ok(Vec::new()),
    };

    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;

    let mut stmt = conn.prepare(
        "SELECT n.id, n.title, snippet(notes_fts, 1, '<b>', '</b>', '...', 64), rank
         FROM notes_fts
         JOIN notes n ON n.id = notes_fts.rowid
         WHERE notes_fts MATCH ? AND n.is_deleted = 0
         ORDER BY rank
         LIMIT ?"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![fts, limit], |row| {
        Ok(SearchResult {
            id: row.get::<_, i64>(0)?.to_string(),
            title: row.get(1)?,
            snippet: row.get(2)?,
            rank: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }

    Ok(results)
}
