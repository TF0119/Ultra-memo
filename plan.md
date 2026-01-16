# plan.md
# Ultra Memo (仮) 統合計画書（フロント＋バック）

## 0. 目的
- Windows上で動作する「最強・最高・最速」メモアプリを作る
- 左ツリーがすべてを支配する（タブ無し、ツリー＝縦タブ）
- ノートがノートを持つ階層（Test.txt └ Test1.txt）をUXの核にする
- 分割エディタで比較を成立させる（ツリーから開くだけで完結）

## 1. 体験の核（要件固定）
### 1.1 ツリー＝縦タブ
- Open/Active/Selectedの3状態を分離する
- Activeは強調表示、Openはインジケータ表示

### 1.2 タブ無しで破綻しない条件
- ツリー強調（Active）
- Follow Active（自動追従）デフォルトON
- Ctrl+P（検索ジャンプ）を最短動線として必須
- 分割（2ペイン固定）+ Ctrl+Enter（反対ペインに開く）

### 1.3 優先ショートカット
- Ctrl+N：同階層に新規
- Ctrl+Shift+N：子ノートとして新規
- Ctrl+P：クイックスイッチャ
- Ctrl+Enter：反対ペインに開く（2ペイン時）
- Ctrl+1 / Ctrl+2：ペインフォーカス切替
- Enter：フォーカス中ペインに開く

## 2. アーキテクチャ
- フロント：Svelte + Vite + CodeMirror 6 + Tree仮想化
- バック：Tauri v2 + Rust + SQLite(WAL) + FTS5
- データ：SQLite単一ファイル（バックアップ最強）

## 3. ディレクトリ構成（推奨）
- `app/`
  - `src/`（フロント）
    - `components/`
      - `TreeSidebar/`
      - `EditorWorkspace/`
      - `QuickSwitcher/`
    - `stores/`（状態管理）
    - `tauri/`（API呼び出しラッパ）
  - `src-tauri/`（バック）
    - `db/`
      - `migrations/`
      - `schema.sql`
    - `commands/`
      - `tree.rs`
      - `notes.rs`
      - `search.rs`
      - `move.rs`
    - `lib.rs`

## 4. API契約（フロント↔バックの境界を固定）
最低限のコマンドセット：
- Tree
  - `get_tree_snapshot()`
  - `get_path(note_id)`
- Notes
  - `get_note(note_id)`
  - `update_note(note_id, title?, content?)`
  - `create_sibling(selected_id)`  # Ctrl+N
  - `create_child(parent_id)`      # Ctrl+Shift+N
  - `rename_note(note_id, new_title)`
  - `soft_delete_note(note_id)`
- Move
  - `move_note(note_id, new_parent_id, before_id?, after_id?)`
- Search
  - `search_notes(query, limit)`   # Ctrl+P
- Open state
  - `mark_open(note_id, bool)`
  - `touch_open(note_id)`
  - `get_open_list(limit)`

## 5. 実装マイルストーン（統合）
### Milestone M1: 起動して「作れる・開ける・書ける」
- AppShell（左右レイアウト）
- TreeSnapshot表示（仮想化）
- ノートを開いて編集できる（CodeMirror）
- デバウンス保存

完了条件：
- ノート作成→編集→再起動後も残る

### Milestone M2: “革新的ツリーUX”の核を完成
- Ctrl+N（同階層新規）
- Ctrl+Shift+N（子新規）
- 作成直後のインラインリネーム / 即入力開始

完了条件：
- ツリー操作だけで高速に派生メモを増やせる

### Milestone M3: タブ無しでも破綻しない（縦タブ完成）
- Active強調
- Openインジケータ（縦タブ）
- Follow Active（追従）

完了条件：
- 迷子にならず、前に見ていたノートへ戻れる感覚が成立

### Milestone M4: 比較（2ペイン）を成立
- 2ペイン分割 + Splitter
- Ctrl+Enter（反対ペインに開く）
- Ctrl+1/2（フォーカス切替）

完了条件：
- 2つのノートを並べて読み書きできる

### Milestone M5: Ctrl+P（クイックスイッチャ）
- FTS5導入
- 検索モーダル（Enter/Ctrl+Enter）

完了条件：
- 目的のノートに“ほぼ瞬間移動”できる

### Milestone M6: D&D移動・並べ替え
- 同階層並び替え
- 階層移動
- 循環禁止

完了条件：
- ツリー構造を体感劣化なく編集できる

## 6. パフォーマンス・品質ゲート（妥協しない）
- ツリーは必ず仮想化
- DBはWAL、検索はFTS5
- エディタ入力でカクつき禁止（保存はデバウンス、処理は非同期）
- move/create/updateは必ずトランザクション
- 大量ノードでもツリー表示・検索が劣化しない

## 7. 追加（任意・後回しでOK）
- Breadcrumb（最小）
- エクスポート（Markdownツリー出力）
- ピン留め（Openの固定）
- 同期スクロール
- 履歴（戻る/進む）※個人利用なら後回しでも可

## 8. 完成の定義（このアプリが“最強”と呼べる条件）
- タブ無しでも迷わず、ツリーだけで運用が完結する
- Ctrl+N / Ctrl+Shift+N の生成速度が「思考速度に追従」している
- Ctrl+P で瞬間移動でき、2ペイン比較が自然
- 大量ノードでも常に軽い（ツリー、検索、編集すべて）
