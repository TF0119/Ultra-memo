'use client';

import { useState, useEffect, useCallback } from 'react';
import { TreeSidebar } from './tree-sidebar';
import { EditorWorkspace } from './editor-workspace';
import { QuickSwitcher } from './quick-switcher';
import { CommandPalette } from './command-palette';
import { SidebarHeader } from './sidebar-header';
import { useNoteStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function AppShell() {
	const [isQuickSwitcherOpen, setIsQuickSwitcherOpen] = useState(false);
	const [sidebarWidth, setSidebarWidth] = useState(280);
	const [splitMode, setSplitMode] = useState<'single' | 'split'>('single');
	const {
		isInitialized,
		initialize,
		selectedNodeId,
		focusedPane,
		openNote,
		createSibling,
		createChild,
		quickCapture,
		isZenMode,
		toggleZenMode,
		isCommandPaletteOpen,
		setCommandPaletteOpen,
		expandAll,
		collapseAll,
		goBack,
		goForward,
		setFocusedPane,
	} = useNoteStore();

	useEffect(() => {
		if (!isInitialized) initialize();
	}, [isInitialized, initialize]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			const inEditor = target?.closest('.cm-editor');
			const inInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

			if (e.ctrlKey && e.shiftKey && e.key === 'P') {
				e.preventDefault();
				setCommandPaletteOpen(true);
				return;
			}

			if (e.ctrlKey && e.shiftKey && (e.key === 'm' || e.key === 'M')) {
				if (inEditor) return;
				e.preventDefault();
				quickCapture();
				return;
			}

			if (e.key === 'F11') {
				e.preventDefault();
				toggleZenMode();
				return;
			}

			if (e.ctrlKey && e.shiftKey && e.key === ']') {
				e.preventDefault();
				expandAll();
				return;
			}

			if (e.ctrlKey && e.shiftKey && e.key === '[') {
				e.preventDefault();
				collapseAll();
				return;
			}

			if (e.ctrlKey && e.key === 'p') {
				e.preventDefault();
				setIsQuickSwitcherOpen(true);
			}

			if (e.ctrlKey && !e.shiftKey && e.key === 'n') {
				if (inEditor) return;
				e.preventDefault();
				if (selectedNodeId) createSibling(selectedNodeId);
				else createChild(null);
			}

			if (e.ctrlKey && e.shiftKey && e.key === 'N') {
				if (inEditor) return;
				e.preventDefault();
				createChild(selectedNodeId);
			}

			if (e.ctrlKey && e.key === '1') {
				e.preventDefault();
				setFocusedPane(1);
			}

			if (e.ctrlKey && e.key === '2') {
				e.preventDefault();
				setFocusedPane(2);
			}

			if (e.altKey && e.key === 'ArrowLeft' && !inEditor && !inInput && !isQuickSwitcherOpen && !isCommandPaletteOpen) {
				e.preventDefault();
				goBack();
			}

			if (e.altKey && e.key === 'ArrowRight' && !inEditor && !inInput && !isQuickSwitcherOpen && !isCommandPaletteOpen) {
				e.preventDefault();
				goForward();
			}

			if (e.key === 'Enter' && !e.ctrlKey && selectedNodeId && !inEditor && !inInput && !isQuickSwitcherOpen && !isCommandPaletteOpen) {
				e.preventDefault();
				openNote(selectedNodeId, focusedPane);
			}

			if (e.ctrlKey && e.key === 'Enter' && selectedNodeId && !inEditor && !inInput && !isQuickSwitcherOpen && !isCommandPaletteOpen) {
				e.preventDefault();
				const targetPane = splitMode === 'split' ? ((focusedPane === 1 ? 2 : 1) as 1 | 2) : focusedPane;
				openNote(selectedNodeId, targetPane);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [
		selectedNodeId,
		createSibling,
		createChild,
		quickCapture,
		focusedPane,
		openNote,
		splitMode,
		isQuickSwitcherOpen,
		isCommandPaletteOpen,
		toggleZenMode,
		expandAll,
		collapseAll,
		setCommandPaletteOpen,
		goBack,
		goForward,
		setFocusedPane,
	]);

	const handleResize = useCallback((e: MouseEvent) => {
		const newWidth = e.clientX;
		if (newWidth >= 200 && newWidth <= 500) setSidebarWidth(newWidth);
	}, []);

	const handleMouseUp = useCallback(() => {
		document.removeEventListener('mousemove', handleResize);
		document.removeEventListener('mouseup', handleMouseUp);
	}, [handleResize]);

	const handleMouseDown = () => {
		document.addEventListener('mousemove', handleResize);
		document.addEventListener('mouseup', handleMouseUp);
	};

	return (
		<div className={cn('h-screen flex flex-col overflow-hidden bg-background antialiased', isZenMode && 'zen-mode')}>
			<div className="flex-1 flex overflow-hidden">
				{!isZenMode && (
					<>
						<div className="flex-shrink-0 flex flex-col border-r border-border" style={{ width: `${sidebarWidth}px` }}>
							<SidebarHeader splitMode={splitMode} setSplitMode={setSplitMode} />
							<div className="flex-1 overflow-hidden">
								<TreeSidebar />
							</div>
						</div>
						<div
							className="w-px cursor-col-resize bg-border hover:bg-foreground/20 active:bg-foreground/30 transition-all duration-150 flex-shrink-0 relative group"
							onMouseDown={handleMouseDown}
						>
							<div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-transparent group-hover:bg-foreground/10 transition-colors" />
						</div>
					</>
				)}

				<div className="flex-1 overflow-hidden relative">
					<EditorWorkspace splitMode={isZenMode ? 'single' : splitMode} setSplitMode={setSplitMode} />
					{isZenMode && (
						<div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-background/80 to-transparent pointer-events-none z-10 flex items-start justify-end px-4 pt-2 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
							<button
								type="button"
								onClick={() => toggleZenMode()}
								className="pointer-events-auto text-[10px] text-muted-foreground/60 hover:text-muted-foreground bg-background/60 backdrop-blur px-2 py-1 rounded border border-border/30 transition-colors"
							>
								Zen終了 · F11
							</button>
						</div>
					)}
				</div>
			</div>

			<QuickSwitcher isOpen={isQuickSwitcherOpen} onClose={() => setIsQuickSwitcherOpen(false)} />
			<CommandPalette
				isOpen={isCommandPaletteOpen}
				onClose={() => setCommandPaletteOpen(false)}
				onOpenSearch={() => {
					setCommandPaletteOpen(false);
					setIsQuickSwitcherOpen(true);
				}}
				splitMode={splitMode}
				setSplitMode={setSplitMode}
			/>
		</div>
	);
}
