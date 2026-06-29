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
				e.preventDefault();
				if (selectedNodeId) createSibling(selectedNodeId);
				else createChild(null);
			}

			if (e.ctrlKey && e.shiftKey && e.key === 'N') {
				e.preventDefault();
				createChild(selectedNodeId);
			}

			if (e.ctrlKey && e.key === '1') {
				e.preventDefault();
				useNoteStore.setState({ focusedPane: 1 });
			}

			if (e.ctrlKey && e.key === '2') {
				e.preventDefault();
				useNoteStore.setState({ focusedPane: 2 });
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
						<button
							type="button"
							onClick={() => toggleZenMode()}
							className="absolute top-3 right-4 text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors z-10"
						>
							Zen終了 (F11)
						</button>
					)}
				</div>
			</div>

			<QuickSwitcher isOpen={isQuickSwitcherOpen} onClose={() => setIsQuickSwitcherOpen(false)} />
			<CommandPalette
				isOpen={isCommandPaletteOpen}
				onClose={() => setCommandPaletteOpen(false)}
				splitMode={splitMode}
				setSplitMode={setSplitMode}
			/>
		</div>
	);
}
