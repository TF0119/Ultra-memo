# front-end-plan.md
# Ultra Memo (仮) フロントエンド実装計画書

## 0. ゴール
- 「タブ無し」でも破綻しないUXを、左ツリー（縦タブ）主導で成立させる
- 2ペイン分割（比較）と、ツリー操作だけで高速に往復できる操作体系を確立する
- 大量ノードでも軽い（ツリー仮想化・差分更新・入力遅延なし）を必達にする

## 1. 前提・コンセプト（UI仕様の核）
### 1.1 ノードはすべて「ノート」
- フォルダ概念はUIに出さない（ノートが子ノートを持つ）
- 表示はVSCode風ツリーだが、意味はアウトライナーに近い

### 1.2 タブの代替（ツリー縦タブ）
- ツリー上で状態を分離して表現する
  - **Selected**: ツリー上で選択中（クリックで変わる）
  - **Active**: 右ペインで表示中（Enter/ダブルクリックで変わる）
  - **Open**: 最近開いたノート（縦タブ状態。タブ列の代替）

### 1.3 迷子対策（ツリー強調 + Follow Active）
- Activeノートはツリーで強調（太字+アクセントバー+ハイライト）
- **Follow Active**（追従）をデフォルトON
  - Active変更時にツリーを自動スクロール
  - 必要なら親を自動展開
  - ユーザーがツリーを手動操作中は一時停止（短時間）

### 1.4 Breadcrumb（任意）
- エディタ上部に最小表示： `Root > Parent > Child`
- クリックで祖先へジャンプ（後回し可）

## 2. 技術スタック（フロント）
- UI: Svelte + Vite（推奨。軽量で体感が最速になりやすい）
  - Reactでも可だが、最速体感優先でSvelteを第一候補にする
- エディタ: CodeMirror 6（推奨）
  - Markdown、検索、ハイライト、履歴、拡張が軽い
- ツリー: 仮想スクロール（Virtual List）
  - “見えている分だけ描画” を強制
- 通信: Tauri commands（Rust側API呼び出し）

## 3. 画面構成
### 3.1 レイアウト
- 左：Tree Sidebar（固定幅 + リサイズ可）
- 右：Editor Area
  - 1ペイン（デフォルト）
  - 2ペイン（左右分割、リサイズ可）
- 下（任意）：小ステータス（保存状態、検索件数など）

### 3.2 コンポーネント分割案
- `AppShell`
- `TreeSidebar`
  - `TreeToolbar`（検索/フィルタ/新規など）
  - `TreeView`（仮想化 + ノード描画）
  - `TreeNodeRow`（1行）
- `EditorWorkspace`
  - `PaneContainer`（1 or 2）
  - `EditorPane`（CodeMirror）
  - `Splitter`
- `QuickSwitcherModal`（Ctrl+P）
- `ContextMenu`（右クリック）

## 4. 操作仕様（最重要）
### 4.1 ツリー操作
- **単クリック**：Selected更新（表示は変えない）
- **Enter / ダブルクリック**：フォーカス中のペインに開く（Active更新）
- **Ctrl+Enter**：反対側のペインに開く（2ペイン時）
- **ドラッグ&ドロップ**：階層移動 + 同階層内並べ替え

### 4.2 新規ノート（優先実装）
- **Ctrl+N**：同階層に新規（Selectedノードの親配下）
  - 生成後、ツリーでインラインリネーム開始
- **Ctrl+Shift+N**：子ノートとして新規（Selectedノード配下）
  - 親を自動展開
  - 生成後、すぐActive化して本文入力へ（“ぶら下げ”体験を最大化）

### 4.3 エディタ分割（比較）
- 分割は2ペイン固定（最小ルールで強い）
- **Ctrl+1 / Ctrl+2**：ペインフォーカス切替
- ツリーから開く対象は「最後にフォーカスしていたペイン」
- 同期スクロール（任意でON/OFF）

### 4.4 縦タブ（Open）表現
- Active：太字 + 左アクセントバー + 背景
- Open：小ドット（●）等の軽いインジケータ
- OpenはLRU上限を持つ（例：50）。UIはバックエンド状態を表示するだけ

### 4.5 クイックスイッチャ（Ctrl+P）
- モーダルを中央表示
- 入力で即検索（バックエンドFTS）
- 上下で候補移動、Enterで開く
- **Ctrl+Enter**：反対ペインに開く（2ペイン時）

## 5. 状態管理（フロント方針）
- UI状態とDB状態を分離
  - DBの正はバックエンド（Rust/SQLite）
  - フロントは最小キャッシュ（ツリー表示用の軽量スナップショット）
- 代表状態
  - `selectedNodeId`
  - `activeNodeIdByPane { pane1, pane2 }`
  - `focusedPane`
  - `expandedNodeIds`
  - `isFollowActiveEnabled`
  - `treeSnapshot`（差分更新）

## 6. パフォーマンス要件（必達）
- ツリーは仮想化（大量ノードでもスクロールが落ちない）
- ノード描画は純粋（props変更最小化、差分更新中心）
- エディタ入力は必ず軽い（保存はデバウンスし、UIスレッドを塞がない）
- ドラッグ中もフレーム落ちしない（最悪、D&D中は簡易描画）

## 7. 実装ステップ（フロント）
### Phase F1: シェル
- AppShell、左右レイアウト、リサイズ、基本ショートカット枠

### Phase F2: Tree MVP
- ツリー仮想化
- Selected/Active/Open表示（Openは仮でよい。後でバックエンド同期）
- Enterで開く、Follow Active

### Phase F3: Editor MVP
- CodeMirror 6統合（Markdown）
- ノート表示・編集、保存デバウンス（API呼び出し）
- 保存状態表示（dirty/clean）

### Phase F4: 分割（2ペイン）
- Splitter
- Ctrl+1/2
- Ctrl+Enter（反対ペインオープン）

### Phase F5: 新規ノート（Ctrl+N / Ctrl+Shift+N）
- ツリー上でインラインリネーム
- 作成後のActive/Focus遷移を仕様通りに固定

### Phase F6: Quick Switcher（Ctrl+P）
- FTS検索結果の表示
- Enter/Ctrl+Enter動作

### Phase F7: D&D / 並べ替え
- 同階層並び替え
- 階層移動
- Undoは後回し（個人用ならログ/履歴で代替）

### Phase F8: 仕上げ
- 右クリックメニュー（rename/delete/new child）
- Breadcrumb（任意）
- 設定（Follow Active、同期スクロール等）

## 8. 受け入れ基準（フロント）
- タブ無しでも “戻れない/迷子” が発生しない（Follow Active + 強調 + Ctrl+P）
- Ctrl+N / Ctrl+Shift+N がストレスなく動作し、作成直後の編集開始が自然
- 2ペインで比較が成立（Ctrl+Enterで反対ペインに出せる）
- 大量ノードでもツリーが滑らか（仮想化必須）
