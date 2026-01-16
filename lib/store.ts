import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface TreeNode {
	id: string;
	parentId: string | null;
	title: string;
	content: string;
	orderKey: number;
	is_open: boolean;
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

	// Actions
	initialize: () => Promise<void>;
	selectNode: (id: string) => void;
	openNote: (id: string, paneId: 1 | 2) => Promise<void>;
	updateNoteContent: (id: string, content: string) => Promise<void>;
	createSibling: (selectedId: string) => Promise<void>;
	createChild: (parentId: string | null) => Promise<void>;
	toggleExpanded: (id: string) => void;
	setFocusedPane: (paneId: 1 | 2) => void;
	renameNote: (id: string, newTitle: string) => Promise<void>;
	deleteNote: (id: string) => Promise<void>;
	moveNote: (noteId: string, newParentId: string | null, beforeId?: string, afterId?: string) => Promise<void>;
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

	initialize: async () => {
		try {
			const nodes = await invoke<TreeNode[]>('get_tree_snapshot');
			const openNodes = await invoke<string[]>('get_open_list', { limit: 50 });

			set({
				treeNodes: nodes,
				openNodeIds: new Set(openNodes),
				isInitialized: true,
			});

			// If there are open nodes, make the first one active in pane 1 if none active
			if (openNodes.length > 0 && !get().activeNodeIds[1]) {
				set((state) => ({
					activeNodeIds: { ...state.activeNodeIds, 1: openNodes[0] },
					selectedNodeId: openNodes[0],
				}));
			}
		} catch (error) {
			console.error('Failed to initialize store:', error);
		}
	},

	selectNode: (id) => {
		set({ selectedNodeId: id });
	},

	openNote: async (id, paneId) => {
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

				return {
					activeNodeIds: { ...state.activeNodeIds, [paneId]: id },
					openNodeIds: new Set(openNodes),
					expandedNodeIds: newExpanded,
					focusedPane: paneId,
					selectedNodeId: id,
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
		}
	},

	createSibling: async (selectedId) => {
		try {
			const newNode = await invoke<TreeNode>('create_sibling', { selectedId });
			set((state) => ({
				treeNodes: [...state.treeNodes, newNode],
				selectedNodeId: newNode.id,
			}));
			// Immediately open it
			await get().openNote(newNode.id, get().focusedPane);
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
		try {
			await invoke('move_note', { noteId, newParentId, beforeId, afterId });
			const nodes = await invoke<TreeNode[]>('get_tree_snapshot');
			set({ treeNodes: nodes });
		} catch (error) {
			console.error('Failed to move note:', error);
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
		set({ focusedPane: paneId });
	},
}));
