'use client';

import { useNoteStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Type } from 'lucide-react';

interface MarkdownToggleProps {
	nodeId: string;
	isMarkdownView: boolean;
}

export function MarkdownToggle({ nodeId, isMarkdownView }: MarkdownToggleProps) {
	const { toggleMarkdownView, activeNodeIds, flushEditorSave } = useNoteStore();

	const handleClick = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (activeNodeIds[1] === nodeId) flushEditorSave(1);
		if (activeNodeIds[2] === nodeId) flushEditorSave(2);
		await toggleMarkdownView(nodeId);
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			aria-label={isMarkdownView ? 'Markdown 表示をオフにする' : 'Markdown 表示をオンにする'}
			aria-pressed={isMarkdownView}
			className={cn(
				'flex items-center justify-center w-5 h-5 rounded transition-colors hover:bg-muted/50',
				isMarkdownView ? 'text-foreground bg-muted/40' : 'text-muted-foreground/40 hover:text-foreground'
			)}
			title={isMarkdownView ? 'Markdown 表示: オン。クリックで Markdown 記法をそのまま編集' : 'Markdown 表示: オフ。クリックで Markdown を読みやすく表示'}
		>
			<Type className="w-3.5 h-3.5" strokeWidth={2} />
		</button>
	);
}
