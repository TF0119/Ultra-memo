use rusqlite::{Connection, Result};
use std::fs;
use tauri::AppHandle;
use tauri::Manager;

const DB_FILENAME: &str = "ultra_memo.db";

pub fn init_db(app: &AppHandle) -> Result<Connection> {
    let app_data_dir = app.path().app_data_dir().expect("failed to get app data dir");
    
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir).expect("failed to create app data dir");
    }

    let db_path = app_data_dir.join(DB_FILENAME);
    let mut conn = Connection::open(db_path)?;

    // PRAGMA settings for performance and safety
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA temp_store = MEMORY;
         PRAGMA foreign_keys = ON;",
    )?;

    migrate(&mut conn)?;

    Ok(conn)
}

fn migrate(conn: &mut Connection) -> Result<()> {
    let tx = conn.transaction()?;

    // Table: notes
    tx.execute(
        "CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            parent_id INTEGER NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            order_key REAL NOT NULL,
            is_open INTEGER NOT NULL DEFAULT 0,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (parent_id) REFERENCES notes(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Indexes
    tx.execute(
        "CREATE INDEX IF NOT EXISTS idx_notes_parent_order ON notes (parent_id, order_key)",
        [],
    )?;
    tx.execute(
        "CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes (updated_at)",
        [],
    )?;
    tx.execute(
        "CREATE INDEX IF NOT EXISTS idx_notes_open ON notes (is_open, updated_at)",
        [],
    )?;

    // Migration: Add is_pinned column if it doesn't exist
    let columns: Vec<String> = tx.prepare("PRAGMA table_info(notes)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();
    
    if !columns.contains(&"is_pinned".to_string()) {
        tx.execute("ALTER TABLE notes ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0", [])?;
    }
    
    // Migration: Add is_markdown_view column if it doesn't exist
    if !columns.contains(&"is_markdown_view".to_string()) {
        tx.execute("ALTER TABLE notes ADD COLUMN is_markdown_view INTEGER NOT NULL DEFAULT 0", [])?;
    }

    // FTS5 Virtual Table
    tx.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(title, content, content='notes', content_rowid='id')",
        [],
    )?;

    // Open State (LRU)
    tx.execute(
        "CREATE TABLE IF NOT EXISTS open_state (
            note_id INTEGER PRIMARY KEY,
            last_opened_at INTEGER NOT NULL,
            FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Triggers for FTS5 synchronization
    tx.execute(
        "CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
            INSERT INTO notes_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
        END;",
        [],
    )?;
    tx.execute(
        "CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
            INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
        END;",
        [],
    )?;
    tx.execute(
        "CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
            INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
            INSERT INTO notes_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
        END;",
        [],
    )?;

    // Insert Initial Welcome Note if empty
    let count: i64 = tx.query_row("SELECT COUNT(*) FROM notes", [], |r| r.get(0))?;
    if count == 0 {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;
        
        tx.execute(
            "INSERT INTO notes (title, content, order_key, is_open, is_deleted, created_at, updated_at) 
             VALUES (?, ?, ?, 1, 0, ?, ?)",
            params![
                "Welcome to Ultra Memo",
                "# Welcome to Ultra Memo\n\nこれは最強・最高・最速のメモアプリです。\n\n## 主な機能\n- **ツリー構造**: ノートを階層で管理\n- **タブレス**: 2ペイン分割でノートを比較・編集\n- **FTS5 検索**: `Ctrl+P` で瞬時に検索（スニペット表示付き）\n- **CodeMirror 6**: 快適な Markdown 編集と安定した日本語入力\n\n## ショートカット\n- `Ctrl+N`: 同階層に新規ノート\n- `Ctrl+Shift+N`: 子ノートを作成\n- `Ctrl+P`: 検索 (Quick Switcher)\n- `Ctrl+1 / 2`: 左右ペインの切り替え\n- `Enter`: ノートを開く\n- `Ctrl+Enter`: 反対のペインでノートを開く\n\nさあ、ここから最強のメモ体験を始めましょう！",
                1024.0,
                now,
                now
            ],
        )?;

        let new_id = tx.last_insert_rowid();
        tx.execute(
            "INSERT INTO open_state (note_id, last_opened_at) VALUES (?, ?)",
            [new_id, now],
        )?;
    }

    tx.commit()?;
    Ok(())
}

use rusqlite::params;
