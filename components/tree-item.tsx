'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ChevronRight, ChevronDown, FileText, MoreHorizontal, Pin, Trash2, Edit2, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TreeNode } from '@/lib/store';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isPlaceholderTitle } from '@/lib/wiki-links';

interface TreeItemProps {
	node: TreeNode;
	depth: number;
	isSelected: boolean;
	isMultiSelected: boolean;
	isActive: boolean;
	isOpen: boolean;
	isExpanded: boolean;
	isEditing: boolean;
	isNestTarget?: boolean;
	isOverlay?: boolean;
	onSelect: (id: string, e: React.MouseEvent) => void;
	onToggle: (id: string, e: React.MouseEvent) => void;
	onOpenNote: (id: string) => void;
	onTriggerEditorFocus: () => void;
	onRename: (id: string) => void;
	onCommitRename: (id: string, title: string) => void;
	onCancelRename: () => void;
	onDelete: (id: string) => void;
	onTogglePin: (id: string) => void;
}

export function TreeItem({
	node,
	depth,
	isSelected,
	isMultiSelected,
	isActive,
	isOpen,
	isExpanded,
	isEditing,
	isNestTarget,
	isOverlay,
	onSelect,
	onToggle,
	onOpenNote,
	onTriggerEditorFocus,
	onRename,
	onCommitRename,
	onCancelRename,
	onDelete,
	onTogglePin,
}: TreeItemProps) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: node.id,
		disabled: isEditing,
	});
	const inputRef = useRef<HTMLInputElement>(null);
	const editStartRef = useRef(0);
	const [menuOpen, setMenuOpen] = useState(false);

	// Focus the rename input reliably. It mounts right as the ⋯ menu closes, and the
	// menu can otherwise pull focus back — so re-assert focus over the first frames.
	useEffect(() => {
		if (!isEditing) return;
		editStartRef.current = Date.now();
		const focus = () => {
			const el = inputRef.current;
			if (el) {
				el.focus();
				el.select();
			}
		};
		focus();
		const raf = requestAnimationFrame(focus);
		const t1 = setTimeout(focus, 30);
		const t2 = setTimeout(focus, 90);
		return () => {
			cancelAnimationFrame(raf);
			clearTimeout(t1);
			clearTimeout(t2);
		};
	}, [isEditing]);

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition: transition ?? undefined,
		paddingLeft: `${depth * 16 + 12}px`,
		opacity: isDragging && !isOverlay ? 0 : 1,
	};

	const displayTitle = isPlaceholderTitle(node.title) && node.contentPreview ? node.contentPreview.slice(0, 30) : node.title;

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			className={cn(
				'group flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none relative focus:outline-none h-8',
				isActive ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-accent/70 text-foreground',
				(isSelected || isMultiSelected) && !isActive && 'bg-accent/50',
				menuOpen && !isActive && 'bg-accent/70',
				isNestTarget && 'ring-2 ring-inset ring-primary/60 bg-primary/10',
				isDragging && 'z-50 shadow-lg rounded'
			)}
			onClick={(e) => {
				onSelect(node.id, e);
				(e.currentTarget as HTMLElement).focus();
			}}
			onDoubleClick={(e) => {
				e.preventDefault();
				onOpenNote(node.id);
				onTriggerEditorFocus();
			}}
			tabIndex={isSelected ? 0 : -1}
		>
			{isActive && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary-foreground" />}

			<div className="w-4 h-4 flex items-center justify-center flex-shrink-0 z-10" onPointerDown={(e) => e.stopPropagation()}>
				{node.hasChildren && (
					<div onClick={(e) => onToggle(node.id, e)} className="hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors cursor-pointer p-0.5">
						{isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
					</div>
				)}
			</div>

			<FileText className={cn('w-3.5 h-3.5 flex-shrink-0', isActive ? 'opacity-100' : 'opacity-40')} />
			{node.isPinned && <Pin className={cn('w-3 h-3 flex-shrink-0 -ml-1', isActive ? 'text-primary-foreground' : 'text-amber-500')} />}
			{isOpen && !node.isPinned && <div className={cn('w-1 h-1 rounded-full flex-shrink-0 -ml-1', isActive ? 'bg-primary-foreground/50' : 'bg-foreground/30')} />}

			{isEditing ? (
				<input
					ref={inputRef}
					defaultValue={isPlaceholderTitle(node.title) ? '' : node.title}
					placeholder="無題"
					className="flex-1 text-[13px] bg-background/20 border border-border/50 rounded px-1 py-0 outline-none min-w-0"
					onClick={(e) => e.stopPropagation()}
					onPointerDown={(e) => e.stopPropagation()}
					onKeyDown={(e) => {
						e.stopPropagation();
						if (e.key === 'Enter') {
							onCommitRename(node.id, (e.target as HTMLInputElement).value.trim() || '無題');
							onTriggerEditorFocus();
						} else if (e.key === 'Escape') {
							onCancelRename();
						}
					}}
					onBlur={(e) => {
						// Ignore the spurious blur caused by the ⋯ menu closing; keep editing.
						if (Date.now() - editStartRef.current < 250) {
							inputRef.current?.focus();
							return;
						}
						onCommitRename(node.id, e.target.value.trim() || '無題');
					}}
				/>
			) : (
				<span className={cn('flex-1 truncate text-[13px] font-normal tracking-tight leading-tight', isPlaceholderTitle(node.title) && !node.contentPreview && 'opacity-40 italic')}>
					{displayTitle || '無題'}
				</span>
			)}

			<div className={cn('flex items-center transition-opacity ml-auto pl-2', menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100', isActive ? 'text-primary-foreground' : 'text-muted-foreground')}>
				<DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
					<DropdownMenuTrigger asChild>
						<button
							className={cn(
								'p-0.5 rounded cursor-pointer transition-colors',
								isActive ? 'hover:bg-primary-foreground/25' : 'hover:bg-foreground/15',
								'data-[state=open]:bg-foreground/15'
							)}
							onClick={(e) => e.stopPropagation()}
							onPointerDown={(e) => e.stopPropagation()}
						>
							<MoreHorizontal className="w-3.5 h-3.5" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" alignOffset={-5} className="w-44 [&_[role=menuitem]]:text-xs [&_[role=menuitem]]:py-1.5" onCloseAutoFocus={(e) => e.preventDefault()}>
						<DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(node.id); }}>
							<Edit2 className="w-3.5 h-3.5 mr-2" />名前を変更 <span className="ml-auto text-[10px] opacity-40">F2</span>
						</DropdownMenuItem>
						<DropdownMenuItem onClick={(e) => { e.stopPropagation(); void navigator.clipboard.writeText(displayTitle || node.title); }}>
							<Copy className="w-3.5 h-3.5 mr-2" />タイトルをコピー
						</DropdownMenuItem>
						<DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePin(node.id); }}>
							<Pin className="w-3.5 h-3.5 mr-2" />{node.isPinned ? 'ピン解除' : 'ピン留め'}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(node.id); }}>
							<Copy className="w-3.5 h-3.5 mr-2" />IDをコピー
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem className="text-red-500 focus:text-red-500 focus:bg-red-500/10" onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}>
							<Trash2 className="w-3.5 h-3.5 mr-2" />削除
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{node.contentLength > 0 && (
				<span className={cn('text-[10px] tabular-nums font-medium opacity-0 group-hover:opacity-40 transition-opacity', isActive && 'group-hover:opacity-60')}>
					{node.contentLength}
				</span>
			)}
		</div>
	);
}
