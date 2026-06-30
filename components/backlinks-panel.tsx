'use client';

import { useState, useEffect } from 'react';
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

	useEffect(() => {
		setExpanded(false);
	}, [activeId]);

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
				<div className="flex flex-col gap-1 max-w-lg">
					{backlinks.map((bl) => (
						<button
							key={bl.id}
							type="button"
							onClick={(e) => {
								const targetPane = e.ctrlKey || e.metaKey ? ((paneId === 1 ? 2 : 1) as 1 | 2) : paneId;
								openNote(bl.id, targetPane, false);
							}}
							className={cn(
								'text-left px-2.5 py-1.5 rounded-md border border-border/40',
								'hover:bg-accent/60 hover:border-border transition-colors'
							)}
							title={bl.snippet || bl.title}
						>
							<div className="text-[11px] font-medium truncate text-foreground/90">{bl.title}</div>
							{bl.snippet && (
								<div className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{bl.snippet}</div>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
