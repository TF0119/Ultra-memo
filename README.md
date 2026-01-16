# Ultra Memo

**最強・最高・最速** のメモアプリケーション。

ミニマルな執筆体験を追求した、Tauri v2 + Rust + SQLite によるデスクトップアプリです。

## ✨ 特徴

- **漆黒のエディタ**: 黒背景に白文字のみ。視覚的なノイズを排除した究極の執筆環境
- **ツリー構造**: ノートを階層で管理し、思考を整理
- **FTS5 全文検索**: `Ctrl+P` で瞬時に全ノートを検索、スニペット表示付き
- **タブレス 2ペイン**: 左右にノートを開いて比較・編集
- **CodeMirror 6**: 高速で安定した編集体験、日本語 IME にも最適化

## 🛠️ 技術スタック

| レイヤー | 技術 |
|---------|------|
| Frontend | Next.js, React, Zustand, CodeMirror 6 |
| Backend | Tauri v2, Rust |
| Database | SQLite (WAL モード, FTS5) |
| UI | shadcn/ui, Tailwind CSS |

## 🚀 セットアップ

### 必要な環境
- Node.js 18+
- Rust (rustup)
- Windows / macOS / Linux

### インストール

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run tauri dev
```

## ⌨️ ショートカット

| キー | 機能 |
|------|------|
| `Ctrl+N` | 新規ノート（同階層） |
| `Ctrl+Shift+N` | 新規子ノート |
| `Ctrl+P` | 検索 (Quick Switcher) |
| `Ctrl+1` / `Ctrl+2` | ペイン切り替え |
| `Ctrl+Enter` | 反対のペインで開く |

## 📄 ライセンス

MIT License
