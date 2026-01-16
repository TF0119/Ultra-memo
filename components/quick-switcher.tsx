'use client';

import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNoteStore } from '@/lib/store';
import { Search, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickSwitcherProps {
	isOpen: boolean;
	onClose: () => void;
}

export function QuickSwitcher({ isOpen, onClose }: QuickSwitcherProps) {
	const [query, setQuery] = useState('');
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [results, setResults] = useState<any[]>([]);
	const { openNote, focusedPane } = useNoteStore();
	const inputRef = useRef<HTMLInputElement>(null);
	const resultsRef = useRef<HTMLDivElement>(null);

	// Search effect
	useEffect(() => {
		if (!query.trim()) {
			setResults([]);
			return;
		}

		const timer = setTimeout(async () => {
			try {
				const searchResults = await invoke<any[]>('search_notes', { query, limit: 30 });
				setResults(searchResults);
				setSelectedIndex(0);
			} catch (error) {
				console.error('Search failed:', error);
			}
		}, 150);

		return () => clearTimeout(timer);
	}, [query]);

	// Focus input when opened
	useEffect(() => {
		if (isOpen) {
			setQuery('');
			setSelectedIndex(0);
			setTimeout(() => inputRef.current?.focus(), 0);
		}
	}, [isOpen]);

	// Auto-scroll to selected item
	useEffect(() => {
		if (resultsRef.current && isOpen) {
			const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
			if (selectedElement) {
				selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
			}
		}
	}, [selectedIndex, isOpen]);

	// Handle keyboard navigation
	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
			} else if (e.key === 'ArrowDown') {
				e.preventDefault();
				setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				setSelectedIndex((prev) => Math.max(prev - 1, 0));
			} else if (e.key === 'Enter') {
				e.preventDefault();
				if (results[selectedIndex]) {
					const targetPane = e.ctrlKey ? (focusedPane === 1 ? 2 : 1) : focusedPane;
					openNote(results[selectedIndex].id, targetPane);
					onClose();
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isOpen, results, selectedIndex, onClose, openNote, focusedPane]);

	if (!isOpen) return null;

	return (
		<>
			<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] z-50 animate-in fade-in duration-200" onClick={onClose}>
				<div
					className="bg-card border-2 border-border rounded-lg shadow-2xl w-full max-w-2xl mx-4 animate-in slide-in-from-top-4 duration-200"
					onClick={(e) => e.stopPropagation()}
				>
					{/* Search Input */}
					<div className="flex items-center gap-3 p-4 border-b border-border bg-card/50">
						<Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
						<input
							ref={inputRef}
							type="text"
							value={query}
							onChange={(e) => {
								setQuery(e.target.value);
								setSelectedIndex(0);
							}}
							placeholder="ノート名または内容を検索..."
							className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/60"
						/>
						<kbd className="px-2 py-1 text-xs bg-muted/50 border border-border rounded font-mono">Esc</kbd>
					</div>

					{/* Results */}
					<div ref={resultsRef} className="max-h-[60vh] overflow-y-auto">
						{results.length === 0 && query.trim() && (
							<div className="p-12 text-center">
								<FileText className="w-12 h-12 mx-auto opacity-10 mb-3" />
								<p className="text-sm text-muted-foreground">「{query}」に一致するノートが見つかりませんでした</p>
							</div>
						)}

						{results.length === 0 && !query.trim() && (
							<div className="p-12 text-center">
								<div className="flex items-center justify-center gap-2 mb-3 opacity-20">
									<kbd className="px-2 py-1 text-lg font-mono border border-border/50 rounded">Ctrl</kbd>
									<span className="text-2xl font-bold">+</span>
									<span className="text-2xl font-bold">P</span>
								</div>
								<p className="text-sm text-muted-foreground">ノート名または内容を検索してください</p>
								<div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground/60">
									<span className="flex items-center gap-1">
										<kbd className="px-1.5 py-0.5 bg-muted/30 border border-border/50 rounded">↑↓</kbd>
										選択
									</span>
									<span className="flex items-center gap-1">
										<kbd className="px-1.5 py-0.5 bg-muted/30 border border-border/50 rounded">Enter</kbd>
										開く
									</span>
									<span className="flex items-center gap-1">
										<kbd className="px-1.5 py-0.5 bg-muted/30 border border-border/50 rounded">Ctrl+Enter</kbd>
										反対ペインに開く
									</span>
								</div>
							</div>
						)}

						{results.map((node, index) => {
							return (
								<div
									key={node.id}
									className={cn(
										'px-4 py-3 cursor-pointer border-b border-border/30 last:border-0 transition-all duration-100',
										index === selectedIndex ? 'bg-accent/80 shadow-sm' : 'hover:bg-accent/40 active:bg-accent/60'
									)}
									onClick={() => {
										openNote(node.id, focusedPane);
										onClose();
									}}
									onMouseEnter={() => setSelectedIndex(index)}
								>
									<div className="flex items-start justify-between gap-3">
										<div className="flex items-start gap-2.5 flex-1 min-w-0">
											<FileText className={cn('w-4 h-4 flex-shrink-0 mt-0.5', index === selectedIndex ? 'opacity-70' : 'opacity-40')} />
											<div className="flex-1 min-w-0">
												<div className="font-medium text-sm truncate">{node.title}</div>
												{node.snippet && (
													<div
														className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed prose-strong:text-primary prose-strong:font-bold"
														dangerouslySetInnerHTML={{ __html: node.snippet }}
													/>
												)}
											</div>
										</div>
										{index === selectedIndex && (
											<div className="flex items-center gap-1.5 flex-shrink-0">
												<kbd className="px-1.5 py-0.5 text-xs bg-muted/50 border border-border rounded font-mono">Enter</kbd>
											</div>
										)}
									</div>
								</div>
							);
						})}
					</div>

					{results.length > 0 && (
						<div className="px-4 py-2.5 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
							<span>{results.length} 件の結果</span>
							<div className="flex items-center gap-3">
								<span className="flex items-center gap-1">
									<kbd className="px-1.5 py-0.5 bg-background/50 border border-border rounded">Ctrl+Enter</kbd>
									反対ペインに開く
								</span>
							</div>
						</div>
					)}
				</div>
			</div>
		</>
	);
}
