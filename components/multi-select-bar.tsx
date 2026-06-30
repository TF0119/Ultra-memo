'use client';

import { useState } from 'react';
import { useNoteStore } from '@/lib/store';
import { Button } from './ui/button';
import { Pin, Trash2, X } from 'lucide-react';
import { ConfirmDialog } from './confirm-dialog';

export function MultiSelectBar() {
	const { selectedNodeIds, batchDelete, batchPin, clearSelection } = useNoteStore();
	const [confirmOpen, setConfirmOpen] = useState(false);
	const count = selectedNodeIds.size;

	if (count <= 1) return null;

	return (
		<div className="px-3 py-2 border-b border-sidebar-border bg-primary/5 flex items-center gap-2 flex-shrink-0 animate-in slide-in-from-top-1 duration-150">
			<span className="text-xs font-medium text-foreground/80 flex-1">{count}件選択中</span>
			<Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => batchPin(true)}>
				<Pin className="w-3 h-3" />
				ピン
			</Button>
			<Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-red-500 hover:text-red-500 hover:bg-red-500/10" onClick={() => setConfirmOpen(true)}>
				<Trash2 className="w-3 h-3" />
				削除
			</Button>
			<Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => clearSelection()} title="選択解除 (Esc)">
				<X className="w-3.5 h-3.5" />
			</Button>

			<ConfirmDialog
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				title={`${count}件のノートを削除しますか？`}
				description="選択したノートをまとめてゴミ箱に移動します。あとでゴミ箱から復元できます。"
				confirmLabel="削除"
				onConfirm={() => { batchDelete(); setConfirmOpen(false); }}
			/>
		</div>
	);
}
