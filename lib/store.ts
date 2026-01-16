import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface TreeNode {
	id: string;
	parentId: string | null;
	title: string;
	content: string;
	orderKey: number;
	is_open: boolean;
	isPinned: boolean;
	hasChildren: boolean;
	createdAt: number;
	updatedAt: number;
}

interface NoteStore {
	treeNodes: TreeNode[];
	selectedNodeId: string | null;
	activeNodeIds: { [paneId: number]: string | null };
	focusedPane: 1 | 2;
	expandedNodeIds: Set<string>;
	openNodeIds: Set<string>;
	isFollowActiveEnabled: boolean;
	isInitialized: boolean;
	focusTarget: { nodeId: string | null; paneId: 1 | 2; trigger: number };

	// History
	history: string[];
	historyIndex: number;

	// Save Status
	saveStatus: 'saved' | 'saving' | 'error';

	// Actions
	initialize: () => Promise<void>;
	selectNode: (id: string) => void;
	openNote: (id: string, paneId: 1 | 2, shouldFocusEditor?: boolean, skipHistory?: boolean) => Promise<void>;
	updateNoteContent: (id: string, content: string) => Promise<void>;
	createSibling: (selectedId: string) => Promise<void>;
	createChild: (parentId: string | null) => Promise<void>;
	toggleExpanded: (id: string) => void;
	setFocusedPane: (paneId: 1 | 2) => void;
	renameNote: (id: string, newTitle: string) => Promise<void>;
	deleteNote: (id: string) => Promise<void>;
	moveNote: (noteId: string, newParentId: string | null, beforeId?: string, afterId?: string) => Promise<void>;
	togglePinNote: (id: string) => Promise<void>;
	triggerEditorFocus: () => void;

	// History Actions
	goBack: () => void;
	goForward: () => void;

	// Save Status Actions
	setSaveStatus: (status: 'saved' | 'saving' | 'error') => void;
}

export const useNoteStore = create<NoteStore>((set, get) => ({
	treeNodes: [],
	selectedNodeId: null,
	activeNodeIds: { 1: null, 2: null },
	focusedPane: 1,
	expandedNodeIds: new Set(),
	openNodeIds: new Set(),
	isFollowActiveEnabled: true,
	isInitialized: false,
	focusTarget: { nodeId: null, paneId: 1, trigger: 0 },

	// History
	history: [],
	historyIndex: -1,

	// Save Status
	saveStatus: 'saved',

	initialize: async () => {
		try {
			const nodes = await invoke<TreeNode[]>('get_tree_snapshot');
			const openNodes = await invoke<string[]>('get_open_list', { limit: 50 });

			// Initial state
			const initialState: Partial<NoteStore> = {
				treeNodes: nodes,
				openNodeIds: new Set(openNodes),
				isInitialized: true,
			};

			// If there are open nodes, make the first one active in pane 1 if none active
			if (openNodes.length > 0 && !get().activeNodeIds[1]) {
				const firstNoteId = openNodes[0];
				initialState.activeNodeIds = { ...get().activeNodeIds, 1: firstNoteId };
				initialState.selectedNodeId = firstNoteId;

				// Init history
				initialState.history = [firstNoteId];
				initialState.historyIndex = 0;
			}

			set(initialState);
		} catch (error) {
			console.error('Failed to initialize store:', error);
		}
	},

	selectNode: (id) => {
		set({ selectedNodeId: id });
	},

	openNote: async (id, paneId, shouldFocusEditor = true, skipHistory = false) => {
		try {
			await invoke('touch_open', { id });
			const openNodes = await invoke<string[]>('get_open_list', { limit: 50 });

			set((state) => {
				const newExpanded = new Set(state.expandedNodeIds);
				// Auto-expand parent nodes
				const findAndExpandParents = (nodeId: string) => {
					const node = state.treeNodes.find((n) => n.id === nodeId);
					if (node?.parentId) {
						newExpanded.add(node.parentId);
						findAndExpandParents(node.parentId);
					}
				};
				findAndExpandParents(id);

				// History update
				let newHistory = state.history;
				let newHistoryIndex = state.historyIndex;

				if (!skipHistory) {
					// If we are opening a new note (not via back/forward), truncate future and add new
					if (state.history[state.historyIndex] !== id) {
						newHistory = state.history.slice(0, state.historyIndex + 1);
						newHistory.push(id);
						newHistoryIndex = newHistory.length - 1;

						// Limit history size (optional, e.g. 50)
						if (newHistory.length > 50) {
							newHistory.shift();
							newHistoryIndex--;
						}
					}
				}

				return {
					activeNodeIds: { ...state.activeNodeIds, [paneId]: id },
					openNodeIds: new Set(openNodes),
					expandedNodeIds: newExpanded,
					focusedPane: paneId,
					selectedNodeId: id,
					focusTarget: shouldFocusEditor ? { nodeId: id, paneId, trigger: state.focusTarget.trigger + 1 } : state.focusTarget,
					history: newHistory,
					historyIndex: newHistoryIndex,
				};
			});
		} catch (error) {
			console.error('Failed to open note:', error);
		}
	},

	updateNoteContent: async (id, content) => {
		try {
			await invoke('update_note', { id, content });
			set((state) => ({
				treeNodes: state.treeNodes.map((node) => (node.id === id ? { ...node, content, updatedAt: Date.now() } : node)),
			}));
		} catch (error) {
			console.error('Failed to update note content:', error);
			set({ saveStatus: 'error' });
		}
	},

	createSibling: async (selectedId) => {
		try {
			const newNode = await invoke<TreeNode>('create_sibling', { selectedId });
			await get().openNote(newNode.id, get().focusedPane); // wait for open to finish before setting nodes to avoid race? actually openNote just sets state.
			// Ideally we update nodes first
			set((state) => ({
				treeNodes: [...state.treeNodes, newNode],
				selectedNodeId: newNode.id,
			}));
			// Then open it logic (already called above, but openNote relies on treeNodes being present for expansion?
			// wait, openNote uses state.treeNodes inside set callback, so it might see old nodes if not careful.
			// But create_sibling returns the node, we should probably add it first.
			// Actually the original code did set nodes THEN called openNote.
			// Let's stick to original pattern but with await.
		} catch (error) {
			console.error('Failed to create sibling:', error);
		}
	},

	createChild: async (parentId) => {
		try {
			const newNode = await invoke<TreeNode>('create_child', { parentId });

			set((state) => {
				const newExpanded = new Set(state.expandedNodeIds);
				if (parentId) newExpanded.add(parentId);

				return {
					treeNodes: [...state.treeNodes, newNode],
					selectedNodeId: newNode.id,
					expandedNodeIds: newExpanded,
				};
			});
			// Immediately open it
			await get().openNote(newNode.id, get().focusedPane);
		} catch (error) {
			console.error('Failed to create child:', error);
		}
	},

	renameNote: async (id, newTitle) => {
		try {
			await invoke('rename_note', { id, newTitle });
			set((state) => ({
				treeNodes: state.treeNodes.map((node) => (node.id === id ? { ...node, title: newTitle, updatedAt: Date.now() } : node)),
			}));
		} catch (error) {
			console.error('Failed to rename note:', error);
		}
	},

	deleteNote: async (id) => {
		try {
			await invoke('soft_delete_note', { id });
			const nodes = await invoke<TreeNode[]>('get_tree_snapshot');
			set({ treeNodes: nodes });
		} catch (error) {
			console.error('Failed to delete note:', error);
		}
	},

	moveNote: async (noteId, newParentId, beforeId, afterId) => {
		// Optimistic Update
		set((state) => {
			const nodes = [...state.treeNodes];
			const movingNodeIndex = nodes.findIndex((n) => n.id === noteId);
			if (movingNodeIndex === -1) return state;

			const [movingNode] = nodes.splice(movingNodeIndex, 1);
			movingNode.parentId = newParentId;

			// Get siblings in the target parent (excluding the moving node which is already removed)
			const siblings = nodes.filter((n) => n.parentId === newParentId).sort((a, b) => a.orderKey - b.orderKey);

			// Determine insertion index
			let insertIndex = siblings.length; // Default to end
			if (afterId) {
				const targetIndex = siblings.findIndex((n) => n.id === afterId);
				if (targetIndex !== -1) {
					insertIndex = targetIndex; // Insert AT the target position (pushing it down)
				}
			} else {
				// If no afterId is provided (e.g. dropping at empty space or simple move), logic depends on frontend call.
				// Current frontend logic:
				// - Drag Down: afterId = nextSibling (so insert at nextSibling position)
				// - Drag Up: afterId = overId (insert at overId position)
				// - Simple append: afterId = undefined (append to end)
				// This matches backend logic: "No target means append to end"
			}

			// Insert moving node into siblings array to calculate new order keys
			siblings.splice(insertIndex, 0, movingNode);

			// Re-calculate order keys for all siblings (0, 1000, 2000...)
			siblings.forEach((node, index) => {
				node.orderKey = index * 1000;
			});

			// Update the main nodes array with updated siblings
			// Since nodes array is just a flat list and specific order doesn't matter (sort is done by components),
			// we can just push the moving node back and updating others is enough.
			// BUT: we modified objects inside 'siblings' which are references to objects in 'nodes' (except movingNode).
			// So 'nodes' array contents are already updated regarding orderKey!
			// We just need to put 'movingNode' back into 'nodes'.
			nodes.push(movingNode);

			return { treeNodes: nodes };
		});

		try {
			// Backend Call
			await invoke('move_note', { noteId, newParentId, beforeId, afterId });
			// Sync with backend source of truth to ensure consistency
			const nodes = await invoke<TreeNode[]>('get_tree_snapshot');
			set({ treeNodes: nodes });
		} catch (error) {
			console.error('Failed to move note:', error);
			// Revert? For now just reload tree.
			const nodes = await invoke<TreeNode[]>('get_tree_snapshot');
			set({ treeNodes: nodes });
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

	toggleExpanded: (id) => {
		set((state) => {
			const newExpanded = new Set(state.expandedNodeIds);
			if (newExpanded.has(id)) {
				newExpanded.delete(id);
			} else {
				newExpanded.add(id);
			}
			return { expandedNodeIds: newExpanded };
		});
	},

	setFocusedPane: (paneId) => {
		set((state) => ({
			focusedPane: paneId,
			focusTarget: {
				nodeId: state.activeNodeIds[paneId],
				paneId,
				trigger: state.focusTarget.trigger + 1,
			},
		}));
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

	// History Actions
	goBack: () => {
		const state = get();
		if (state.historyIndex > 0) {
			const prevId = state.history[state.historyIndex - 1];
			set({ historyIndex: state.historyIndex - 1 });
			get().openNote(prevId, state.focusedPane, false, true); // true = skipHistory
		}
	},

	goForward: () => {
		const state = get();
		if (state.historyIndex < state.history.length - 1) {
			const nextId = state.history[state.historyIndex + 1];
			set({ historyIndex: state.historyIndex + 1 });
			get().openNote(nextId, state.focusedPane, false, true); // true = skipHistory
		}
	},

	setSaveStatus: (status) => {
		set({ saveStatus: status });
	},
}));
