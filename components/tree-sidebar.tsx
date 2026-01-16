'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Search } from 'lucide-react';
import { useNoteStore, type TreeNode } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TreeItem } from './tree-item';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, defaultDropAnimationSideEffects, DropAnimation } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { createPortal } from 'react-dom';

export function TreeSidebar() {
	const {
		treeNodes,
		selectedNodeId,
		activeNodeIds,
		openNodeIds,
		expandedNodeIds,
		isFollowActiveEnabled,
		selectNode,
		openNote,
		toggleExpanded,
		createSibling,
		createChild,
		focusedPane,
		triggerEditorFocus,
		renameNote,
		deleteNote,
		moveNote,
		togglePinNote,
	} = useNoteStore();

	const [searchQuery, setSearchQuery] = useState('');
	const [activeDragId, setActiveDragId] = useState<string | null>(null);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8, // Drag starts after 8px movement
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	// Flatten the tree for display (handling expansion)
	const displayedNodes = useMemo(() => {
		const nodes: { node: TreeNode; depth: number }[] = [];

		const traverse = (parentId: string | null, depth: number) => {
			// Sort: pinned items first, then by orderKey
			const children = treeNodes
				.filter((n) => n.parentId === parentId)
				.sort((a, b) => {
					if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
					return a.orderKey - b.orderKey;
				});

			for (const child of children) {
				// Handle Search Filter
				const match = child.title.toLowerCase().includes(searchQuery.toLowerCase());
				// If searching, show all matches regardless of expansion (and maybe their parents? simplify: just flatten matches)
				// Actually, maintaining tree structure during search is hard.
				// For now: if search query exists, show flat list of matches.
				if (searchQuery) {
					if (match) nodes.push({ node: child, depth: 0 }); // Flatten depth on search
					// traverse children too for search
					traverse(child.id, depth + 1);
				} else {
					// Normal Tree View
					nodes.push({ node: child, depth });
					if (expandedNodeIds.has(child.id)) {
						traverse(child.id, depth + 1);
					}
				}
			}
		};

		// If search is active, we just want a flat list of matches, potentially.
		// But let's try to keep the logic simple first.
		if (searchQuery) {
			return treeNodes.filter((n) => n.title.toLowerCase().includes(searchQuery.toLowerCase())).map((n) => ({ node: n, depth: 0 }));
		}

		traverse(null, 0);
		return nodes;
	}, [treeNodes, expandedNodeIds, searchQuery]);

	const activeDragNode = activeDragId ? treeNodes.find((n) => n.id === activeDragId) : null;

	// DnD Handlers
	const handleDragStart = (event: any) => {
		setActiveDragId(event.active.id);
	};

	const handleDragEnd = async (event: any) => {
		const { active, over } = event;
		setActiveDragId(null);

		if (!over || active.id === over.id) return;

		const activeId = active.id as string;
		const overId = over.id as string;

		// Find indices in displayedNodes to detect drag direction
		const oldIndex = displayedNodes.findIndex((n) => n.node.id === activeId);
		const newIndex = displayedNodes.findIndex((n) => n.node.id === overId);

		if (oldIndex === -1 || newIndex === -1) return;

		const overNode = treeNodes.find((n) => n.id === overId);
		if (!overNode) return;

		// Determine target based on drag direction
		// Dragging DOWN: insert AFTER the target (so we need to find the NEXT sibling as target)
		// Dragging UP: insert AT the target position (current behavior)

		if (newIndex > oldIndex) {
			// Dragging DOWN - we want to go AFTER overNode
			// Find all siblings and get the one after overNode
			const siblings = treeNodes.filter((n) => n.parentId === overNode.parentId).sort((a, b) => a.orderKey - b.orderKey);
			const overIndexInSiblings = siblings.findIndex((n) => n.id === overId);
			const nextSibling = siblings[overIndexInSiblings + 1];

			// If there's a next sibling, insert at its position; otherwise append to end
			moveNote(activeId, overNode.parentId, undefined, nextSibling?.id);
		} else {
			// Dragging UP - insert AT overNode's position
			moveNote(activeId, overNode.parentId, undefined, overId);
		}
	};

	return (
		<div className="h-full flex flex-col bg-sidebar">
			<div className="p-3 border-b border-sidebar-border flex-shrink-0 space-y-2">
				<div className="flex items-center gap-2">
					<div className="relative flex-1">
						<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
						<Input
							type="text"
							placeholder="検索..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-8 h-8 text-sm bg-background/80 border-border/80 focus:bg-background focus:border-foreground/20 transition-all placeholder:text-muted-foreground/60"
						/>
					</div>
					<Button
						size="sm"
						variant="ghost"
						className="h-8 w-8 p-0 hover:bg-accent transition-colors"
						onClick={() => (selectedNodeId ? createSibling(selectedNodeId) : createChild(null))}
						title="新規ノート (Ctrl+N)"
					>
						<Plus className="w-4 h-4" />
					</Button>
				</div>
			</div>

			<DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
				<div className="flex-1 overflow-y-auto py-2">
					<SortableContext items={displayedNodes.map((n) => n.node.id)} strategy={verticalListSortingStrategy}>
						{displayedNodes.length === 0 ? (
							<div className="px-4 py-12 text-center text-muted-foreground">
								<p className="text-xs font-medium">ノートがありません</p>
							</div>
						) : (
							displayedNodes.map(({ node, depth }) => (
								<TreeItem
									key={node.id}
									node={node}
									depth={depth}
									isSelected={selectedNodeId === node.id}
									isActive={activeNodeIds[focusedPane] === node.id}
									isOpen={openNodeIds.has(node.id)}
									isExpanded={expandedNodeIds.has(node.id)}
									onSelect={selectNode}
									onToggle={(id, e) => {
										e.stopPropagation();
										toggleExpanded(id);
									}}
									onOpenNote={(id) => openNote(id, focusedPane, false)}
									onTriggerEditorFocus={triggerEditorFocus}
									onRename={(id) => {
										const newName = prompt('名前を変更', node.title);
										if (newName && newName !== node.title) {
											renameNote(id, newName);
										}
									}}
									onDelete={(id) => {
										if (confirm('削除しますか？')) deleteNote(id);
									}}
									onTogglePin={(id) => togglePinNote(id)}
								/>
							))
						)}
					</SortableContext>
				</div>

				<DragOverlay dropAnimation={null}>
					{activeDragNode ? (
						<TreeItem
							node={activeDragNode}
							depth={0}
							isSelected={false}
							isActive={false}
							isOpen={false}
							isExpanded={false}
							isOverlay={true}
							onSelect={() => {}}
							onToggle={() => {}}
							onOpenNote={() => {}}
							onTriggerEditorFocus={() => {}}
							onRename={() => {}}
							onDelete={() => {}}
							onTogglePin={() => {}}
						/>
					) : null}
				</DragOverlay>
			</DndContext>

			<div className="px-4 py-1.5 border-t border-sidebar-border text-[10px] text-muted-foreground flex-shrink-0 bg-sidebar/60 font-medium tracking-tight flex justify-between">
				<span>{treeNodes.length} items</span>
			</div>
		</div>
	);
}
