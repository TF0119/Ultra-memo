'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useNoteStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { FileText } from 'lucide-react';
import { StatusIndicator } from './status-indicator';
import { MarkdownToggle } from './markdown-toggle';
import { BacklinksPanel } from './backlinks-panel';
import { wikiLinkPlugin, wikiLinkAutocomplete, checkboxClickHandler, toggleCheckboxLine } from '@/lib/codemirror-extensions';
import { imeCompositionGuard } from '@/lib/editor-composition';
import { markdownContinueKeymap } from '@/lib/editor-markdown-keys';
import { editorPlaceholder } from '@/lib/editor-placeholder';
import { openSearchPanel } from '@codemirror/search';

// CodeMirror imports
import {
	EditorView,
	keymap,
	highlightSpecialChars,
	drawSelection,
	dropCursor,
	rectangularSelection,
	highlightActiveLine,
	scrollPastEnd,
	Decoration,
	DecorationSet,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from '@codemirror/view';
import { EditorState, RangeSetBuilder } from '@codemirror/state';
import { indentWithTab, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle, HighlightStyle } from '@codemirror/language';
import { search, searchKeymap } from '@codemirror/search';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { syntaxTree } from '@codemirror/language';

interface EditorPaneProps {
	paneId: 1 | 2;
}

export function EditorPane({ paneId }: EditorPaneProps) {
	const { treeNodes, activeNodeIds, focusedPane, noteContents, loadingNoteIds, updateNoteContent, patchLocalContent, setFocusedPane, setSaveStatus, openNote, openWikiLink, isSyncScrollEnabled, syncScrollRatio, syncScrollSource, setSyncScrollRatio, isZenMode } =
		useNoteStore();

	const activeNodeId = activeNodeIds[paneId];
	const activeNode = treeNodes.find((n) => n.id === activeNodeId);
	const isFocused = focusedPane === paneId;
	const content = activeNodeId ? (noteContents[activeNodeId] ?? '') : '';
	const isLoading = activeNodeId ? loadingNoteIds.has(activeNodeId) && noteContents[activeNodeId] === undefined : false;

	const getBreadcrumb = (nodeId: string): { id: string; title: string }[] => {
		const path: { id: string; title: string }[] = [];
		let currentId: string | null = nodeId;

		while (currentId) {
			const node = treeNodes.find((n) => n.id === currentId);
			if (!node) break;
			path.unshift({ id: node.id, title: node.title });
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
			<div className="px-8 pt-5 pb-3 flex items-center justify-between text-[11px] flex-shrink-0 min-h-[44px]">
				<div className="flex items-center gap-1.5 text-muted-foreground/40 font-medium tracking-tight h-4">
					{breadcrumb.map((item, index) => (
						<span key={item.id} className="flex items-center gap-1.5">
							{index > 0 && <span className="opacity-30">/</span>}
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									openNote(item.id, paneId, false);
								}}
								className={cn(
									'hover:text-foreground transition-colors',
									index === breadcrumb.length - 1 ? 'text-muted-foreground/70' : 'opacity-40 hover:opacity-70'
								)}
							>
								{item.title}
							</button>
						</span>
					))}
				</div>
				<div className="flex items-center gap-2">
					{activeNode && <MarkdownToggle nodeId={activeNode.id} isMarkdownView={activeNode.isMarkdownView} />}
					<StatusIndicator />
				</div>
			</div>

			<BacklinksPanel paneId={paneId} />

			<div className="flex-1 relative overflow-hidden">
				{isLoading ? (
					<div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 bg-black">
						<div className="w-5 h-5 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
						<span className="text-xs opacity-50">読み込み中...</span>
					</div>
				) : activeNode ? (
					<CodeMirrorEditor
						key={activeNode.id}
						activeNodeId={activeNode.id}
						paneId={paneId}
						content={content}
						isMarkdownView={activeNode.isMarkdownView}
						isSyncScrollEnabled={isSyncScrollEnabled}
						syncScrollRatio={syncScrollRatio}
						syncScrollSource={syncScrollSource}
						onScrollSync={setSyncScrollRatio}
						onWikiNavigate={(title) => openWikiLink(title, paneId)}
						getNoteTitles={() => treeNodes.map((n) => n.title)}
						isZenMode={isZenMode}
						onSave={(c) => {
							setSaveStatus('saving');
							updateNoteContent(activeNode.id, content).then(() => {
								setSaveStatus('saved');
							});
						}}
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

function CodeMirrorEditor({
	content,
	onSave,
	onFocus,
	isFocused,
	activeNodeId,
	paneId,
	isMarkdownView,
	isSyncScrollEnabled,
	syncScrollRatio,
	syncScrollSource,
	onScrollSync,
	onWikiNavigate,
	getNoteTitles,
	isZenMode,
}: {
	content: string;
	onSave: (c: string) => void;
	onFocus: () => void;
	isFocused: boolean;
	activeNodeId: string;
	paneId: 1 | 2;
	isMarkdownView: boolean;
	isSyncScrollEnabled: boolean;
	syncScrollRatio: number;
	syncScrollSource: 1 | 2 | null;
	onScrollSync: (ratio: number, source: 1 | 2) => void;
	onWikiNavigate: (title: string) => void;
	getNoteTitles: () => string[];
	isZenMode: boolean;
}) {
	const { focusTarget } = useNoteStore();
	const consumedTriggerRef = useRef(focusTarget.trigger);
	const editorRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);
	const [isDirty, setIsDirty] = useState(false);
	const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const isSyncingRef = useRef(false);

	// WYSIWYG Markdown decorations plugin
	const wysiwygPlugin = useMemo(() => {
		return ViewPlugin.fromClass(
			class {
				decorations: DecorationSet;

				constructor(view: EditorView) {
					this.decorations = this.buildDecorations(view);
				}

				update(update: ViewUpdate) {
					if (update.docChanged || update.viewportChanged) {
						this.decorations = this.buildDecorations(update.view);
					}
				}

				buildDecorations(view: EditorView): DecorationSet {
					const builder = new RangeSetBuilder<Decoration>();
					const doc = view.state.doc;

					for (let i = 1; i <= doc.lines; i++) {
						const line = doc.line(i);
						const text = line.text;

						// Headings: # ## ### etc.
						const headingMatch = text.match(/^(#{1,6})\s+/);
						if (headingMatch) {
							const level = headingMatch[1].length;
							const markerEnd = line.from + headingMatch[0].length;

							// Hide the # markers
							builder.add(line.from, markerEnd, Decoration.replace({}));

							// Style the heading text
							const headingClass = `cm-heading-${level}`;
							builder.add(markerEnd, line.to, Decoration.mark({ class: headingClass }));
							continue;
						}

						// Checkbox: - [ ] or - [x]
						const cbMatch = text.match(/^(\s*)- \[([ xX])\] /);
						if (cbMatch) {
							const checked = cbMatch[2].toLowerCase() === 'x';
							const indentLength = cbMatch[1].length;
							const markerStart = line.from + indentLength;
							const markerEnd = line.from + cbMatch[0].length;
							builder.add(
								markerStart,
								markerEnd,
								Decoration.replace({
									widget: new CheckboxWidget(checked),
								})
							);
							continue;
						}

						// Unordered list: - or * or +
						const ulMatch = text.match(/^(\s*)([-*+])\s+/);
						if (ulMatch) {
							const indentLength = ulMatch[1].length;
							const markerStart = line.from + indentLength;
							const markerEnd = line.from + ulMatch[0].length;

							// Replace - with bullet
							builder.add(
								markerStart,
								markerEnd,
								Decoration.replace({
									widget: new BulletWidget(),
								})
							);
							continue;
						}

						// Ordered list: 1. 2. etc.
						const olMatch = text.match(/^(\s*)(\d+)\.\s+/);
						if (olMatch) {
							const indentLength = olMatch[1].length;
							const number = olMatch[2];
							const markerStart = line.from + indentLength;
							const markerEnd = line.from + olMatch[0].length;

							builder.add(
								markerStart,
								markerEnd,
								Decoration.replace({
									widget: new NumberWidget(number),
								})
							);
							continue;
						}

						// Code block fence
						if (text.match(/^```/)) {
							builder.add(
								line.from,
								line.to,
								Decoration.replace({
									widget: new CodeFenceWidget(),
								})
							);
							continue;
						}

						// Inline styles: **bold**, *italic*, `code`
						let pos = 0;
						const inlineDecorations: Array<{ from: number; to: number; deco: Decoration }> = [];

						// Bold: **text**
						const boldRegex = /\*\*([^*]+)\*\*/g;
						let match;
						while ((match = boldRegex.exec(text)) !== null) {
							const start = line.from + match.index;
							const end = start + match[0].length;
							// Hide opening **
							inlineDecorations.push({ from: start, to: start + 2, deco: Decoration.replace({}) });
							// Style content
							inlineDecorations.push({ from: start + 2, to: end - 2, deco: Decoration.mark({ class: 'cm-bold' }) });
							// Hide closing **
							inlineDecorations.push({ from: end - 2, to: end, deco: Decoration.replace({}) });
						}

						// Italic: *text*
						const italicRegex = /(?<!\*)\*([^*]+)\*(?!\*)/g;
						while ((match = italicRegex.exec(text)) !== null) {
							const start = line.from + match.index;
							const end = start + match[0].length;
							inlineDecorations.push({ from: start, to: start + 1, deco: Decoration.replace({}) });
							inlineDecorations.push({ from: start + 1, to: end - 1, deco: Decoration.mark({ class: 'cm-italic' }) });
							inlineDecorations.push({ from: end - 1, to: end, deco: Decoration.replace({}) });
						}

						// Inline code: `code`
						const codeRegex = /`([^`]+)`/g;
						while ((match = codeRegex.exec(text)) !== null) {
							const start = line.from + match.index;
							const end = start + match[0].length;
							inlineDecorations.push({ from: start, to: start + 1, deco: Decoration.replace({}) });
							inlineDecorations.push({ from: start + 1, to: end - 1, deco: Decoration.mark({ class: 'cm-inline-code' }) });
							inlineDecorations.push({ from: end - 1, to: end, deco: Decoration.replace({}) });
						}

						// Sort by position and add to builder
						inlineDecorations.sort((a, b) => a.from - b.from);
						for (const d of inlineDecorations) {
							builder.add(d.from, d.to, d.deco);
						}
					}

					return builder.finish();
				}
			},
			{
				decorations: (v) => v.decorations,
			}
		);
	}, []);

	// WYSIWYG theme styles
	const wysiwygTheme = useMemo(() => {
		return EditorView.theme(
			{
				'.cm-heading-1': { fontSize: '2em', fontWeight: '700', lineHeight: '1.3' },
				'.cm-heading-2': { fontSize: '1.5em', fontWeight: '600', lineHeight: '1.3' },
				'.cm-heading-3': { fontSize: '1.25em', fontWeight: '600', lineHeight: '1.4' },
				'.cm-heading-4': { fontSize: '1.1em', fontWeight: '600', lineHeight: '1.4' },
				'.cm-heading-5': { fontSize: '1em', fontWeight: '600', lineHeight: '1.4' },
				'.cm-heading-6': { fontSize: '0.9em', fontWeight: '600', lineHeight: '1.4', color: '#888' },
				'.cm-bold': { fontWeight: '700' },
				'.cm-italic': { fontStyle: 'italic' },
				'.cm-inline-code': {
					backgroundColor: 'rgba(255,255,255,0.1)',
					padding: '0.1em 0.4em',
					borderRadius: '4px',
					fontFamily: 'var(--font-mono)',
					fontSize: '0.9em',
				},
				'.cm-bullet': {
					display: 'inline-block',
					width: '1.5em',
					color: '#888',
				},
				'.cm-number-marker': {
					display: 'inline-block',
					width: '1.5em',
					color: '#888',
					fontWeight: '500',
				},
				'.cm-code-fence': {
					display: 'block',
					height: '1px',
					backgroundColor: 'rgba(255,255,255,0.1)',
					margin: '0.5em 0',
				},
			},
			{ dark: true }
		);
	}, []);

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

		const extensions = [
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
			search({ top: true }),
			markdownContinueKeymap(),
			editorPlaceholder(),
			wikiLinkPlugin(onWikiNavigate, (t) => getNoteTitles().some((n) => n.toLowerCase() === t.toLowerCase())),
			wikiLinkAutocomplete(getNoteTitles),
			checkboxClickHandler((lineNum, checked) => {
				const view = viewRef.current;
				if (!view) return;
				const newDoc = toggleCheckboxLine(view.state.doc.toString(), lineNum, checked);
				view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: newDoc } });
				setIsDirty(true);
			}),
			keymap.of([
				...historyKeymap,
				...searchKeymap,
				...completionKeymap,
				indentWithTab,
				{
					key: 'Mod-f',
					run: (view) => {
						openSearchPanel(view);
						return true;
					},
				},
			]),
			...imeCompositionGuard((doc) => {
				setIsDirty(true);
				useNoteStore.getState().patchLocalContent(activeNodeId, doc);
			}),
		];

		// Add WYSIWYG extensions when markdown view is enabled
		if (isMarkdownView) {
			extensions.push(wysiwygPlugin, wysiwygTheme);
		}

		const state = EditorState.create({
			doc: content,
			extensions,
		});

		const view = new EditorView({
			state,
			parent: editorRef.current,
		});

		viewRef.current = view;

		const handleScroll = () => {
			if (!isSyncScrollEnabled || isSyncingRef.current) return;
			const scroller = view.scrollDOM;
			const maxScroll = scroller.scrollHeight - scroller.clientHeight;
			if (maxScroll <= 0) return;
			onScrollSync(scroller.scrollTop / maxScroll, paneId);
		};
		view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true });

		return () => {
			view.scrollDOM.removeEventListener('scroll', handleScroll);
			view.destroy();
		};
	}, [isMarkdownView, isSyncScrollEnabled, onScrollSync, paneId, onWikiNavigate, getNoteTitles]);

	// Apply synced scroll from the other pane
	useEffect(() => {
		if (!isSyncScrollEnabled || syncScrollSource === paneId || syncScrollSource === null) return;
		const view = viewRef.current;
		if (!view) return;
		const scroller = view.scrollDOM;
		const maxScroll = scroller.scrollHeight - scroller.clientHeight;
		if (maxScroll <= 0) return;
		isSyncingRef.current = true;
		scroller.scrollTop = syncScrollRatio * maxScroll;
		requestAnimationFrame(() => {
			isSyncingRef.current = false;
		});
	}, [syncScrollRatio, syncScrollSource, isSyncScrollEnabled, paneId]);

	// Focus effect: place cursor at end and focus editor
	useEffect(() => {
		if (isFocused && viewRef.current && focusTarget.nodeId === activeNodeId && focusTarget.paneId === paneId) {
			if (focusTarget.trigger > consumedTriggerRef.current) {
				const view = viewRef.current;
				const end = view.state.doc.length;
				view.dispatch({ selection: { anchor: end, head: end } });
				view.focus();
				consumedTriggerRef.current = focusTarget.trigger;
			}
		}
	}, [isFocused, focusTarget, activeNodeId, paneId]);

	// On mount with empty new note, cursor at end
	useEffect(() => {
		if (viewRef.current && content === '') {
			const view = viewRef.current;
			const end = view.state.doc.length;
			view.dispatch({ selection: { anchor: end, head: end } });
		}
	}, [activeNodeId]);

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

// Widget classes for WYSIWYG rendering
class BulletWidget extends WidgetType {
	toDOM() {
		const span = document.createElement('span');
		span.className = 'cm-bullet';
		span.textContent = '• ';
		return span;
	}
}

class NumberWidget extends WidgetType {
	constructor(private num: string) {
		super();
	}
	toDOM() {
		const span = document.createElement('span');
		span.className = 'cm-number-marker';
		span.textContent = `${this.num}. `;
		return span;
	}
}

class CheckboxWidget extends WidgetType {
	constructor(private checked: boolean) {
		super();
	}
	toDOM() {
		const span = document.createElement('span');
		span.className = 'cm-checkbox-marker';
		span.textContent = this.checked ? '☑ ' : '☐ ';
		span.style.cssText = 'cursor:pointer;user-select:none';
		return span;
	}
}

class CodeFenceWidget extends WidgetType {
	toDOM() {
		const div = document.createElement('div');
		div.className = 'cm-code-fence';
		return div;
	}
}
