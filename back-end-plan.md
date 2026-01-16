# back-bend-plan.md
# Ultra Memo (仮) バックエンド実装計画書（Tauri/Rust/SQLite）

## 0. ゴール
- SQLite（WAL）+ FTS5 により、ローカル最強の速度と信頼性を確立
- “ツリー＝縦タブ” を支える状態（Open/Active補助情報）を堅牢に管理
- 並べ替え・階層移動・検索を、常に高速・一貫性ありで提供

## 1. 技術スタック（バック）
- Tauri v2 + Rust
- SQLite（WAL）+ FTS5
- Rust SQLite driver（例：rusqlite）
- マイグレーション管理（起動時に適用）

## 2. DB設計（最強・最速の最小スキーマ）
### 2.1 notes
- `id INTEGER PRIMARY KEY`
- `parent_id INTEGER NULL`
- `title TEXT NOT NULL`
- `content TEXT NOT NULL DEFAULT ''`
- `order_key REAL NOT NULL`  # fractional indexing
- `is_open INTEGER NOT NULL DEFAULT 0`
- `is_deleted INTEGER NOT NULL DEFAULT 0`
- `created_at INTEGER NOT NULL`  # unix ms
- `updated_at INTEGER NOT NULL`

### 2.2 インデックス
- `idx_notes_parent_order (parent_id, order_key)`
- `idx_notes_updated (updated_at)`
- `idx_notes_open (is_open, updated_at)`

### 2.3 FTS（全文検索）
- `notes_fts`（FTS5 virtual table）
  - `title`, `content`
  - `content='notes'`, `content_rowid='id'` または外部コンテンツ方式
- INSERT/UPDATE/DELETEの同期はトリガーで保証

## 3. SQLiteパフォーマンス設定（起動時PRAGMA）
- `journal_mode = WAL`
- `synchronous = NORMAL`（個人用途で速度と安全のバランス）
- `temp_store = MEMORY`
- `foreign_keys = ON`
- 必要に応じて `cache_size` 調整

## 4. 並び順アルゴリズム（order_key）
### 4.1 fractional indexing（基本）
- 兄弟の間に挿入 → `new = (prev + next) / 2`
- 先頭挿入 → `next - 1` / 末尾挿入 → `prev + 1`

### 4.2 再正規化（詰まり対策）
- 同一親配下で order_key の差が極端に小さくなったら再採番
- 再採番は親配下のみ、トランザクション内で実施

## 5. “縦タブ”状態（Open管理）
- `is_open` は UI表示用の永続フラグ
- LRU順はDBに持たず、別テーブルで管理するか（推奨）、もしくは `updated_at` を利用
  - 推奨：`open_state` テーブルを追加（後回し可）
    - `note_id INTEGER PRIMARY KEY`
    - `last_opened_at INTEGER NOT NULL`
    - `pinned INTEGER NOT NULL DEFAULT 0`（任意）
- Open上限（例：50）はバックエンドで強制可能

## 6. API設計（Tauri commands）
フロントから呼ぶコマンドを固定し、UIが迷わない契約にする。

### 6.1 ツリー取得
- `get_tree_snapshot() -> TreeSnapshot`
  - ノード一覧（id, parent_id, title, has_children, is_open, is_deleted, order_key）
  - できれば “必要最小限” の軽量スナップショット
- `get_path(note_id) -> [ancestorIds...]`（Follow Active/Breadcrumb用）

### 6.2 ノートCRUD
- `get_note(note_id) -> {id, title, content, updated_at}`
- `update_note(note_id, title?, content?) -> updated_at`
  - content更新は頻繁なので最適化（単一UPDATE）
- `create_sibling(selected_id) -> new_id`
  - 親 = selected.parent_id
  - order_key = selected.order_key + ε（実際は近傍計算）
- `create_child(parent_id) -> new_id`
  - parent_id = selected_id
  - order_key = 末尾に追加（prev + 1）

### 6.3 リネーム・削除
- `rename_note(note_id, new_title)`
- `soft_delete_note(note_id)`（論理削除）
- `restore_note(note_id)`（任意）

### 6.4 移動・並べ替え（D&D）
- `move_note(note_id, new_parent_id, before_id?, after_id?)`
  - before/afterからorder_key計算
  - 循環参照の禁止（自分の子孫に移動不可）

### 6.5 Open（縦タブ）更新
- `mark_open(note_id, is_open: bool)`
- `touch_open(note_id)`（last_opened_at更新）
- `get_open_list(limit) -> [note_id...]`

### 6.6 検索（Ctrl+P用）
- `search_notes(query, limit) -> [{id, title, snippet, score}]`
  - snippetはFTSの機能 or 生成
  - limitはUI側が小さく（例：30）

## 7. 整合性・安全性
- すべての書き込みはトランザクション
- move/create は order_key 更新と親子更新を同一TXで確定
- 例外時はロールバックし、フロントにエラー型を返す（ユーザー向けは簡潔）

## 8. バックアップ・エクスポート（個人利用で最強に効く）
- 基本：SQLite単一ファイルをコピーするだけ
- 追加（任意）：
  - `export_markdown_tree(output_dir)`：階層をフォルダ/ファイルに吐き出し
  - `import_markdown_tree(input_dir)`：戻せる（後回し可）

## 9. テスト方針（最低限で強く）
- order_key計算（挿入・再正規化）
- move_note の循環禁止
- FTS同期（更新したら検索に出る）
- 大量ノード生成の性能（ツリー取得が劣化しない）

## 10. 実装ステップ（バック）
### Phase B1: DB基盤
- DBファイル作成、PRAGMA、migrations、基本CRUD

### Phase B2: TreeSnapshot
- ノード一覧取得、has_children計算（SQL最適化）

### Phase B3: Ctrl+N / Ctrl+Shift+N API
- create_sibling / create_child の確定
- 直後にフロントが開けるよう new_id を返す

### Phase B4: FTS5
- notes_fts導入、トリガー同期、search_notes実装

### Phase B5: Move & Reorder
- move_note実装（order_key計算、循環禁止）

### Phase B6: Open/LRU
- open_state導入（必要なら）
- 上限・touch・一覧提供

### Phase B7: Export/Import（任意）
- 単一ファイルバックアップに加え、Markdownエクスポート
