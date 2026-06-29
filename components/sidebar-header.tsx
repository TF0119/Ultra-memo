'use client';

import { useState } from 'react';
import { useNoteStore } from '@/lib/store';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, Trash2, Columns2, Maximize2, Crosshair, Link2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TrashModal } from './trash-modal';

interface SidebarHeaderProps {
	splitMode: 'single' | 'split';
	setSplitMode: (mode: 'single' | 'split') => void;
}

export function SidebarHeader({ splitMode, setSplitMode }: SidebarHeaderProps) {
	const { goBack, goForward, history, historyIndex, isFollowActiveEnabled, isSyncScrollEnabled, toggleFollowActive, toggleSyncScroll, exportMarkdownTree } =
		useNoteStore();
	const [trashOpen, setTrashOpen] = useState(false);

	const canGoBack = historyIndex > 0;
	const canGoForward = historyIndex < history.length - 1;

	return (
		<>
			<div className="h-11 border-b border-border flex items-center justify-between px-3 gap-1 flex-shrink-0 bg-card/30">
				<div className="flex items-center gap-1">
					<div className="flex items-center gap-0.5">
						<Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-accent/80" disabled={!canGoBack} onClick={goBack} title="戻る">
							<ChevronLeft className="w-4 h-4 opacity-70" />
						</Button>
						<Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-accent/80" disabled={!canGoForward} onClick={goForward} title="進む">
							<ChevronRight className="w-4 h-4 opacity-70" />
						</Button>
					</div>

					<div className="w-px h-3.5 bg-border/60 mx-1" />

					<Button
						variant="ghost"
						size="sm"
						className="h-7 w-7 p-0 hover:bg-red-500/10 hover:text-red-500 transition-colors"
						title="ゴミ箱"
						onClick={() => setTrashOpen(true)}
					>
						<Trash2 className="w-3.5 h-3.5 opacity-60" />
					</Button>

					<div className="w-px h-3.5 bg-border/60 mx-1" />

					<Button
						variant="ghost"
						size="sm"
						className={cn('h-7 w-7 p-0 transition-colors', isFollowActiveEnabled ? 'text-primary bg-primary/10' : 'hover:bg-accent/80')}
						title={isFollowActiveEnabled ? 'Follow Active: ON' : 'Follow Active: OFF'}
						onClick={toggleFollowActive}
					>
						<Crosshair className="w-3.5 h-3.5" />
					</Button>

					<Button
						variant="ghost"
						size="sm"
						className={cn('h-7 w-7 p-0 transition-colors', isSyncScrollEnabled ? 'text-primary bg-primary/10' : 'hover:bg-accent/80')}
						title={isSyncScrollEnabled ? '同期スクロール: ON' : '同期スクロール: OFF'}
						onClick={toggleSyncScroll}
						disabled={splitMode !== 'split'}
					>
						<Link2 className="w-3.5 h-3.5" />
					</Button>

					<Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-accent/80" title="Markdownエクスポート" onClick={() => exportMarkdownTree()}>
						<Download className="w-3.5 h-3.5 opacity-70" />
					</Button>
				</div>

				<Button
					size="sm"
					variant="ghost"
					onClick={() => setSplitMode(splitMode === 'single' ? 'split' : 'single')}
					className="h-7 w-7 p-0 hover:bg-accent transition-colors shrink-0"
					title={splitMode === 'single' ? '分割表示' : '単一表示'}
				>
					{splitMode === 'single' ? <Columns2 className="w-3.5 h-3.5 opacity-70" /> : <Maximize2 className="w-3.5 h-3.5 opacity-70" />}
				</Button>
			</div>

			<TrashModal open={trashOpen} onOpenChange={setTrashOpen} />
		</>
	);
}
