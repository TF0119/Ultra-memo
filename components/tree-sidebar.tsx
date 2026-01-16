'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, FileText, Plus, Search } from 'lucide-react';
import { useNoteStore, type TreeNode } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
	} = useNoteStore();

	const [searchQuery, setSearchQuery] = useState('');
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renamingTitle, setRenamingTitle] = useState('');
	const activeNodeRef = useRef<HTMLDivElement>(null);
	const renameInputRef = useRef<HTMLInputElement>(null);

	// Auto-scroll to active node when Follow Active is enabled
	useEffect(() => {
		if (isFollowActiveEnabled && activeNodeRef.current) {
			activeNodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}, [activeNodeIds, isFollowActiveEnabled]);

	// F2 key to rename selected node
	useEffect(() => {
		const handleGlobalKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'F2' && selectedNodeId && !renamingId) {
				const node = treeNodes.find((n) => n.id === selectedNodeId);
				if (node) {
					e.preventDefault();
					setRenamingId(node.id);
					setRenamingTitle(node.title);
				}
			}
		};

		window.addEventListener('keydown', handleGlobalKeyDown);
		return () => window.removeEventListener('keydown', handleGlobalKeyDown);
	}, [selectedNodeId, renamingId, treeNodes]);

	// Focus rename input when it appears
	useEffect(() => {
		if (renamingId && renameInputRef.current) {
			renameInputRef.current.focus();
			renameInputRef.current.select();
		}
	}, [renamingId]);

	const filteredNodes = treeNodes.filter((node) => node.title.toLowerCase().includes(searchQuery.toLowerCase()));

	const renderNode = (node: TreeNode, depth = 0) => {
		const isExpanded = expandedNodeIds.has(node.id);
		const isSelected = selectedNodeId === node.id;
		const isActive = activeNodeIds[focusedPane] === node.id;
		const isOpen = openNodeIds.has(node.id);
		const isRenaming = renamingId === node.id;
		const hasChildren = node.hasChildren;

		const children = treeNodes.filter((n) => n.parentId === node.id);

		return (
			<div key={node.id}>
				<div
					ref={isActive ? activeNodeRef : null}
					className={cn(
						'flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none transition-all duration-100 relative group',
						isActive ? 'bg-primary text-primary-foreground font-medium hover:bg-primary' : 'hover:bg-accent/70',
						isSelected && !isActive && 'bg-accent/50'
					)}
					style={{ paddingLeft: `${depth * 16 + 12}px` }}
					onClick={() => {
						selectNode(node.id);
						openNote(node.id, focusedPane);
					}}
				>
					{isActive && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary-foreground" />}

					{/* Expand/Collapse */}
					<div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
						{hasChildren ? (
							<button
								onClick={(e) => {
									e.stopPropagation();
									toggleExpanded(node.id);
								}}
								className="hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
							>
								{isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
							</button>
						) : null}
					</div>

					<FileText className={cn('w-3.5 h-3.5 flex-shrink-0', isActive ? 'opacity-100' : 'opacity-40')} />
					{isOpen && !isActive && <div className="w-1 h-1 rounded-full bg-foreground/30 flex-shrink-0 -ml-1" />}

					{isRenaming ? (
						<input
							ref={renameInputRef}
							type="text"
							value={renamingTitle}
							onChange={(e) => setRenamingTitle(e.target.value)}
							onKeyDown={async (e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									if (renamingTitle.trim()) {
										const { renameNote } = useNoteStore.getState();
										await renameNote(node.id, renamingTitle);
									}
									setRenamingId(null);
								} else if (e.key === 'Escape') {
									setRenamingId(null);
								}
							}}
							onBlur={async () => {
								if (renamingId === node.id) {
									if (renamingTitle.trim() && renamingTitle !== node.title) {
										const { renameNote } = useNoteStore.getState();
										await renameNote(node.id, renamingTitle);
									}
									setRenamingId(null);
								}
							}}
							className="flex-1 bg-background text-foreground text-[13px] px-1 py-0.5 border border-primary/50 rounded focus:outline-none"
							onClick={(e) => e.stopPropagation()}
						/>
					) : (
						<span className={cn('flex-1 truncate text-[13px] tracking-tight leading-tight transition-all', isActive ? 'font-semibold' : 'font-normal')}>
							{node.title}
						</span>
					)}

					<span className="text-[11px] opacity-0 group-hover:opacity-40 transition-opacity tabular-nums font-medium">{node.content.length}</span>
				</div>

				{/* Children */}
				{isExpanded && children.length > 0 && <div className="border-l border-border/40 ml-4">{children.map((child) => renderNode(child, depth + 1))}</div>}
			</div>
		);
	};

	const rootNodes = filteredNodes.filter((node) => node.parentId === null);

	return (
		<div className="h-full flex flex-col bg-sidebar">
			<div className="p-4 border-b border-sidebar-border flex-shrink-0 space-y-3">
				<div className="flex items-center gap-2">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
						<Input
							type="text"
							placeholder="検索..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9 h-9 text-sm bg-background/80 border-border/80 focus:bg-background focus:border-foreground/20 transition-all placeholder:text-muted-foreground/60"
						/>
					</div>
					<Button
						size="sm"
						variant="ghost"
						className="h-9 w-9 p-0 hover:bg-accent transition-colors"
						onClick={() => (selectedNodeId ? createSibling(selectedNodeId) : createChild(null))}
						title="新規ノート (Ctrl+N)"
					>
						<Plus className="w-4 h-4" />
					</Button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto py-2">
				{rootNodes.length === 0 ? (
					<div className="px-4 py-12 text-center text-muted-foreground">
						<FileText className="w-10 h-10 mx-auto mb-3 opacity-20" strokeWidth={1.5} />
						<p className="text-xs font-medium">ノートがありません</p>
						<p className="text-[11px] mt-1 opacity-60">Ctrl+Nで新規作成</p>
					</div>
				) : (
					rootNodes.map((node) => renderNode(node, 0))
				)}
			</div>

			<div className="px-4 py-2.5 border-t border-sidebar-border text-[11px] text-muted-foreground flex-shrink-0 bg-sidebar/60 font-medium tracking-tight">
				<span className="opacity-80">{treeNodes.length} ノート</span>
				<span className="mx-1.5 opacity-40">·</span>
				<span className="opacity-80">{openNodeIds.size} 開いている</span>
			</div>
		</div>
	);
}
