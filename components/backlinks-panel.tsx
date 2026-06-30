'use client';

import { useState } from 'react';
import { useNoteStore } from '@/lib/store';
import { Link2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BacklinksPanelProps {
	paneId: 1 | 2;
}

export function BacklinksPanel({ paneId }: BacklinksPanelProps) {
	const { backlinksByNoteId, openNote, activeNodeIds } = useNoteStore();
	const [expanded, setExpanded] = useState(false);
	const activeId = activeNodeIds[paneId];
	const backlinks = activeId ? (backlinksByNoteId[activeId] ?? []) : [];

	if (!activeId || backlinks.length === 0) return null;

	return (
		<div className="px-8 pb-2 flex-shrink-0">
			<button
				type="button"
				onClick={() => setExpanded((e) => !e)}
				className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 mb-1.5 hover:text-muted-foreground/70 transition-colors"
			>
				<Link2 className="w-3 h-3" />
				<span>バックリンク ({backlinks.length})</span>
				{expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
			</button>
			{expanded && (
				<div className="flex flex-wrap gap-1.5">
					{backlinks.map((bl) => (
						<button
							key={bl.id}
							type="button"
							onClick={(e) => {
								const targetPane = e.ctrlKey || e.metaKey ? ((paneId === 1 ? 2 : 1) as 1 | 2) : paneId;
								openNote(bl.id, targetPane, false);
							}}
							className={cn(
								'text-[11px] px-2 py-0.5 rounded-md border border-border/40 max-w-[200px] truncate',
								'hover:bg-accent/60 hover:border-border transition-colors text-muted-foreground hover:text-foreground'
							)}
							title={bl.snippet || bl.title}
						>
							{bl.title}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
