'use client';

import { useState, useEffect, useCallback } from 'react';
import { TreeSidebar } from './tree-sidebar';
import { EditorWorkspace } from './editor-workspace';
import { QuickSwitcher } from './quick-switcher';
import { SidebarHeader } from './sidebar-header';
import { useNoteStore } from '@/lib/store';
import { Button } from './ui/button';
import { Columns2, Maximize2 } from 'lucide-react';

export function AppShell() {
	const [isQuickSwitcherOpen, setIsQuickSwitcherOpen] = useState(false);
	const [sidebarWidth, setSidebarWidth] = useState(280);
	const [splitMode, setSplitMode] = useState<'single' | 'split'>('single');
	const { isInitialized, initialize, selectedNodeId, activeNodeIds, focusedPane, openNote, createSibling, createChild } = useNoteStore();

	// Initialization
	useEffect(() => {
		if (!isInitialized) {
			initialize();
		}
	}, [isInitialized, initialize]);

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ctrl+P: Quick Switcher
			if (e.ctrlKey && e.key === 'p') {
				e.preventDefault();
				setIsQuickSwitcherOpen(true);
			}

			// Ctrl+N: Create sibling note (or root if nothing selected)
			if (e.ctrlKey && !e.shiftKey && e.key === 'n') {
				e.preventDefault();
				if (selectedNodeId) {
					createSibling(selectedNodeId);
				} else {
					createChild(null);
				}
			}

			// Ctrl+Shift+N: Create child note (or root if nothing selected)
			if (e.ctrlKey && e.shiftKey && e.key === 'N') {
				e.preventDefault();
				createChild(selectedNodeId); // if null, it creates root
			}

			// Ctrl+1: Focus pane 1
			if (e.ctrlKey && e.key === '1') {
				e.preventDefault();
				useNoteStore.setState({ focusedPane: 1 });
			}

			// Ctrl+2: Focus pane 2
			if (e.ctrlKey && e.key === '2') {
				e.preventDefault();
				useNoteStore.setState({ focusedPane: 2 });
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [selectedNodeId, createSibling, createChild]);

	const handleResize = useCallback((e: MouseEvent) => {
		const newWidth = e.clientX;
		if (newWidth >= 200 && newWidth <= 500) {
			setSidebarWidth(newWidth);
		}
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
		<div className="h-screen flex flex-col overflow-hidden bg-background antialiased">
			<div className="flex-1 flex overflow-hidden">
				{/* Tree Sidebar */}
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
					<div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-transparent group-hover:bg-foreground/10 group-active:bg-foreground/20 transition-colors" />
				</div>

				{/* Editor Workspace */}
				<div className="flex-1 overflow-hidden">
					<EditorWorkspace splitMode={splitMode} setSplitMode={setSplitMode} />
				</div>
			</div>

			{/* Quick Switcher Modal */}
			<QuickSwitcher isOpen={isQuickSwitcherOpen} onClose={() => setIsQuickSwitcherOpen(false)} />
		</div>
	);
}
