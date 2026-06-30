'use client';

import { useNoteStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useEffect, useState, useRef } from 'react';

export function StatusIndicator({ paneId }: { paneId: 1 | 2 }) {
	const saveStatus = useNoteStore((s) => s.saveStatusByPane[paneId]);
	const flushEditorSave = useNoteStore((s) => s.flushEditorSave);
	const [displayStatus, setDisplayStatus] = useState<'saved' | 'saving' | 'error'>('saved');
	const [blink, setBlink] = useState(false);
	const savingTimerRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		if (saveStatus === 'saving') {
			setDisplayStatus('saving');
			if (savingTimerRef.current) {
				clearTimeout(savingTimerRef.current);
				savingTimerRef.current = null;
			}
		} else if (saveStatus === 'saved') {
			if (displayStatus === 'saving') {
				savingTimerRef.current = setTimeout(() => {
					setDisplayStatus('saved');
					savingTimerRef.current = null;
				}, 500);
			} else {
				setDisplayStatus('saved');
			}
		} else if (saveStatus === 'error') {
			setDisplayStatus('error');
		}

		return () => {
			if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
		};
	}, [saveStatus, displayStatus]);

	useEffect(() => {
		if (displayStatus === 'error') {
			const interval = setInterval(() => setBlink((prev) => !prev), 500);
			return () => clearInterval(interval);
		}
		setBlink(false);
	}, [displayStatus]);

	return (
		<button
			type="button"
			className={cn('flex items-center justify-center flex-shrink-0', displayStatus === 'error' && 'cursor-pointer hover:opacity-80')}
			title={
				displayStatus === 'saving'
					? '保存中...'
					: displayStatus === 'saved'
						? '保存済み'
						: '保存エラー — クリックで再試行'
			}
			onClick={() => {
				if (displayStatus === 'error') flushEditorSave(paneId);
			}}
		>
			{displayStatus === 'saving' && <div className="w-1.5 h-1.5 rounded-full border border-orange-500 border-t-transparent animate-spin" />}
			{displayStatus === 'saved' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
			{displayStatus === 'error' && (
				<div className={cn('w-1.5 h-1.5 rounded-full bg-red-500 transition-opacity duration-200', blink ? 'opacity-100' : 'opacity-30')} />
			)}
		</button>
	);
}
