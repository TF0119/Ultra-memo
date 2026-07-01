'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useNoteStore } from '@/lib/store';
import { TEMPLATES, applyTemplate } from '@/lib/templates';
import { Search, Zap, FileText, Settings, Layout } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from './confirm-dialog';

interface Command {
	id: string;
	label: string;
	shortcut?: string;
	keywords?: string;
	group: 'capture' | 'nav' | 'view' | 'tree' | 'template';
	action: () => void;
}

interface CommandPaletteProps {
	isOpen: boolean;
	onClose: () => void;
	onOpenSearch: () => void;
	splitMode: 'single' | 'split';
	setSplitMode: (mode: 'single' | 'split') => void;
}

const GROUP_LABELS: Record<Command['group'], string> = {
	capture: 'キャプチャ',
	nav: 'ナビゲーション',
	view: '表示',
	tree: 'ツリー',
	template: 'テンプレート',
};

const GROUP_ORDER: Command['group'][] = ['capture', 'nav', 'view', 'tree', 'template'];

export function CommandPalette({ isOpen, onClose, onOpenSearch, splitMode, setSplitMode }: CommandPaletteProps) {
	const store = useNoteStore();
	const [query, setQuery] = useState('');
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const commands: Command[] = useMemo(
		() => [
			{ id: 'quick', label: 'クイックキャプチャ（一言メモ）', shortcut: 'Ctrl+Shift+M', keywords: 'quick capture memo 一言', group: 'capture', action: () => store.quickCapture() },
			{ id: 'new', label: '新規ノート（同階層）', shortcut: 'Ctrl+N', keywords: 'new sibling', group: 'capture', action: () => (store.selectedNodeId ? store.createSibling(store.selectedNodeId) : store.createChild(null)) },
			{ id: 'child', label: '子ノートを作成', shortcut: 'Ctrl+Shift+N', keywords: 'child', group: 'capture', action: () => store.createChild(store.selectedNodeId ?? store.activeNodeIds[store.focusedPane] ?? null) },
			{ id: 'search', label: 'ノートを検索', shortcut: 'Ctrl+P', keywords: 'find search 検索', group: 'nav', action: () => onOpenSearch() },
			{ id: 'back', label: '戻る', shortcut: 'Alt+←', keywords: 'back history 戻る', group: 'nav', action: () => store.goBack() },
			{ id: 'forward', label: '進む', shortcut: 'Alt+→', keywords: 'forward history 進む', group: 'nav', action: () => store.goForward() },
			{ id: 'split', label: splitMode === 'single' ? '分割表示に切替' : '単一表示に切替', keywords: 'split pane', group: 'view', action: () => setSplitMode(splitMode === 'single' ? 'split' : 'single') },
			{ id: 'zen', label: store.isZenMode ? 'Zenモード終了' : 'Zenモード（集中執筆）', shortcut: 'F11', keywords: 'zen focus 集中', group: 'view', action: () => store.toggleZenMode() },
			{ id: 'follow', label: store.isFollowActiveEnabled ? '開いているノートをツリーで追う: OFF' : '開いているノートをツリーで追う: ON', keywords: 'follow active scroll 追従', group: 'view', action: () => store.toggleFollowActive() },
			{ id: 'sync', label: store.isSyncScrollEnabled ? '同期スクロール OFF' : '同期スクロール ON', keywords: 'sync scroll', group: 'view', action: () => store.toggleSyncScroll() },
			{ id: 'sort', label: store.sortMode === 'recent' ? '並び順: 手動順に変更' : '並び順: 新しい順に変更', keywords: 'sort recent 並び', group: 'tree', action: () => store.toggleSortMode() },
			{ id: 'expand', label: 'すべて展開', shortcut: 'Ctrl+Shift+]', keywords: 'expand all', group: 'tree', action: () => store.expandAll() },
			{ id: 'collapse', label: 'すべて折りたたむ', shortcut: 'Ctrl+Shift+[', keywords: 'collapse all', group: 'tree', action: () => store.collapseAll() },
			{ id: 'export', label: 'Markdownエクスポート', keywords: 'export download', group: 'tree', action: () => store.exportMarkdownTree() },
			{ id: 'pin', label: '選択ノートをピン留め', keywords: 'pin', group: 'tree', action: () => store.batchPin(true) },
			{ id: 'unpin', label: '選択ノートのピン留めを解除', keywords: 'unpin', group: 'tree', action: () => store.batchPin(false) },
			{ id: 'delete', label: '選択ノートを削除', keywords: 'delete trash', group: 'tree', action: () => { if (store.selectedNodeIds.size > 0) setBatchDeleteOpen(true); } },
			...TEMPLATES.filter((t) => t.id !== 'blank' && t.id !== 'quick').map((t) => ({
				id: `tpl-${t.id}`,
				label: `テンプレート挿入: ${t.name}`,
				keywords: `template ${t.name}`,
				group: 'template' as const,
				action: () => {
					const pane = store.focusedPane;
					const activeId = store.activeNodeIds[pane];
					if (!activeId) {
						window.alert('ノートを開いてから実行してください');
						return;
					}
					store.flushEditorSave(pane);
					const existing = store.noteContents[activeId] ?? '';
					const content = existing.trim() ? `${existing}\n\n${applyTemplate(t)}` : applyTemplate(t);
					void store.updateNoteContent(activeId, content);
				},
			})),
		],
		[store, splitMode, setSplitMode, onOpenSearch]
	);

	const filtered = useMemo(() => {
		if (!query.trim()) return commands;
		const q = query.toLowerCase();
		const terms = q.split(/\s+/);
		return commands.filter((c) => {
			const hay = `${c.label} ${c.keywords ?? ''}`.toLowerCase();
			return terms.every((t) => hay.includes(t));
		});
	}, [commands, query]);

	const grouped = useMemo(() => {
		if (query.trim()) return [{ group: null as Command['group'] | null, items: filtered }];
		return GROUP_ORDER.map((g) => ({ group: g, items: filtered.filter((c) => c.group === g) })).filter((s) => s.items.length > 0);
	}, [filtered, query]);

	const flatItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

	useEffect(() => {
		if (isOpen) {
			setQuery('');
			setSelectedIndex(0);
			setTimeout(() => inputRef.current?.focus(), 0);
		}
	}, [isOpen]);

	useEffect(() => {
		if (listRef.current && isOpen) {
			const el = listRef.current.querySelector(`[data-cmd-idx="${selectedIndex}"]`);
			el?.scrollIntoView({ block: 'nearest' });
		}
	}, [selectedIndex, isOpen]);

	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
			} else if (e.key === 'ArrowDown') {
				e.preventDefault();
				if (flatItems.length === 0) return;
				setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				setSelectedIndex((i) => Math.max(i - 1, 0));
			} else if (e.key === 'Enter' && flatItems[selectedIndex]) {
				e.preventDefault();
				flatItems[selectedIndex].action();
				onClose();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isOpen, flatItems, selectedIndex, onClose]);

	if (!isOpen) return null;

	let flatIdx = -1;

	return (
		<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[10vh] z-[60] animate-in fade-in duration-150" onClick={onClose}>
			<div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
				<div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80">
					<Search className="w-4 h-4 text-muted-foreground shrink-0" />
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
				<div ref={listRef} className="max-h-[55vh] overflow-y-auto py-1">
					{flatItems.length === 0 ? (
						<p className="text-sm text-muted-foreground text-center py-10">コマンドが見つかりません</p>
					) : (
						grouped.map((section) => (
							<div key={section.group ?? 'search'}>
								{section.group && !query.trim() && (
									<div className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
										{GROUP_LABELS[section.group]}
									</div>
								)}
								{section.items.map((cmd) => {
									flatIdx++;
									const idx = flatIdx;
									return (
										<button
											key={cmd.id}
											data-cmd-idx={idx}
											type="button"
											className={cn(
												'w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors',
												idx === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/40'
											)}
											onMouseEnter={() => setSelectedIndex(idx)}
											onClick={() => {
												cmd.action();
												onClose();
											}}
										>
											<span className="flex items-center gap-2">
												{cmd.group === 'capture' && <Zap className="w-3.5 h-3.5 opacity-50" />}
												{cmd.group === 'nav' && <Search className="w-3.5 h-3.5 opacity-50" />}
												{cmd.group === 'view' && <Layout className="w-3.5 h-3.5 opacity-50" />}
												{cmd.group === 'tree' && <Settings className="w-3.5 h-3.5 opacity-50" />}
												{cmd.group === 'template' && <FileText className="w-3.5 h-3.5 opacity-50" />}
												{cmd.label}
											</span>
											{cmd.shortcut && (
												<kbd className="text-[10px] px-1.5 py-0.5 bg-muted/50 border border-border/50 rounded font-mono text-muted-foreground ml-2 shrink-0">
													{cmd.shortcut}
												</kbd>
											)}
										</button>
									);
								})}
							</div>
						))
					)}
				</div>
			</div>

			<ConfirmDialog
				open={batchDeleteOpen}
				onOpenChange={setBatchDeleteOpen}
				title={`${store.selectedNodeIds.size}件のノートを削除しますか？`}
				description="選択したノートをまとめてゴミ箱に移動します。あとでゴミ箱から復元できます。"
				confirmLabel="削除"
				onConfirm={() => {
					void store.batchDelete();
					setBatchDeleteOpen(false);
					onClose();
				}}
			/>
		</div>
	);
}
