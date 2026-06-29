'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useNoteStore } from '@/lib/store';
import { TEMPLATES, applyTemplate } from '@/lib/templates';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Command {
	id: string;
	label: string;
	shortcut?: string;
	keywords?: string;
	action: () => void;
}

interface CommandPaletteProps {
	isOpen: boolean;
	onClose: () => void;
	splitMode: 'single' | 'split';
	setSplitMode: (mode: 'single' | 'split') => void;
}

export function CommandPalette({ isOpen, onClose, splitMode, setSplitMode }: CommandPaletteProps) {
	const store = useNoteStore();
	const [query, setQuery] = useState('');
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	const commands: Command[] = useMemo(
		() => [
			{ id: 'quick', label: 'クイックキャプチャ（一言メモ）', shortcut: 'Ctrl+Shift+M', keywords: 'quick capture memo', action: () => store.quickCapture() },
			{ id: 'new', label: '新規ノート（同階層）', shortcut: 'Ctrl+N', keywords: 'new sibling', action: () => (store.selectedNodeId ? store.createSibling(store.selectedNodeId) : store.createChild(null)) },
			{ id: 'child', label: '子ノートを作成', shortcut: 'Ctrl+Shift+N', keywords: 'child', action: () => store.createChild(store.selectedNodeId) },
			{ id: 'search', label: 'ノートを検索', shortcut: 'Ctrl+P', keywords: 'find search', action: () => {} },
			{ id: 'split', label: splitMode === 'single' ? '分割表示に切替' : '単一表示に切替', keywords: 'split pane', action: () => setSplitMode(splitMode === 'single' ? 'split' : 'single') },
			{ id: 'zen', label: store.isZenMode ? 'Zenモード終了' : 'Zenモード（集中執筆）', shortcut: 'F11', keywords: 'zen focus', action: () => store.toggleZenMode() },
			{ id: 'follow', label: store.isFollowActiveEnabled ? 'Follow Active OFF' : 'Follow Active ON', keywords: 'follow scroll', action: () => store.toggleFollowActive() },
			{ id: 'sync', label: store.isSyncScrollEnabled ? '同期スクロール OFF' : '同期スクロール ON', keywords: 'sync scroll', action: () => store.toggleSyncScroll() },
			{ id: 'sort', label: store.sortMode === 'recent' ? '並び順: 手動順' : '並び順: 新しい順', keywords: 'sort recent', action: () => store.toggleSortMode() },
			{ id: 'expand', label: 'すべて展開', shortcut: 'Ctrl+Shift+]', keywords: 'expand all', action: () => store.expandAll() },
			{ id: 'collapse', label: 'すべて折りたたむ', shortcut: 'Ctrl+Shift+[', keywords: 'collapse all', action: () => store.collapseAll() },
			{ id: 'export', label: 'Markdownエクスポート', keywords: 'export download', action: () => store.exportMarkdownTree() },
			{ id: 'pin', label: '選択ノートをピン留め', keywords: 'pin', action: () => store.batchPin(true) },
			{ id: 'delete', label: '選択ノートを削除', keywords: 'delete trash', action: () => store.batchDelete() },
			...TEMPLATES.filter((t) => t.id !== 'blank').map((t) => ({
				id: `tpl-${t.id}`,
				label: `テンプレート: ${t.name}`,
				keywords: `template ${t.name}`,
				action: () => {
					const pane = store.focusedPane;
					const activeId = store.activeNodeIds[pane];
					if (activeId) {
						const content = applyTemplate(t);
						store.updateNoteContent(activeId, content);
					}
				},
			})),
		],
		[store, splitMode, setSplitMode]
	);

	const filtered = useMemo(() => {
		if (!query.trim()) return commands;
		const q = query.toLowerCase();
		return commands.filter((c) => c.label.toLowerCase().includes(q) || c.keywords?.toLowerCase().includes(q));
	}, [commands, query]);

	useEffect(() => {
		if (isOpen) {
			setQuery('');
			setSelectedIndex(0);
			setTimeout(() => inputRef.current?.focus(), 0);
		}
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
			} else if (e.key === 'ArrowDown') {
				e.preventDefault();
				setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				setSelectedIndex((i) => Math.max(i - 1, 0));
			} else if (e.key === 'Enter' && filtered[selectedIndex]) {
				e.preventDefault();
				filtered[selectedIndex].action();
				onClose();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isOpen, filtered, selectedIndex, onClose]);

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[12vh] z-[60] animate-in fade-in duration-150" onClick={onClose}>
			<div className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-xl mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
				<div className="flex items-center gap-3 px-4 py-3 border-b border-border">
					<Search className="w-4 h-4 text-muted-foreground" />
					<input
						ref={inputRef}
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setSelectedIndex(0);
						}}
						placeholder="コマンドを検索..."
						className="flex-1 bg-transparent outline-none text-sm"
					/>
					<kbd className="text-[10px] px-1.5 py-0.5 bg-muted border border-border rounded font-mono text-muted-foreground">Esc</kbd>
				</div>
				<div className="max-h-[50vh] overflow-y-auto py-1">
					{filtered.length === 0 ? (
						<p className="text-sm text-muted-foreground text-center py-8">コマンドが見つかりません</p>
					) : (
						filtered.map((cmd, i) => (
							<button
								key={cmd.id}
								type="button"
								className={cn(
									'w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors',
									i === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
								)}
								onMouseEnter={() => setSelectedIndex(i)}
								onClick={() => {
									cmd.action();
									onClose();
								}}
							>
								<span>{cmd.label}</span>
								{cmd.shortcut && <kbd className="text-[10px] px-1.5 py-0.5 bg-muted/50 border border-border/50 rounded font-mono text-muted-foreground">{cmd.shortcut}</kbd>}
							</button>
						))
					)}
				</div>
			</div>
		</div>
	);
}
