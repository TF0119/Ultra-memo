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

#[tauri::command]
pub fn search_notes(state: State<'_, AppState>, query: String, limit: i64) -> Result<Vec<SearchResult>, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    
    // FTS5 MATCH query
    let mut stmt = conn.prepare(
        "SELECT rowid, title, snippet(notes_fts, 1, '<b>', '</b>', '...', 64), rank 
         FROM notes_fts 
         WHERE notes_fts MATCH ? 
         ORDER BY rank 
         LIMIT ?"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![query, limit], |row| {
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
