'use client';

import { useNoteStore } from '@/lib/store';
import { Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BacklinksPanelProps {
	paneId: 1 | 2;
}

export function BacklinksPanel({ paneId }: BacklinksPanelProps) {
	const { backlinks, openNote, activeNodeIds } = useNoteStore();
	const activeId = activeNodeIds[paneId];

	if (!activeId || backlinks.length === 0) return null;

	return (
		<div className="px-8 pb-2 flex-shrink-0">
			<div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 mb-1.5">
				<Link2 className="w-3 h-3" />
				<span>バックリンク ({backlinks.length})</span>
			</div>
			<div className="flex flex-wrap gap-1.5">
				{backlinks.map((bl) => (
					<button
						key={bl.id}
						type="button"
						onClick={() => openNote(bl.id, paneId, false)}
						className={cn(
							'text-[11px] px-2 py-0.5 rounded-md border border-border/40',
							'hover:bg-accent/60 hover:border-border transition-colors text-muted-foreground hover:text-foreground'
						)}
						title={bl.snippet || bl.title}
					>
						{bl.title}
					</button>
				))}
			</div>
		</div>
	);
}
