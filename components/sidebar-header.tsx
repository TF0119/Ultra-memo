'use client';

import { useState } from 'react';
import { useNoteStore } from '@/lib/store';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, Trash2, Columns2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TrashModal } from './trash-modal';

interface SidebarHeaderProps {
	splitMode: 'single' | 'split';
	setSplitMode: (mode: 'single' | 'split') => void;
}

export function SidebarHeader({ splitMode, setSplitMode }: SidebarHeaderProps) {
	const { goBack, goForward, history, historyIndex } = useNoteStore();
	const [trashOpen, setTrashOpen] = useState(false);

	// historyIndex is 0-based.
	// If index > 0, we can go back.
	// If index < length - 1, we can go forward.
	const canGoBack = historyIndex > 0;
	const canGoForward = historyIndex < history.length - 1;

	return (
		<>
			<div className="h-11 border-b border-border flex items-center justify-between px-3 gap-1 flex-shrink-0 bg-card/30">
				<div className="flex items-center gap-1">
					{/* History Navigation */}
					<div className="flex items-center gap-0.5">
						<Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-accent/80" disabled={!canGoBack} onClick={goBack} title="戻る">
							<ChevronLeft className="w-4 h-4 opacity-70" />
						</Button>
						<Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-accent/80" disabled={!canGoForward} onClick={goForward} title="進む">
							<ChevronRight className="w-4 h-4 opacity-70" />
						</Button>
					</div>

					<div className="w-px h-3.5 bg-border/60 mx-1" />

					{/* Trash */}
					<Button
						variant="ghost"
						size="sm"
						className="h-7 w-7 p-0 hover:bg-red-500/10 hover:text-red-500 transition-colors"
						title="ゴミ箱"
						onClick={() => setTrashOpen(true)}
					>
						<Trash2 className="w-3.5 h-3.5 opacity-60" />
					</Button>
				</div>

				{/* Split Toggle */}
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
