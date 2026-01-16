'use client';

import { useNoteStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Type } from 'lucide-react';

interface MarkdownToggleProps {
	nodeId: string;
	isMarkdownView: boolean;
}

export function MarkdownToggle({ nodeId, isMarkdownView }: MarkdownToggleProps) {
	const { toggleMarkdownView } = useNoteStore();

	const handleClick = async (e: React.MouseEvent) => {
		e.stopPropagation();
		await toggleMarkdownView(nodeId);
	};

	return (
		<button
			onClick={handleClick}
			className={cn('flex items-center justify-center w-5 h-5 rounded transition-colors hover:bg-muted/50', isMarkdownView ? 'text-foreground' : 'text-muted-foreground/40')}
			title={isMarkdownView ? 'マークダウン表示: オン' : 'マークダウン表示: オフ'}
		>
			<Type className="w-3.5 h-3.5" strokeWidth={2} />
		</button>
	);
}
