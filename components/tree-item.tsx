'use client';

import React, { useRef, useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, FileText, MoreHorizontal, Pin, Trash2, Edit2, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TreeNode } from '@/lib/store';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TreeItemProps {
	node: TreeNode;
	depth: number;
	isSelected: boolean;
	isActive: boolean;
	isOpen: boolean;
	isExpanded: boolean;
	isOverlay?: boolean; // New prop
	onSelect: (id: string) => void;
	onToggle: (id: string, e: React.MouseEvent) => void;
	onOpenNote: (id: string) => void;
	onTriggerEditorFocus: () => void;

	// High-level Actions
	onRename: (id: string) => void;
	onDelete: (id: string) => void;
	onTogglePin: (id: string) => void;
}

export function TreeItem({
	node,
	depth,
	isSelected,
	isActive,
	isOpen,
	isExpanded,
	isOverlay,
	onSelect,
	onToggle,
	onOpenNote,
	onTriggerEditorFocus,
	onRename,
	onDelete,
	onTogglePin,
}: TreeItemProps) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition: transition ?? undefined,
		paddingLeft: `${depth * 16 + 12}px`,
		opacity: isDragging && !isOverlay ? 0 : 1, // Hide original when dragging, show overlay always
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			className={cn(
				'group flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none relative focus:outline-none',
				isActive ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-accent/70 text-foreground',
				isSelected && !isActive && 'bg-accent/50',
				isDragging && 'z-50 shadow-lg rounded'
			)}
			onClick={(e) => {
				onSelect(node.id);
				onOpenNote(node.id);
				(e.currentTarget as HTMLElement).focus();
			}}
			onDoubleClick={() => onTriggerEditorFocus()}
		>
			{isActive && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary-foreground" />}

			{/* Expand/Collapse */}
			<div
				className="w-4 h-4 flex items-center justify-center flex-shrink-0 z-10"
				onPointerDown={(e) => e.stopPropagation()} // Prevent drag start on toggle
			>
				{node.hasChildren && (
					<div onClick={(e) => onToggle(node.id, e)} className="hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors cursor-pointer p-0.5">
						{isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
					</div>
				)}
			</div>

			<FileText className={cn('w-3.5 h-3.5 flex-shrink-0', isActive ? 'opacity-100' : 'opacity-40')} />
			{node.isPinned && <Pin className={cn('w-3 h-3 flex-shrink-0 -ml-1', isActive ? 'text-primary-foreground' : 'text-amber-500')} />}
			{isOpen && !node.isPinned && <div className={cn('w-1 h-1 rounded-full flex-shrink-0 -ml-1', isActive ? 'bg-primary-foreground/50' : 'bg-foreground/30')} />}

			<span className="flex-1 truncate text-[13px] font-normal tracking-tight leading-tight transition-all">{node.title}</span>

			{/* Hover Actions (Menu) */}
			<div
				className={cn(
					'flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-auto pl-2',
					isActive ? 'text-primary-foreground' : 'text-muted-foreground'
				)}
			>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							className="p-0.5 hover:bg-black/5 dark:hover:bg-white/10 rounded"
							onClick={(e) => e.stopPropagation()}
							onPointerDown={(e) => e.stopPropagation()} // Prevent drag
						>
							<MoreHorizontal className="w-3.5 h-3.5" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" alignOffset={-5} className="w-40">
						<DropdownMenuItem
							onClick={(e) => {
								e.stopPropagation();
								onRename(node.id);
							}}
						>
							<Edit2 className="w-3.5 h-3.5 mr-2" />
							名前を変更
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={(e) => {
								e.stopPropagation();
								onTogglePin(node.id);
							}}
						>
							<Pin className="w-3.5 h-3.5 mr-2" />
							{node.isPinned ? 'ピン解除' : 'ピン留め'}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={(e) => {
								e.stopPropagation();
								navigator.clipboard.writeText(node.id);
							}}
						>
							<Copy className="w-3.5 h-3.5 mr-2" />
							IDをコピー
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
							onClick={(e) => {
								e.stopPropagation();
								onDelete(node.id);
							}}
						>
							<Trash2 className="w-3.5 h-3.5 mr-2" />
							削除
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{Node.length > 0 && (
				<span className={cn('text-[10px] tabular-nums font-medium opacity-0 group-hover:opacity-40 transition-opacity', isActive && 'group-hover:opacity-60')}>
					{node.content.length}
				</span>
			)}
		</div>
	);
}
