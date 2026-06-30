import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { isPlaceholderTitle } from './wiki-links';
import { loadSortMode, saveSortMode, loadFollowActive, saveFollowActive, loadSyncScroll, saveSyncScroll, loadLineWrap, saveLineWrap, formatQuickCaptureTitle, loadExpandedNodes, saveExpandedNodes } from './preferences';
import { clearEditorSession } from './editor-session';

export interface TreeNode {
	id: string;
	parentId: string | null;
	title: string;
	contentPreview: string;
	contentLength: number;
	orderKey: number;
	is_open: boolean;
	isPinned: boolean;
	isMarkdownView: boolean;
	hasChildren: boolean;
	createdAt: number;
	updatedAt: number;
}

export interface BacklinkNote {
	id: string;
	title: string;
	snippet: string;
}

interface NoteStore {
	treeNodes: TreeNode[];
	noteContents: Record<string, string>;
	loadingNoteIds: Set<string>;
	selectedNodeId: string | null;
	selectedNodeIds: Set<string>;
	lastSelectedId: string | null;
	editingNodeId: string | null;
	activeNodeIds: { [paneId: number]: string | null };
	focusedPane: 1 | 2;
	expandedNodeIds: Set<string>;
	openNodeIds: Set<string>;
	isFollowActiveEnabled: boolean;
	isSyncScrollEnabled: boolean;
	isLineWrapEnabled: boolean;
	syncScrollRatio: number;
	syncScrollSource: 1 | 2 | null;
	isZenMode: boolean;
	isCommandPaletteOpen: boolean;
	sortMode: 'manual' | 'recent';
	isInitialized: boolean;
	initError: string | null;
	focusTarget: { nodeId: string | null; paneId: 1 | 2; trigger: number };
	history: string[];
	historyIndex: number;
	saveStatusByPane: { 1: 'saved' | 'saving' | 'error'; 2: 'saved' | 'saving' | 'error' };
	backlinksByNoteId: Record<string, BacklinkNote[]>;
	backlinksLoadSeq: number;
	contentSaveSeq: Record<string, number>;
	editorFlushByPane: { 1: (() => void) | null; 2: (() => void) | null };
	editorGetDocByPane: { 1: (() => string) | null; 2: (() => string) | null };
	failedNoteIds: Set<string>;

	initialize: () => Promise<void>;
	refreshTree: () => Promise<void>;
	selectNode: (id: string, opts?: { additive?: boolean; range?: boolean; visibleFlat?: string[] }) => void;
	clearSelection: () => void;
	setEditingNodeId: (id: string | null) => void;
	loadNoteContent: (id: string) => Promise<string>;
	retryLoadNote: (id: string) => Promise<string>;
	openNote: (id: string, paneId: 1 | 2, shouldFocusEditor?: boolean, skipHistory?: boolean) => Promise<void>;
	updateNoteContent: (id: string, content: string) => Promise<void>;
	createSibling: (selectedId: string) => Promise<void>;
	createChild: (parentId: string | null) => Promise<void>;
	quickCapture: () => Promise<void>;
	toggleExpanded: (id: string) => void;
	expandAll: () => void;
	collapseAll: () => void;
	setFocusedPane: (paneId: 1 | 2) => void;
	renameNote: (id: string, newTitle: string) => Promise<void>;
	deleteNote: (id: string) => Promise<void>;
	batchDelete: () => Promise<void>;
	batchPin: (pin: boolean) => Promise<void>;
	moveNote: (noteId: string, newParentId: string | null, beforeId?: string, afterId?: string) => Promise<void>;
	nestNote: (noteId: string, parentId: string) => Promise<void>;
	togglePinNote: (id: string) => Promise<void>;
	toggleMarkdownView: (id: string) => Promise<void>;
	triggerEditorFocus: () => void;
	toggleFollowActive: () => void;
	toggleSyncScroll: () => void;
	toggleLineWrap: () => void;
	toggleZenMode: () => void;
	toggleSortMode: () => void;
	setCommandPaletteOpen: (open: boolean) => void;
	setSyncScrollRatio: (ratio: number, source: 1 | 2) => void;
	exportMarkdownTree: () => Promise<void>;
	getNodePath: (id: string) => Promise<string[]>;
	resolveWikiLink: (title: string) => Promise<string | null>;
	openWikiLink: (title: string, paneId: 1 | 2) => Promise<void>;
	patchLocalContent: (id: string, content: string) => void;
	loadBacklinks: (id: string) => Promise<void>;
	goBack: () => void;
	goForward: () => void;
	setSaveStatus: (paneId: 1 | 2, status: 'saved' | 'saving' | 'error') => void;
	registerEditorFlush: (paneId: 1 | 2, fn: (() => void) | null) => void;
	registerEditorGetDoc: (paneId: 1 | 2, fn: (() => string) | null) => void;
	flushEditorSave: (paneId?: 1 | 2) => void;
	purgeNotesFromFrontend: (ids: string[]) => void;
}

function mapTreeNode(raw: Record<string, unknown>): TreeNode {
	return {
		id: raw.id as string,
		parentId: (raw.parentId ?? raw.parent_id ?? null) as string | null,
		title: raw.title as string,
		contentPreview: (raw.contentPreview ?? raw.content_preview ?? '') as string,
		contentLength: (raw.contentLength ?? raw.content_length ?? 0) as number,
		orderKey: (raw.orderKey ?? raw.order_key ?? 0) as number,
		is_open: (raw.is_open ?? false) as boolean,
		isPinned: (raw.isPinned ?? raw.is_pinned ?? false) as boolean,
		isMarkdownView: (raw.isMarkdownView ?? raw.is_markdown_view ?? false) as boolean,
		hasChildren: (raw.hasChildren ?? raw.has_children ?? false) as boolean,
		createdAt: (raw.createdAt ?? raw.created_at ?? 0) as number,
		updatedAt: (raw.updatedAt ?? raw.updated_at ?? 0) as number,
	};
}

export const useNoteStore = create<NoteStore>((set, get) => ({
	treeNodes: [],
	noteContents: {},
	loadingNoteIds: new Set(),
	selectedNodeId: null,
	selectedNodeIds: new Set(),
	lastSelectedId: null,
	editingNodeId: null,
	activeNodeIds: { 1: null, 2: null },
	focusedPane: 1,
	expandedNodeIds: new Set(loadExpandedNodes()),
	openNodeIds: new Set(),
	isFollowActiveEnabled: loadFollowActive(),
	isSyncScrollEnabled: loadSyncScroll(),
	isLineWrapEnabled: loadLineWrap(),
	syncScrollRatio: 0,
	syncScrollSource: null,
	isZenMode: false,
	isCommandPaletteOpen: false,
	sortMode: loadSortMode(),
	isInitialized: false,
	initError: null,
	focusTarget: { nodeId: null, paneId: 1, trigger: 0 },
	history: [],
	historyIndex: -1,
	saveStatusByPane: { 1: 'saved', 2: 'saved' },
	backlinksByNoteId: {},
	backlinksLoadSeq: 0,
	contentSaveSeq: {},
	editorFlushByPane: { 1: null, 2: null },
	editorGetDocByPane: { 1: null, 2: null },
	failedNoteIds: new Set(),

	initialize: async () => {
		set({ initError: null });
		try {
			const nodes = (await invoke<Record<string, unknown>[]>('get_tree_snapshot')).map(mapTreeNode);
			const openNodes = await invoke<string[]>('get_open_list', { limit: 50 });
			const initialState: Partial<NoteStore> = {
				treeNodes: nodes,
				openNodeIds: new Set(openNodes),
				isInitialized: true,
				initError: null,
			};
			if (openNodes.length > 0 && !get().activeNodeIds[1]) {
				const firstNoteId = openNodes[0];
				initialState.activeNodeIds = { ...get().activeNodeIds, 1: firstNoteId };
				initialState.selectedNodeId = firstNoteId;
				initialState.selectedNodeIds = new Set([firstNoteId]);
				initialState.history = [firstNoteId];
				initialState.historyIndex = 0;
			}
			set(initialState);
			if (openNodes.length > 0) {
				try {
					await get().loadNoteContent(openNodes[0]);
				} catch {
					// failedNoteIds tracks load failure for UI retry
				}
			}
			// Drop expand state for notes that no longer exist.
			set((s) => {
				const liveIds = new Set(nodes.map((n) => n.id));
				const pruned = new Set([...s.expandedNodeIds].filter((id) => liveIds.has(id)));
				if (pruned.size !== s.expandedNodeIds.size) saveExpandedNodes(pruned);
				return { expandedNodeIds: pruned };
			});
		} catch (error) {
			console.error('Failed to initialize store:', error);
			set({ initError: 'ノートの読み込みに失敗しました', isInitialized: false });
		}
	},

	refreshTree: async () => {
		const nodes = (await invoke<Record<string, unknown>[]>('get_tree_snapshot')).map(mapTreeNode);
		set({ treeNodes: nodes });
	},

	selectNode: (id, opts) => {
		set((state) => {
			if (opts?.additive) {
				const next = new Set(state.selectedNodeIds);
				if (next.has(id)) next.delete(id);
				else next.add(id);
				return { selectedNodeIds: next, selectedNodeId: id, lastSelectedId: id };
			}
			if (opts?.range && state.lastSelectedId) {
				const flat = opts.visibleFlat ?? flattenVisible(state.treeNodes, state.expandedNodeIds, state.sortMode);
				const a = flat.indexOf(state.lastSelectedId);
				const b = flat.indexOf(id);
				if (a !== -1 && b !== -1) {
					const [start, end] = a < b ? [a, b] : [b, a];
					const range = new Set(flat.slice(start, end + 1));
					return { selectedNodeIds: range, selectedNodeId: id, lastSelectedId: id };
				}
			}
			return { selectedNodeId: id, selectedNodeIds: new Set([id]), lastSelectedId: id };
		});
	},

	clearSelection: () => set({ selectedNodeIds: new Set(), selectedNodeId: null }),

	setEditingNodeId: (id) => set({ editingNodeId: id }),

	loadNoteContent: async (id) => {
		const cached = get().noteContents[id];
		if (cached !== undefined && !get().failedNoteIds.has(id)) return cached;
		set((s) => {
			const failed = new Set(s.failedNoteIds);
			failed.delete(id);
			return { loadingNoteIds: new Set(s.loadingNoteIds).add(id), failedNoteIds: failed };
		});
		try {
			const note = await invoke<{ id: string; title: string; content: string; updated_at: number }>('get_note', { id });
			set((s) => {
				const loading = new Set(s.loadingNoteIds);
				loading.delete(id);
				const failed = new Set(s.failedNoteIds);
				failed.delete(id);
				const treeNodes = s.treeNodes.map((n) =>
					n.id === id ? { ...n, title: note.title, contentPreview: note.content.slice(0, 80), contentLength: note.content.length, updatedAt: note.updated_at } : n
				);
				return {
					noteContents: { ...s.noteContents, [id]: note.content },
					loadingNoteIds: loading,
					failedNoteIds: failed,
					treeNodes,
				};
			});
			return note.content;
		} catch (e) {
			console.error('Failed to load note:', e);
			set((s) => {
				const loading = new Set(s.loadingNoteIds);
				loading.delete(id);
				return { loadingNoteIds: loading, failedNoteIds: new Set(s.failedNoteIds).add(id) };
			});
			throw e;
		}
	},

	retryLoadNote: async (id) => {
		set((s) => {
			const noteContents = { ...s.noteContents };
			delete noteContents[id];
			const failed = new Set(s.failedNoteIds);
			failed.delete(id);
			return { noteContents, failedNoteIds: failed };
		});
		return get().loadNoteContent(id);
	},

	openNote: async (id, paneId, shouldFocusEditor = true, skipHistory = false) => {
		const prior = get();
		const otherPane = paneId === 1 ? 2 : 1;
		// Same note already open in the other pane — focus that pane instead of duplicating editors.
		if (prior.activeNodeIds[otherPane] === id && prior.activeNodeIds[paneId] !== id) {
			return get().openNote(id, otherPane, shouldFocusEditor, skipHistory);
		}

		const alreadyOpen =
			prior.activeNodeIds[paneId] === id && prior.noteContents[id] !== undefined && !prior.failedNoteIds.has(id);

		// Re-selecting the note that's already open in this pane shouldn't flush
		// the editor — that was causing spurious saves and focus churn while writing.
		if (alreadyOpen) {
			try {
				await invoke('touch_open', { id });
				const openNodes = await invoke<string[]>('get_open_list', { limit: 50 });
				set((state) => ({
					openNodeIds: new Set(openNodes),
					focusedPane: paneId,
					selectedNodeId: id,
					selectedNodeIds: new Set([id]),
					focusTarget: shouldFocusEditor
						? { nodeId: id, paneId, trigger: state.focusTarget.trigger + 1 }
						: state.focusTarget,
				}));
			} catch (error) {
				console.error('Failed to refresh open note:', error);
			}
			return;
		}

		get().flushEditorSave(paneId);

		const applyOpenState = (openNodes: string[]) => {
			set((state) => {
				const newExpanded = new Set(state.expandedNodeIds);
				const findAndExpandParents = (nodeId: string) => {
					const node = state.treeNodes.find((n) => n.id === nodeId);
					if (node?.parentId) {
						newExpanded.add(node.parentId);
						findAndExpandParents(node.parentId);
					}
				};
				findAndExpandParents(id);

				let newHistory = state.history;
				let newHistoryIndex = state.historyIndex;
				if (!skipHistory && state.history[state.historyIndex] !== id) {
					newHistory = state.history.slice(0, state.historyIndex + 1);
					newHistory.push(id);
					newHistoryIndex = newHistory.length - 1;
					if (newHistory.length > 50) {
						newHistory.shift();
						newHistoryIndex--;
					}
				}

				saveExpandedNodes(newExpanded);

				return {
					activeNodeIds: { ...state.activeNodeIds, [paneId]: id },
					openNodeIds: new Set(openNodes),
					expandedNodeIds: newExpanded,
					focusedPane: paneId,
					selectedNodeId: id,
					selectedNodeIds: new Set([id]),
					focusTarget: shouldFocusEditor ? { nodeId: id, paneId, trigger: state.focusTarget.trigger + 1 } : state.focusTarget,
					history: newHistory,
					historyIndex: newHistoryIndex,
				};
			});
		};

		try {
			const [content] = await Promise.all([get().loadNoteContent(id), invoke('touch_open', { id })]);
			void content;
			const openNodes = await invoke<string[]>('get_open_list', { limit: 50 });
			get().loadBacklinks(id);
			applyOpenState(openNodes);
		} catch (error) {
			console.error('Failed to open note:', error);
		}
	},

	updateNoteContent: async (id, content) => {
		try {
			await invoke('update_note', { id, content });
			set((state) => {
				const preview = content.slice(0, 80);
				const node = state.treeNodes.find((n) => n.id === id);
				let title = node?.title ?? '無題';
				if (node && isPlaceholderTitle(title)) {
					const firstLine = content.split('\n').find((l) => l.trim());
					if (firstLine) {
						title = firstLine.trim().replace(/^#+\s*/, '').replace(/^- \[[ x]\]\s*/, '').slice(0, 40);
					}
				}
				return {
					noteContents: { ...state.noteContents, [id]: content },
					contentSaveSeq: { ...state.contentSaveSeq, [id]: (state.contentSaveSeq[id] ?? 0) + 1 },
					treeNodes: state.treeNodes.map((n) =>
						n.id === id ? { ...n, title, contentPreview: preview, contentLength: content.length, updatedAt: Date.now() } : n
					),
				};
			});
			get().loadBacklinks(id);
		} catch (error) {
			console.error('Failed to update note content:', error);
			throw error;
		}
	},

	patchLocalContent: (id, content) => {
		set((state) => {
			const preview = content.slice(0, 80);
			const node = state.treeNodes.find((n) => n.id === id);
			// Skip tree rebuild when preview unchanged — keeps the virtualized tree stable while typing.
			if (node && node.contentPreview === preview && node.contentLength === content.length) {
				return { noteContents: { ...state.noteContents, [id]: content } };
			}
			return {
				noteContents: { ...state.noteContents, [id]: content },
				treeNodes: state.treeNodes.map((n) =>
					n.id === id ? { ...n, contentPreview: preview, contentLength: content.length } : n
				),
			};
		});
	},

	createSibling: async (selectedId) => {
		try {
			const newNode = mapTreeNode(await invoke<Record<string, unknown>>('create_sibling', { selectedId }));
			set((state) => ({
				treeNodes: [...state.treeNodes, newNode],
				selectedNodeId: newNode.id,
				selectedNodeIds: new Set([newNode.id]),
				editingNodeId: newNode.id,
				noteContents: { ...state.noteContents, [newNode.id]: '' },
			}));
			await get().openNote(newNode.id, get().focusedPane, false);
		} catch (error) {
			console.error('Failed to create sibling:', error);
		}
	},

	createChild: async (parentId) => {
		try {
			const newNode = mapTreeNode(await invoke<Record<string, unknown>>('create_child', { parentId }));
			set((state) => {
				const newExpanded = new Set(state.expandedNodeIds);
				if (parentId) newExpanded.add(parentId);
				saveExpandedNodes(newExpanded);
				// Mark the parent as having children immediately so its expand/collapse
				// chevron appears the instant the child is created (no tree refresh wait).
				const treeNodes = parentId
					? [...state.treeNodes.map((n) => (n.id === parentId ? { ...n, hasChildren: true } : n)), newNode]
					: [...state.treeNodes, newNode];
				return {
					treeNodes,
					selectedNodeId: newNode.id,
					selectedNodeIds: new Set([newNode.id]),
					// Child notes go straight to body input; title auto-fills from first line on save.
					editingNodeId: null,
					expandedNodeIds: newExpanded,
					noteContents: { ...state.noteContents, [newNode.id]: '' },
				};
			});
			await get().openNote(newNode.id, get().focusedPane, true);
		} catch (error) {
			console.error('Failed to create child:', error);
		}
	},

	quickCapture: async () => {
		try {
			const title = formatQuickCaptureTitle();
			const newNode = mapTreeNode(await invoke<Record<string, unknown>>('create_quick_note', { title }));
			set((state) => ({
				treeNodes: [newNode, ...state.treeNodes],
				selectedNodeId: newNode.id,
				selectedNodeIds: new Set([newNode.id]),
				editingNodeId: null,
				noteContents: { ...state.noteContents, [newNode.id]: '' },
			}));
			await get().openNote(newNode.id, get().focusedPane, true);
		} catch (error) {
			console.error('Failed to quick capture:', error);
		}
	},

	renameNote: async (id, newTitle) => {
		try {
			await invoke('rename_note', { id, newTitle });
			set((state) => ({
				treeNodes: state.treeNodes.map((node) => (node.id === id ? { ...node, title: newTitle, updatedAt: Date.now() } : node)),
				editingNodeId: null,
				backlinksByNoteId: {},
			}));
			const after = get();
			for (const pane of [1, 2] as const) {
				const activeId = after.activeNodeIds[pane];
				if (activeId) void get().loadBacklinks(activeId);
			}
		} catch (error) {
			console.error('Failed to rename note:', error);
		}
	},

	deleteNote: async (id) => {
		try {
			get().flushEditorSave();
			await invoke('soft_delete_note', { id });
			await get().refreshTree();
			set((s) => {
				const next = new Set(s.selectedNodeIds);
				next.delete(id);
				return {
					...purgeNotesFromState(s, [id]),
					selectedNodeIds: next,
					selectedNodeId: next.size ? [...next][0] : null,
				};
			});
			await openFallbackAfterDelete(get(), [id]);
		} catch (error) {
			console.error('Failed to delete note:', error);
		}
	},

	batchDelete: async () => {
		const ids = [...get().selectedNodeIds];
		if (!ids.length) return;
		try {
			get().flushEditorSave();
			await invoke('batch_soft_delete', { ids });
			await get().refreshTree();
			set((s) => ({
				...purgeNotesFromState(s, ids),
				selectedNodeIds: new Set(),
				selectedNodeId: null,
			}));
			await openFallbackAfterDelete(get(), ids);
		} catch (error) {
			console.error('Failed to batch delete:', error);
		}
	},

	batchPin: async (pin) => {
		const ids = [...get().selectedNodeIds];
		if (!ids.length) return;
		try {
			await invoke('batch_toggle_pin', { ids, pin });
			set((state) => ({
				treeNodes: state.treeNodes.map((n) => (ids.includes(n.id) ? { ...n, isPinned: pin } : n)),
			}));
		} catch (error) {
			console.error('Failed to batch pin:', error);
		}
	},

	moveNote: async (noteId, newParentId, beforeId, afterId) => {
		set((state) => optimisticMove(state, noteId, newParentId, afterId));
		try {
			await invoke('move_note', { noteId, newParentId, beforeId, afterId });
			await get().refreshTree();
		} catch (error) {
			console.error('Failed to move note:', error);
			await get().refreshTree();
		}
	},

	nestNote: async (noteId, parentId) => {
		try {
			set((state) => {
				const newExpanded = new Set(state.expandedNodeIds);
				newExpanded.add(parentId);
				saveExpandedNodes(newExpanded);
				return { expandedNodeIds: newExpanded };
			});
			await get().moveNote(noteId, parentId, undefined, undefined);
		} catch (error) {
			console.error('Failed to nest note:', error);
		}
	},

	togglePinNote: async (id) => {
		try {
			const isPinned = await invoke<boolean>('toggle_pin_note', { id });
			set((state) => ({
				treeNodes: state.treeNodes.map((node) => (node.id === id ? { ...node, isPinned } : node)),
			}));
		} catch (error) {
			console.error('Failed to toggle pin:', error);
		}
	},

	toggleMarkdownView: async (id) => {
		try {
			const isMarkdownView = await invoke<boolean>('toggle_markdown_view', { id });
			set((state) => ({
				treeNodes: state.treeNodes.map((node) => (node.id === id ? { ...node, isMarkdownView } : node)),
			}));
		} catch (error) {
			console.error('Failed to toggle markdown view:', error);
		}
	},

	toggleExpanded: (id) => {
		set((state) => {
			const newExpanded = new Set(state.expandedNodeIds);
			if (newExpanded.has(id)) newExpanded.delete(id);
			else newExpanded.add(id);
			saveExpandedNodes(newExpanded);
			return { expandedNodeIds: newExpanded };
		});
	},

	expandAll: () => {
		set((state) => {
			const newExpanded = new Set(state.treeNodes.filter((n) => n.hasChildren).map((n) => n.id));
			saveExpandedNodes(newExpanded);
			return { expandedNodeIds: newExpanded };
		});
	},

	collapseAll: () => {
		saveExpandedNodes([]);
		set({ expandedNodeIds: new Set() });
	},

	setFocusedPane: (paneId) => {
		set((state) => {
			if (state.focusedPane === paneId) return state;
			return {
				focusedPane: paneId,
				focusTarget: { nodeId: state.activeNodeIds[paneId], paneId, trigger: state.focusTarget.trigger + 1 },
			};
		});
	},

	triggerEditorFocus: () => {
		set((state) => ({
			focusTarget: {
				nodeId: state.activeNodeIds[state.focusedPane],
				paneId: state.focusedPane,
				trigger: state.focusTarget.trigger + 1,
			},
		}));
	},

	toggleFollowActive: () =>
		set((s) => {
			const next = !s.isFollowActiveEnabled;
			saveFollowActive(next);
			return { isFollowActiveEnabled: next };
		}),
	toggleSyncScroll: () =>
		set((s) => {
			const next = !s.isSyncScrollEnabled;
			saveSyncScroll(next);
			return { isSyncScrollEnabled: next };
		}),
	toggleLineWrap: () =>
		set((s) => {
			const next = !s.isLineWrapEnabled;
			saveLineWrap(next);
			return { isLineWrapEnabled: next };
		}),
	toggleZenMode: () => set((s) => ({ isZenMode: !s.isZenMode })),
	toggleSortMode: () =>
		set((s) => {
			const next = s.sortMode === 'manual' ? 'recent' : 'manual';
			saveSortMode(next);
			return { sortMode: next };
		}),
	setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),

	setSyncScrollRatio: (ratio, source) => set({ syncScrollRatio: ratio, syncScrollSource: source }),

	getNodePath: async (id) => {
		try {
			return await invoke<string[]>('get_path', { noteId: id });
		} catch {
			const state = get();
			const path: string[] = [];
			let currentId: string | null = id;
			while (currentId) {
				path.unshift(currentId);
				const node = state.treeNodes.find((n) => n.id === currentId);
				currentId = node?.parentId ?? null;
			}
			return path;
		}
	},

	resolveWikiLink: async (title) => {
		try {
			return (await invoke<string | null>('resolve_wiki_link', { title })) ?? null;
		} catch {
			const node = get().treeNodes.find((n) => n.title.toLowerCase() === title.toLowerCase());
			return node?.id ?? null;
		}
	},

	openWikiLink: async (title, paneId) => {
		const trimmed = title.trim();
		if (!trimmed) return;
		let id = await get().resolveWikiLink(trimmed);
		if (!id) {
			const newNode = mapTreeNode(
				await invoke<Record<string, unknown>>('create_note_with_title', { title: trimmed, parentId: null })
			);
			set((state) => ({
				treeNodes: [...state.treeNodes, newNode],
				noteContents: { ...state.noteContents, [newNode.id]: '' },
			}));
			id = newNode.id;
		}
		await get().openNote(id, paneId);
	},

	loadBacklinks: async (id) => {
		const seq = get().backlinksLoadSeq + 1;
		set({ backlinksLoadSeq: seq });
		try {
			const backlinks = await invoke<BacklinkNote[]>('get_backlinks', { noteId: id });
			if (get().backlinksLoadSeq !== seq) return;
			set((state) => ({
				backlinksByNoteId: { ...state.backlinksByNoteId, [id]: backlinks },
			}));
		} catch {
			if (get().backlinksLoadSeq !== seq) return;
			set((state) => ({
				backlinksByNoteId: { ...state.backlinksByNoteId, [id]: [] },
			}));
		}
	},

	exportMarkdownTree: async () => {
		try {
			const markdown = await invoke<string>('export_markdown_tree');
			const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `ultra-memo-export-${new Date().toISOString().slice(0, 10)}.md`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Failed to export markdown:', error);
			window.alert('エクスポートに失敗しました');
		}
	},

	goBack: () => {
		const state = get();
		const liveIds = new Set(state.treeNodes.map((n) => n.id));
		for (let idx = state.historyIndex - 1; idx >= 0; idx--) {
			const id = state.history[idx];
			if (!liveIds.has(id)) continue;
			set({ historyIndex: idx });
			void get().openNote(id, state.focusedPane, false, true);
			return;
		}
	},

	goForward: () => {
		const state = get();
		const liveIds = new Set(state.treeNodes.map((n) => n.id));
		for (let idx = state.historyIndex + 1; idx < state.history.length; idx++) {
			const id = state.history[idx];
			if (!liveIds.has(id)) continue;
			set({ historyIndex: idx });
			void get().openNote(id, state.focusedPane, false, true);
			return;
		}
	},

	setSaveStatus: (paneId, status) =>
		set((state) => ({
			saveStatusByPane: { ...state.saveStatusByPane, [paneId]: status },
		})),

	registerEditorFlush: (paneId, fn) => {
		set((state) => ({
			editorFlushByPane: { ...state.editorFlushByPane, [paneId]: fn },
		}));
	},

	registerEditorGetDoc: (paneId, fn) => {
		set((state) => ({
			editorGetDocByPane: { ...state.editorGetDocByPane, [paneId]: fn },
		}));
	},

	flushEditorSave: (paneId) => {
		const { editorFlushByPane } = get();
		if (paneId) {
			editorFlushByPane[paneId]?.();
			return;
		}
		editorFlushByPane[1]?.();
		editorFlushByPane[2]?.();
	},

	purgeNotesFromFrontend: (ids) => {
		set((s) => purgeNotesFromState(s, ids));
	},
}));

function purgeNotesFromState(state: NoteStore, ids: string[]) {
	const idSet = new Set(ids);
	const noteContents = { ...state.noteContents };
	const contentSaveSeq = { ...state.contentSaveSeq };
	const backlinksByNoteId = { ...state.backlinksByNoteId };
	const failedNoteIds = new Set(state.failedNoteIds);
	for (const id of ids) {
		delete noteContents[id];
		delete contentSaveSeq[id];
		delete backlinksByNoteId[id];
		failedNoteIds.delete(id);
		clearEditorSession(id);
	}
	const activeNodeIds = { ...state.activeNodeIds };
	for (const pane of [1, 2] as const) {
		if (activeNodeIds[pane] && idSet.has(activeNodeIds[pane]!)) {
			activeNodeIds[pane] = null;
		}
	}
	const history = state.history.filter((id) => !idSet.has(id));
	let historyIndex = state.historyIndex;
	if (history.length === 0) {
		historyIndex = -1;
	} else {
		const current = state.history[state.historyIndex];
		if (!current || idSet.has(current)) {
			historyIndex = Math.min(historyIndex, history.length - 1);
			if (historyIndex < 0) historyIndex = 0;
		} else {
			historyIndex = history.indexOf(current);
			if (historyIndex === -1) historyIndex = Math.min(state.historyIndex, history.length - 1);
		}
	}
	const editingNodeId = state.editingNodeId && idSet.has(state.editingNodeId) ? null : state.editingNodeId;
	return { noteContents, contentSaveSeq, backlinksByNoteId, failedNoteIds, activeNodeIds, history, historyIndex, editingNodeId };
}

function flattenVisible(nodes: TreeNode[], expanded: Set<string>, sortMode: 'manual' | 'recent'): string[] {
	const result: string[] = [];
	const traverse = (parentId: string | null) => {
		let children = nodes.filter((n) => n.parentId === parentId);
		if (parentId === null && sortMode === 'recent') {
			children = [...children].sort((a, b) => {
				if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
				return b.updatedAt - a.updatedAt;
			});
		} else {
			children.sort((a, b) => {
				if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
				return a.orderKey - b.orderKey;
			});
		}
		for (const child of children) {
			result.push(child.id);
			if (expanded.has(child.id)) traverse(child.id);
		}
	};
	traverse(null);
	return result;
}

function optimisticMove(state: NoteStore, noteId: string, newParentId: string | null, afterId?: string) {
	const nodes = [...state.treeNodes];
	const movingNodeIndex = nodes.findIndex((n) => n.id === noteId);
	if (movingNodeIndex === -1) return state;
	const [movingNode] = nodes.splice(movingNodeIndex, 1);
	movingNode.parentId = newParentId;
	const siblings = nodes.filter((n) => n.parentId === newParentId).sort((a, b) => a.orderKey - b.orderKey);
	let insertIndex = siblings.length;
	if (afterId) {
		const targetIndex = siblings.findIndex((n) => n.id === afterId);
		if (targetIndex !== -1) insertIndex = targetIndex;
	}
	siblings.splice(insertIndex, 0, movingNode);
	siblings.forEach((node, index) => {
		node.orderKey = index * 1000;
	});
	nodes.push(movingNode);
	return { treeNodes: nodes };
}

export { flattenVisible, canNavigateHistory };

async function openFallbackAfterDelete(state: NoteStore, deletedIds: string[]) {
	const idSet = new Set(deletedIds);
	const { activeNodeIds, focusedPane } = state;
	if (activeNodeIds[focusedPane]) return;
	const fallback = findFallbackNoteId(state, idSet);
	if (fallback) await useNoteStore.getState().openNote(fallback, focusedPane, false);
}

function findFallbackNoteId(state: NoteStore, exclude: Set<string>): string | null {
	const flat = flattenVisible(state.treeNodes, state.expandedNodeIds, state.sortMode);
	return flat.find((id) => !exclude.has(id)) ?? null;
}

export function canNavigateHistory(state: Pick<NoteStore, 'history' | 'historyIndex' | 'treeNodes'>, direction: 'back' | 'forward'): boolean {
	const liveIds = new Set(state.treeNodes.map((n) => n.id));
	const { history, historyIndex } = state;
	if (direction === 'back') {
		for (let idx = historyIndex - 1; idx >= 0; idx--) {
			if (liveIds.has(history[idx])) return true;
		}
		return false;
	}
	for (let idx = historyIndex + 1; idx < history.length; idx++) {
		if (liveIds.has(history[idx])) return true;
	}
	return false;
}
