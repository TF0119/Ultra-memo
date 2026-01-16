'use client';

import { useEffect, useRef, useState } from 'react';
import { useNoteStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { FileText } from 'lucide-react';

// CodeMirror imports
import { EditorView, keymap, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, highlightActiveLine, scrollPastEnd } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { indentWithTab, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { search, searchKeymap } from '@codemirror/search';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';

interface EditorPaneProps {
	paneId: 1 | 2;
}

export function EditorPane({ paneId }: EditorPaneProps) {
	const { treeNodes, activeNodeIds, focusedPane, updateNoteContent, setFocusedPane } = useNoteStore();

	const activeNodeId = activeNodeIds[paneId];
	const activeNode = treeNodes.find((n) => n.id === activeNodeId);
	const isFocused = focusedPane === paneId;

	const getBreadcrumb = (nodeId: string): string[] => {
		const path: string[] = [];
		let currentId: string | null = nodeId;

		while (currentId) {
			const node = treeNodes.find((n) => n.id === currentId);
			if (!node) break;
			path.unshift(node.title);
			currentId = node.parentId;
		}

		return path;
	};

	const breadcrumb = activeNode ? getBreadcrumb(activeNode.id) : [];

	return (
		<div
			className={cn('h-full flex flex-col transition-all duration-150 relative', isFocused ? 'ring-1 ring-inset ring-foreground/[0.08] bg-background' : 'bg-muted/20')}
			onClick={() => setFocusedPane(paneId)}
		>
			<div className="px-8 pt-5 pb-3 flex items-center justify-between text-[11px] flex-shrink-0">
				<div className="flex items-center gap-1.5 text-muted-foreground/40 font-medium tracking-tight h-4">
					{breadcrumb.map((item, index) => (
						<span key={index} className="flex items-center gap-1.5">
							{index > 0 && <span className="opacity-30">/</span>}
							<span className={index === breadcrumb.length - 1 ? 'text-muted-foreground/70' : 'opacity-40'}>{item}</span>
						</span>
					))}
				</div>
			</div>

			<div className="flex-1 relative overflow-hidden">
				{activeNode ? (
					<CodeMirrorEditor
						key={activeNode.id}
						content={activeNode.content}
						onSave={(content) => updateNoteContent(activeNode.id, content)}
						onFocus={() => setFocusedPane(paneId)}
						isFocused={isFocused}
					/>
				) : (
					<div className="h-full flex items-center justify-center text-muted-foreground bg-card/10">
						<div className="text-center space-y-4 px-8">
							<FileText className="w-14 h-14 mx-auto opacity-[0.08]" strokeWidth={1.5} />
							<div>
								<p className="text-sm font-medium tracking-tight">ノートが選択されていません</p>
								<p className="text-xs mt-1.5 opacity-50 font-normal">ツリーからノートを開いてください</p>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function CodeMirrorEditor({ content, onSave, onFocus, isFocused }: { content: string; onSave: (c: string) => void; onFocus: () => void; isFocused: boolean }) {
	const editorRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);
	const [isDirty, setIsDirty] = useState(false);
	const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		if (!editorRef.current) return;

		const themeConfig = EditorView.theme(
			{
				'&': {
					height: '100%',
					fontSize: '14px',
					backgroundColor: '#000000',
					color: '#ffffff',
				},
				'.cm-content': {
					padding: '2rem',
					fontFamily: 'var(--font-mono)',
					lineHeight: '1.6',
					caretColor: '#ffffff',
				},
				'.cm-scroller': {
					fontFamily: 'var(--font-mono)',
					overflow: 'auto',
				},
				'&.cm-focused': {
					outline: 'none',
				},
				'.cm-gutters': {
					backgroundColor: '#000000',
					border: 'none',
					color: '#444444',
					opacity: '0.8',
				},
				'.cm-activeLine': {
					backgroundColor: '#111111',
				},
				'.cm-selectionBackground, ::selection': {
					backgroundColor: '#333333 !important',
				},
			},
			{ dark: true }
		);

		const state = EditorState.create({
			doc: content,
			extensions: [
				history(),
				drawSelection(),
				dropCursor(),
				EditorState.allowMultipleSelections.of(true),
				indentOnInput(),
				bracketMatching(),
				autocompletion(),
				rectangularSelection(),
				highlightActiveLine(),
				highlightSpecialChars(),
				scrollPastEnd(),
				markdown(),
				themeConfig,
				search(),
				keymap.of([...historyKeymap, ...searchKeymap, ...completionKeymap, indentWithTab]),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						setIsDirty(true);
					}
				}),
			],
		});

		const view = new EditorView({
			state,
			parent: editorRef.current,
		});

		viewRef.current = view;

		if (isFocused) {
			view.focus();
		}

		return () => {
			view.destroy();
		};
	}, []); // Initialize once per key (node.id)

	// Focus effect
	useEffect(() => {
		if (isFocused && viewRef.current) {
			viewRef.current.focus();
		}
	}, [isFocused]);

	// Save effect
	useEffect(() => {
		if (isDirty && viewRef.current) {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}

			const contentToSave = viewRef.current.state.doc.toString();
			saveTimeoutRef.current = setTimeout(() => {
				onSave(contentToSave);
				setIsDirty(false);
			}, 500);
		}

		return () => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}
		};
	}, [isDirty, onSave]);

	return <div ref={editorRef} className="h-full w-full" onFocus={onFocus} />;
}
