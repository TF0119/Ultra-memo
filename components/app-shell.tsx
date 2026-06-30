'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { TreeSidebar } from './tree-sidebar';
import { EditorWorkspace } from './editor-workspace';
import { QuickSwitcher } from './quick-switcher';
import { CommandPalette } from './command-palette';
import { SidebarHeader } from './sidebar-header';
import { useNoteStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { loadSidebarWidth, saveSidebarWidth, loadSplitMode, saveSplitMode } from '@/lib/preferences';

export function AppShell() {
	const [isQuickSwitcherOpen, setIsQuickSwitcherOpen] = useState(false);
	const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
	const sidebarWidthRef = useRef(sidebarWidth);
	sidebarWidthRef.current = sidebarWidth;
	const [splitMode, setSplitModeState] = useState<'single' | 'split'>(loadSplitMode);
	const {
		isInitialized,
		initError,
		initialize,
		selectedNodeId,
		activeNodeIds,
		focusedPane,
		openNote,
		createSibling,
		createChild,
		quickCapture,
		isZenMode,
		toggleZenMode,
		isCommandPaletteOpen,
		setCommandPaletteOpen,
		setEditingNodeId,
		expandAll,
		collapseAll,
		goBack,
		goForward,
		setFocusedPane,
		triggerEditorFocus,
	} = useNoteStore();

	const modalOpen = isQuickSwitcherOpen || isCommandPaletteOpen;

	useEffect(() => {
		if (!isInitialized && !initError) initialize();
	}, [isInitialized, initError, initialize]);

	useEffect(() => {
		let unlisten: (() => void) | undefined;
		void getCurrentWindow()
			.onCloseRequested(async (event) => {
				event.preventDefault();
				await useNoteStore.getState().flushAllAndWait();
				await getCurrentWindow().destroy();
			})
			.then((fn) => {
				unlisten = fn;
			})
			.catch(() => {
				/* browser / non-Tauri */
			});
		return () => {
			unlisten?.();
		};
	}, []);

	const setSplitMode = useCallback((mode: 'single' | 'split') => {
		if (mode === 'single') {
			useNoteStore.getState().flushEditorSave(2);
		}
		setSplitModeState(mode);
		saveSplitMode(mode);
	}, []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			const inEditor = target?.closest('.cm-editor');
			const inInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

			if (modalOpen && e.key !== 'Escape') return;

			if (e.key === 'F2' && selectedNodeId && !inInput && !modalOpen) {
				e.preventDefault();
				setEditingNodeId(selectedNodeId);
				return;
			}

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

			if (e.ctrlKey && !e.shiftKey && (e.key === 'n' || e.key === 'N')) {
				// Works even while typing in the editor — Ctrl+N is "new note".
				e.preventDefault();
				if (selectedNodeId) createSibling(selectedNodeId);
				else createChild(null);
			}

			if (e.ctrlKey && e.shiftKey && e.key === 'N') {
				e.preventDefault();
				const parentId = selectedNodeId ?? activeNodeIds[focusedPane] ?? null;
				createChild(parentId);
			}

			if (e.ctrlKey && e.key === '1') {
				e.preventDefault();
				setFocusedPane(1);
			}

			if (e.ctrlKey && e.key === '2') {
				e.preventDefault();
				setFocusedPane(2);
			}

			if (e.altKey && e.key === 'ArrowLeft' && !inInput && !modalOpen) {
				e.preventDefault();
				goBack();
			}

			if (e.altKey && e.key === 'ArrowRight' && !inInput && !modalOpen) {
				e.preventDefault();
				goForward();
			}

			const inTree = target?.closest('[data-tree-sidebar]');
			if (e.key === 'Enter' && !e.repeat && !e.ctrlKey && selectedNodeId && !inEditor && !inInput && !inTree && !modalOpen) {
				e.preventDefault();
				openNote(selectedNodeId, focusedPane);
				triggerEditorFocus();
			}

			if (e.ctrlKey && e.key === 'Enter' && !e.repeat && selectedNodeId && !inEditor && !inInput && !modalOpen) {
				e.preventDefault();
				const targetPane = splitMode === 'split' ? ((focusedPane === 1 ? 2 : 1) as 1 | 2) : focusedPane;
				openNote(selectedNodeId, targetPane);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [
		selectedNodeId,
		activeNodeIds,
		createSibling,
		createChild,
		quickCapture,
		focusedPane,
		openNote,
		splitMode,
		setEditingNodeId,
		modalOpen,
		isQuickSwitcherOpen,
		isCommandPaletteOpen,
		toggleZenMode,
		expandAll,
		collapseAll,
		setCommandPaletteOpen,
		goBack,
		goForward,
		setFocusedPane,
		triggerEditorFocus,
	]);

	useEffect(() => {
		const handleAuxClick = (e: MouseEvent) => {
			if (e.button !== 3 && e.button !== 4) return;
			if (modalOpen) return;
			const target = e.target as HTMLElement;
			if (target?.closest('.cm-editor') || target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
			e.preventDefault();
			if (e.button === 3) goBack();
			else goForward();
		};
		window.addEventListener('auxclick', handleAuxClick);
		return () => window.removeEventListener('auxclick', handleAuxClick);
	}, [modalOpen, goBack, goForward]);

	const handleResize = useCallback((e: MouseEvent) => {
		const newWidth = e.clientX;
		if (newWidth >= 200 && newWidth <= 500) {
			setSidebarWidth(newWidth);
			sidebarWidthRef.current = newWidth;
		}
	}, []);

	const handleMouseUp = useCallback(() => {
		document.removeEventListener('mousemove', handleResize);
		document.removeEventListener('mouseup', handleMouseUp);
		saveSidebarWidth(sidebarWidthRef.current);
	}, [handleResize]);

	const handleMouseDown = () => {
		document.addEventListener('mousemove', handleResize);
		document.addEventListener('mouseup', handleMouseUp);
	};

	if (initError && !isInitialized) {
		return (
			<div className="h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground px-6">
				<p className="text-sm text-muted-foreground">{initError}</p>
				<button
					type="button"
					onClick={() => initialize()}
					className="text-xs px-4 py-2 rounded border border-border hover:bg-muted/30 transition-colors"
				>
					再試行
				</button>
			</div>
		);
	}

	return (
		<div className={cn('h-screen flex flex-col overflow-hidden bg-background antialiased', isZenMode && 'zen-mode')}>
			<div className="flex-1 flex overflow-hidden">
				{!isZenMode && (
					<>
						<div className="flex-shrink-0 flex flex-col border-r border-border" style={{ width: `${sidebarWidth}px` }}>
							<SidebarHeader splitMode={splitMode} setSplitMode={setSplitMode} />
							<div className="flex-1 overflow-hidden">
								<TreeSidebar splitMode={splitMode} />
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
