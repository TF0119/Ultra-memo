'use client';

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCcw, X } from 'lucide-react';
import { useNoteStore } from '@/lib/store';
import { ConfirmDialog } from './confirm-dialog';

interface DeletedNote {
	id: string;
	title: string;
	deletedAt: number;
}

interface TrashModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function TrashModal({ open, onOpenChange }: TrashModalProps) {
	const [deletedNotes, setDeletedNotes] = useState<DeletedNote[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [hardDeleteTarget, setHardDeleteTarget] = useState<DeletedNote | null>(null);
	const { refreshTree, purgeNotesFromFrontend } = useNoteStore();

	const loadDeletedNotes = async () => {
		setLoading(true);
		setError(null);
		try {
			const notes = await invoke<DeletedNote[]>('get_deleted_notes');
			setDeletedNotes(notes);
		} catch (err) {
			console.error('Failed to load deleted notes:', err);
			setError('ゴミ箱の読み込みに失敗しました');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (open) {
			loadDeletedNotes();
		}
	}, [open]);

	const handleRestore = async (id: string) => {
		setError(null);
		try {
			await invoke('restore_note', { id });
			setDeletedNotes((prev) => prev.filter((n) => n.id !== id));
			await refreshTree();
		} catch (err) {
			console.error('Failed to restore note:', err);
			setError('ノートの復元に失敗しました');
		}
	};

	const handleHardDelete = async (id: string) => {
		setError(null);
		try {
			await invoke('hard_delete_note', { id });
			setDeletedNotes((prev) => prev.filter((n) => n.id !== id));
			purgeNotesFromFrontend([id]);
			await refreshTree();
		} catch (err) {
			console.error('Failed to hard delete note:', err);
			setError('ノートの完全削除に失敗しました');
		}
	};

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleString('ja-JP', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Trash2 className="w-4 h-4" />
						ゴミ箱
					</DialogTitle>
				</DialogHeader>

				<div className="mt-4 max-h-80 overflow-y-auto">
					{error && (
						<div className="mb-3 px-3 py-2 rounded-md bg-red-500/10 text-red-500 text-xs">{error}</div>
					)}
					{loading ? (
						<div className="py-8 text-center text-muted-foreground text-sm">読み込み中...</div>
					) : deletedNotes.length === 0 ? (
						<div className="py-8 text-center text-muted-foreground text-sm">ゴミ箱は空です</div>
					) : (
						<div className="space-y-2">
							{deletedNotes.map((note) => (
								<div key={note.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/50 hover:bg-accent transition-colors">
									<div className="flex-1 min-w-0 mr-3">
										<div className="font-medium truncate text-sm">{note.title}</div>
										<div className="text-xs text-muted-foreground">{formatDate(note.deletedAt)}</div>
									</div>
									<div className="flex items-center gap-1 flex-shrink-0">
										<Button
											size="sm"
											variant="ghost"
											className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30"
											onClick={() => handleRestore(note.id)}
											title="復元"
										>
											<RotateCcw className="w-4 h-4" />
										</Button>
										<Button
											size="sm"
											variant="ghost"
											className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
											onClick={() => setHardDeleteTarget(note)}
											title="完全に削除"
										>
											<X className="w-4 h-4" />
										</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</DialogContent>

			<ConfirmDialog
				open={!!hardDeleteTarget}
				onOpenChange={(o) => { if (!o) setHardDeleteTarget(null); }}
				title="完全に削除しますか？"
				description={
					<>
						「<span className="text-foreground font-medium">{hardDeleteTarget?.title || '無題'}</span>」を完全に削除します。<span className="text-red-400">この操作は取り消せません。</span>
					</>
				}
				confirmLabel="完全に削除"
				onConfirm={() => { if (hardDeleteTarget) handleHardDelete(hardDeleteTarget.id); setHardDeleteTarget(null); }}
			/>
		</Dialog>
	);
}
