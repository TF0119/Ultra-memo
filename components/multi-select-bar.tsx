'use client';

import { useNoteStore } from '@/lib/store';
import { Button } from './ui/button';
import { Pin, Trash2, X } from 'lucide-react';

export function MultiSelectBar() {
	const { selectedNodeIds, batchDelete, batchPin, clearSelection } = useNoteStore();
	const count = selectedNodeIds.size;

	if (count <= 1) return null;

	return (
		<div className="px-3 py-2 border-b border-sidebar-border bg-primary/5 flex items-center gap-2 flex-shrink-0 animate-in slide-in-from-top-1 duration-150">
			<span className="text-xs font-medium text-foreground/80 flex-1">{count}件選択中</span>
			<Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => batchPin(true)}>
				<Pin className="w-3 h-3" />
				ピン
			</Button>
			<Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-red-500 hover:text-red-500 hover:bg-red-500/10" onClick={() => batchDelete()}>
				<Trash2 className="w-3 h-3" />
				削除
			</Button>
			<Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => clearSelection()} title="選択解除">
				<X className="w-3.5 h-3.5" />
			</Button>
		</div>
	);
}
