use serde::Serialize;
use tauri::{State};
use crate::AppState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TreeNode {
    pub id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub content: String,
    pub order_key: f64,
    pub is_open: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub has_children: bool,
}

#[tauri::command]
pub fn get_tree_snapshot(state: State<'_, AppState>) -> Result<Vec<TreeNode>, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    
    // Fetch nodes with has_children check
    let mut stmt = conn.prepare(
        "SELECT 
            n.id, n.parent_id, n.title, n.content, n.order_key, n.is_open, n.created_at, n.updated_at,
            EXISTS(SELECT 1 FROM notes c WHERE c.parent_id = n.id AND c.is_deleted = 0) as has_children
         FROM notes n
         WHERE n.is_deleted = 0
         ORDER BY n.parent_id, n.order_key" // Ordering by parent mostly to group? Or order_key global? No, Tree usually needs recursion.
         // Frontend expects flat list? `store.ts` initializes with flat list.
         // So flat list is fine. Sorting order: Fractional indexing applies within siblings.
    ).map_err(|e| e.to_string())?;

    let nodes = stmt.query_map([], |row| {
        Ok(TreeNode {
            id: row.get::<_, i64>(0)?.to_string(), // Convert i64 to String
            parent_id: row.get::<_, Option<i64>>(1)?.map(|id| id.to_string()),
            title: row.get(2)?,
            content: row.get(3)?,
            order_key: row.get(4)?,
            is_open: row.get::<_, i64>(5)? != 0, // is_open stored as INTEGER (0/1)
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
            has_children: row.get::<_, i64>(8)? != 0,
        })
    }).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for node in nodes {
        result.push(node.map_err(|e| e.to_string())?);
    }

    Ok(result)
}
