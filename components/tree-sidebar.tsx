'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, Zap } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useNoteStore, type TreeNode, flattenVisible } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TreeItem } from './tree-item';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';

const ROW_HEIGHT = 32;

export function TreeSidebar() {
	const {
		treeNodes,
		selectedNodeId,
		selectedNodeIds,
		editingNodeId,
		activeNodeIds,
		openNodeIds,
		expandedNodeIds,
		isFollowActiveEnabled,
		focusedPane,
		sortMode,
		selectNode,
		openNote,
		toggleExpanded,
		createSibling,
		createChild,
		quickCapture,
		triggerEditorFocus,
		renameNote,
		deleteNote,
		moveNote,
		nestNote,
		togglePinNote,
		setEditingNodeId,
	} = useNoteStore();

	const [searchQuery, setSearchQuery] = useState('');
	const [activeDragId, setActiveDragId] = useState<string | null>(null);
	const [nestTargetId, setNestTargetId] = useState<string | null>(null);
	const [isShiftHeld, setIsShiftHeld] = useState(false);
	const [isManualScrolling, setIsManualScrolling] = useState(false);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const manualScrollTimerRef = useRef<NodeJS.Timeout | null>(null);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);

	useEffect(() => {
		const down = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftHeld(true); };
		const up = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftHeld(false); };
		window.addEventListener('keydown', down);
		window.addEventListener('keyup', up);
		return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
	}, []);

	const displayedNodes = useMemo(() => {
		const nodes: { node: TreeNode; depth: number }[] = [];
		if (searchQuery) {
			return treeNodes
				.filter((n) => n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.contentPreview.toLowerCase().includes(searchQuery.toLowerCase()))
				.map((n) => ({ node: n, depth: 0 }));
		}
		const traverse = (parentId: string | null, depth: number) => {
			let children = treeNodes.filter((n) => n.parentId === parentId);
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
				nodes.push({ node: child, depth });
				if (expandedNodeIds.has(child.id)) traverse(child.id, depth + 1);
			}
		};
		traverse(null, 0);
		return nodes;
	}, [treeNodes, expandedNodeIds, searchQuery, sortMode]);

	const rowVirtualizer = useVirtualizer({
		count: displayedNodes.length,
		getScrollElement: () => scrollContainerRef.current,
		estimateSize: () => ROW_HEIGHT,
		overscan: 15,
	});

	const activeDragNode = activeDragId ? treeNodes.find((n) => n.id === activeDragId) : null;
	const activeNodeId = activeNodeIds[focusedPane];

	useEffect(() => {
		if (!isFollowActiveEnabled || isManualScrolling || !activeNodeId) return;
		const index = displayedNodes.findIndex((n) => n.node.id === activeNodeId);
		if (index !== -1) rowVirtualizer.scrollToIndex(index, { align: 'center' });
	}, [activeNodeId, isFollowActiveEnabled, displayedNodes, isManualScrolling, rowVirtualizer]);

	const handleManualScroll = useCallback(() => {
		setIsManualScrolling(true);
		if (manualScrollTimerRef.current) clearTimeout(manualScrollTimerRef.current);
		manualScrollTimerRef.current = setTimeout(() => setIsManualScrolling(false), 2000);
	}, []);

	const handleSelect = (id: string, e: React.MouseEvent) => {
		if (e.ctrlKey || e.metaKey) selectNode(id, { additive: true });
		else if (e.shiftKey) selectNode(id, { range: true });
		else selectNode(id);
	};

	const handleDragOver = (event: { over: { id: string | number } | null }) => {
		if (isShiftHeld && event.over) {
			setNestTargetId(String(event.over.id));
		} else {
			setNestTargetId(null);
		}
	};

	const handleDragEnd = async (event: { active: { id: string | number }; over: { id: string | number } | null }) => {
		const { active, over } = event;
		setActiveDragId(null);
		setNestTargetId(null);
		if (!over || active.id === over.id) return;

		const activeId = String(active.id);
		const overId = String(over.id);

		if (isShiftHeld) {
			await nestNote(activeId, overId);
			return;
		}

		const oldIndex = displayedNodes.findIndex((n) => n.node.id === activeId);
		const newIndex = displayedNodes.findIndex((n) => n.node.id === overId);
		if (oldIndex === -1 || newIndex === -1) return;

		const overNode = treeNodes.find((n) => n.id === overId);
		if (!overNode) return;

		if (newIndex > oldIndex) {
			const siblings = treeNodes.filter((n) => n.parentId === overNode.parentId).sort((a, b) => a.orderKey - b.orderKey);
			const overIndexInSiblings = siblings.findIndex((n) => n.id === overId);
			const nextSibling = siblings[overIndexInSiblings + 1];
			moveNote(activeId, overNode.parentId, undefined, nextSibling?.id);
		} else {
			moveNote(activeId, overNode.parentId, undefined, overId);
		}
	};

	const handleTreeKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (!selectedNodeId) return;
			if (e.key === 'Enter') {
				e.preventDefault();
				const targetPane = e.ctrlKey ? ((focusedPane === 1 ? 2 : 1) as 1 | 2) : focusedPane;
				openNote(selectedNodeId, targetPane);
				if (!e.ctrlKey) triggerEditorFocus();
			} else if (e.key === 'F2') {
				e.preventDefault();
				setEditingNodeId(selectedNodeId);
			} else if (e.key === 'ArrowDown') {
				e.preventDefault();
				const flat = displayedNodes.map((n) => n.node.id);
				const idx = flat.indexOf(selectedNodeId);
				if (idx < flat.length - 1) {
					selectNode(flat[idx + 1]);
					rowVirtualizer.scrollToIndex(idx + 1, { align: 'auto' });
				}
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				const flat = displayedNodes.map((n) => n.node.id);
				const idx = flat.indexOf(selectedNodeId);
				if (idx > 0) {
					selectNode(flat[idx - 1]);
					rowVirtualizer.scrollToIndex(idx - 1, { align: 'auto' });
				}
			}
		},
		[selectedNodeId, focusedPane, displayedNodes, openNote, selectNode, triggerEditorFocus, rowVirtualizer, setEditingNodeId]
	);

	return (
		<div className="h-full flex flex-col bg-sidebar">
			<div className="p-3 border-b border-sidebar-border flex-shrink-0 space-y-2">
				<div className="flex items-center gap-2">
					<Button size="sm" variant="default" className="h-8 px-2.5 gap-1.5 shrink-0" onClick={() => quickCapture()} title="クイックキャプチャ (Ctrl+Shift+M)">
						<Zap className="w-3.5 h-3.5" />
						<span className="text-xs font-medium">一言</span>
					</Button>
					<div className="relative flex-1">
						<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
						<Input
							type="text"
							placeholder="検索..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-8 h-8 text-sm bg-background/80 border-border/80"
						/>
					</div>
					<Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => (selectedNodeId ? createSibling(selectedNodeId) : createChild(null))} title="新規 (Ctrl+N)">
						<Plus className="w-4 h-4" />
					</Button>
				</div>
				{sortMode === 'recent' && (
					<p className="text-[10px] text-muted-foreground/60 px-0.5">新しい順 — 雑に積んでOK</p>
				)}
				{isShiftHeld && activeDragId && (
					<p className="text-[10px] text-primary px-0.5 animate-pulse">Shift+ドロップで子ノート化</p>
				)}
			</div>

			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragStart={(e) => setActiveDragId(String(e.active.id))}
				onDragOver={handleDragOver}
				onDragEnd={handleDragEnd}
			>
				<div
					ref={scrollContainerRef}
					className="flex-1 overflow-y-auto py-2 outline-none"
					tabIndex={0}
					onKeyDown={handleTreeKeyDown}
					onScroll={handleManualScroll}
					onWheel={handleManualScroll}
				>
					<SortableContext items={displayedNodes.map((n) => n.node.id)} strategy={verticalListSortingStrategy}>
						{displayedNodes.length === 0 ? (
							<div className="px-4 py-12 text-center text-muted-foreground">
								<p className="text-xs font-medium">ノートがありません</p>
								<Button variant="link" size="sm" className="mt-2 text-xs" onClick={() => quickCapture()}>
									一言メモを書く
								</Button>
							</div>
						) : (
							<div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
								{rowVirtualizer.getVirtualItems().map((virtualRow) => {
									const { node, depth } = displayedNodes[virtualRow.index];
									const isActiveInAnyPane = activeNodeIds[1] === node.id || activeNodeIds[2] === node.id;
									return (
										<div
											key={node.id}
											style={{
												position: 'absolute',
												top: 0,
												left: 0,
												width: '100%',
												height: `${virtualRow.size}px`,
												transform: `translateY(${virtualRow.start}px)`,
											}}
										>
											<TreeItem
												node={node}
												depth={depth}
												isSelected={selectedNodeId === node.id}
												isMultiSelected={selectedNodeIds.has(node.id) && selectedNodeIds.size > 1}
												isActive={isActiveInAnyPane}
												isOpen={openNodeIds.has(node.id)}
												isExpanded={expandedNodeIds.has(node.id)}
												isEditing={editingNodeId === node.id}
												isNestTarget={nestTargetId === node.id}
												onSelect={handleSelect}
												onToggle={(id, e) => { e.stopPropagation(); toggleExpanded(id); }}
												onOpenNote={(id) => openNote(id, focusedPane, false)}
												onTriggerEditorFocus={triggerEditorFocus}
												onRename={(id) => setEditingNodeId(id)}
												onCommitRename={(id, title) => renameNote(id, title)}
												onCancelRename={() => setEditingNodeId(null)}
												onDelete={(id) => { if (confirm('削除しますか？')) deleteNote(id); }}
												onTogglePin={(id) => togglePinNote(id)}
											/>
										</div>
									);
								})}
							</div>
						)}
					</SortableContext>
				</div>

				<DragOverlay dropAnimation={null}>
					{activeDragNode ? (
						<TreeItem
							node={activeDragNode}
							depth={0}
							isSelected={false}
							isMultiSelected={false}
							isActive={false}
							isOpen={false}
							isExpanded={false}
							isEditing={false}
							isOverlay
							onSelect={() => {}}
							onToggle={() => {}}
							onOpenNote={() => {}}
							onTriggerEditorFocus={() => {}}
							onRename={() => {}}
							onCommitRename={() => {}}
							onCancelRename={() => {}}
							onDelete={() => {}}
							onTogglePin={() => {}}
						/>
					) : null}
				</DragOverlay>
			</DndContext>

			<div className="px-4 py-1.5 border-t border-sidebar-border text-[10px] text-muted-foreground flex-shrink-0 bg-sidebar/60 font-medium tracking-tight flex justify-between">
				<span>{treeNodes.length} items{selectedNodeIds.size > 1 ? ` · ${selectedNodeIds.size} 選択` : ''}</span>
				<span className="opacity-50">{sortMode === 'recent' ? '新しい順' : '手動順'}</span>
			</div>
		</div>
	);
}
