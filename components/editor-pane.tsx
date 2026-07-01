'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNoteStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { FileText, Copy, Check, WrapText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { StatusIndicator } from './status-indicator';
import { MarkdownToggle } from './markdown-toggle';
import { BacklinksPanel } from './backlinks-panel';
import { wikiLinkPlugin, wikiLinkAutocomplete, checkboxClickHandler } from '@/lib/codemirror-extensions';
import { imeCompositionGuard } from '@/lib/editor-composition';
import { markdownContinueKeymap } from '@/lib/editor-markdown-keys';
import { markdownFormatKeymap } from '@/lib/editor-format-keys';
import { markdownAutoBullet } from '@/lib/editor-auto-input';
import { editorPlaceholder } from '@/lib/editor-placeholder';
import { typewriterScrollExtension } from '@/lib/editor-typewriter';
import { saveEditorSession, restoreEditorSession } from '@/lib/editor-session';
import {
	appendMarkdownInline,
	collectFencedCodeLineNumbers,
	collectMarkdownTableRanges,
	isMarkdownFenceLine,
	parseMarkdownLine,
	parseMarkdownTable,
	type MarkdownLineDecoration,
} from '@/lib/markdown-renderer';
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
import { EditorState, StateField, Compartment, type Range, type Text } from '@codemirror/state';
import { indentWithTab, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { search, searchKeymap } from '@codemirror/search';
import { completionKeymap } from '@codemirror/autocomplete';

interface EditorPaneProps {
	paneId: 1 | 2;
}

export function EditorPane({ paneId }: EditorPaneProps) {
	const activeNodeId = useNoteStore((s) => s.activeNodeIds[paneId]);
	const activeNode = useNoteStore((s) => (activeNodeId ? s.treeNodes.find((n) => n.id === activeNodeId) ?? null : null));
	const focusedPane = useNoteStore((s) => s.focusedPane);
	const content = useNoteStore((s) => (activeNodeId ? s.noteContents[activeNodeId] ?? '' : ''));
	const isLoading = useNoteStore(
		(s) => (activeNodeId ? s.loadingNoteIds.has(activeNodeId) && s.noteContents[activeNodeId] === undefined : false)
	);
	const loadFailed = useNoteStore((s) => (activeNodeId ? s.failedNoteIds.has(activeNodeId) : false));
	const isSyncScrollEnabled = useNoteStore((s) => s.isSyncScrollEnabled);
	const syncScrollRatio = useNoteStore((s) => s.syncScrollRatio);
	const syncScrollSource = useNoteStore((s) => s.syncScrollSource);
	const isZenMode = useNoteStore((s) => s.isZenMode);
	const isLineWrapEnabled = useNoteStore((s) => s.isLineWrapEnabled);
	const updateNoteContent = useNoteStore((s) => s.updateNoteContent);
	const setFocusedPane = useNoteStore((s) => s.setFocusedPane);
	const setSaveStatus = useNoteStore((s) => s.setSaveStatus);
	const openNote = useNoteStore((s) => s.openNote);
	const openWikiLink = useNoteStore((s) => s.openWikiLink);
	const retryLoadNote = useNoteStore((s) => s.retryLoadNote);
	const setSyncScrollRatio = useNoteStore((s) => s.setSyncScrollRatio);
	const toggleLineWrap = useNoteStore((s) => s.toggleLineWrap);

	const isFocused = focusedPane === paneId;

	// Live character count, reported by the editor on every doc change (incl. during
	// IME composition) so the header counter updates immediately, not just on save.
	const [liveCharCount, setLiveCharCount] = useState<number | null>(null);
	const handleCharCount = useCallback((n: number) => setLiveCharCount(n), []);
	useEffect(() => setLiveCharCount(null), [activeNodeId]);

	const [copied, setCopied] = useState(false);
	const handleCopyContent = useCallback(() => {
		if (!activeNodeId) return;
		const live = useNoteStore.getState().editorGetDocByPane[paneId]?.();
		const text = live ?? useNoteStore.getState().noteContents[activeNodeId] ?? content;
		void navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 1200);
	}, [activeNodeId, content, paneId]);

	const getBreadcrumb = (nodeId: string): { id: string; title: string }[] => {
		const nodes = useNoteStore.getState().treeNodes;
		const path: { id: string; title: string }[] = [];
		let currentId: string | null = nodeId;

		while (currentId) {
			const node = nodes.find((n) => n.id === currentId);
			if (!node) break;
			path.unshift({ id: node.id, title: node.title });
			currentId = node.parentId;
		}

		return path;
	};

	const breadcrumb = activeNode ? getBreadcrumb(activeNode.id) : [];

	// Stable callbacks — passing inline functions here makes CodeMirrorEditor's
	// view-creation effect re-run (and tear down/recreate the EditorView) on every
	// render, which can spin into an infinite update loop (React error #185).
	const handleWikiNavigate = useCallback(
		(title: string, openInOtherPane?: boolean) => {
			const targetPane = openInOtherPane ? ((paneId === 1 ? 2 : 1) as 1 | 2) : paneId;
			openWikiLink(title, targetPane);
		},
		[paneId, openWikiLink]
	);
	const getNoteTitles = useCallback(() => useNoteStore.getState().treeNodes.map((n) => n.title), []);

	return (
		<div
			className={cn('h-full flex flex-col transition-all duration-150 relative', isFocused ? 'ring-1 ring-inset ring-foreground/[0.08] bg-background' : 'bg-muted/20')}
			onClick={() => setFocusedPane(paneId)}
		>
			<div className={cn('px-8 pt-5 pb-3 flex items-center justify-between text-[11px] flex-shrink-0 min-h-[44px]', isZenMode && 'opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300 pt-3 pb-2 min-h-[36px]')}>
				<div className="flex items-center gap-1.5 text-muted-foreground/40 font-medium tracking-tight h-4">
					{breadcrumb.map((item, index) => (
						<span key={item.id} className="flex items-center gap-1.5">
							{index > 0 && <span className="opacity-30">/</span>}
							<button
								type="button"
								title={item.title}
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
					{activeNode && (() => {
						const count = liveCharCount ?? activeNode.contentLength;
						return count > 0 ? <span className="text-[10px] text-muted-foreground/35 tabular-nums">{count.toLocaleString()} 文字</span> : null;
					})()}
					{activeNode && (
						<motion.button
							type="button"
							onClick={(e) => { e.stopPropagation(); handleCopyContent(); }}
							whileTap={{ scale: 0.82 }}
							className={cn('relative flex items-center justify-center w-5 h-5 rounded transition-colors hover:bg-muted/50', copied ? 'text-emerald-500' : 'text-muted-foreground/40 hover:text-foreground')}
							title={copied ? 'コピーしました' : '本文をコピー'}
						>
							<AnimatePresence mode="wait" initial={false}>
								{copied ? (
									<motion.span
										key="check"
										initial={{ scale: 0, rotate: -40, opacity: 0 }}
										animate={{ scale: 1, rotate: 0, opacity: 1 }}
										exit={{ scale: 0, opacity: 0 }}
										transition={{ type: 'spring', stiffness: 600, damping: 16 }}
										className="absolute inset-0 flex items-center justify-center"
									>
										<Check className="w-3.5 h-3.5" strokeWidth={2.5} />
									</motion.span>
								) : (
									<motion.span
										key="copy"
										initial={{ scale: 0.6, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										exit={{ scale: 0.6, opacity: 0 }}
										transition={{ duration: 0.12 }}
										className="absolute inset-0 flex items-center justify-center"
									>
										<Copy className="w-3.5 h-3.5" strokeWidth={2} />
									</motion.span>
								)}
							</AnimatePresence>
							{copied && (
								<motion.span
									initial={{ scale: 0.5, opacity: 0.7 }}
									animate={{ scale: 2, opacity: 0 }}
									transition={{ duration: 0.55, ease: 'easeOut' }}
									className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-emerald-500/60"
								/>
							)}
						</motion.button>
					)}
					<button
						type="button"
						onClick={(e) => { e.stopPropagation(); toggleLineWrap(); }}
						className={cn('flex items-center justify-center w-5 h-5 rounded transition-colors hover:bg-muted/50', isLineWrapEnabled ? 'text-foreground' : 'text-muted-foreground/40 hover:text-foreground')}
						title={isLineWrapEnabled ? '折り返し: オン' : '折り返し: オフ'}
					>
						<WrapText className="w-3.5 h-3.5" strokeWidth={2} />
					</button>
					{activeNode && <MarkdownToggle nodeId={activeNode.id} isMarkdownView={activeNode.isMarkdownView} />}
					<StatusIndicator paneId={paneId} />
				</div>
			</div>

			<BacklinksPanel paneId={paneId} />

			<div className="flex-1 relative overflow-hidden">
				{loadFailed ? (
					<div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 bg-black">
						<p className="text-sm">読み込みに失敗しました</p>
						<button
							type="button"
							className="text-xs px-3 py-1.5 rounded border border-border/50 hover:bg-muted/30 transition-colors"
							onClick={() => activeNodeId && retryLoadNote(activeNodeId)}
						>
							再試行
						</button>
					</div>
				) : isLoading ? (
					<div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 bg-black">
						<div className="w-5 h-5 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
						<span className="text-xs opacity-50">読み込み中...</span>
					</div>
				) : activeNode ? (
					<motion.div
						key={activeNode.id}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.15, ease: 'easeOut' }}
						className="h-full"
					>
					<CodeMirrorEditor
						activeNodeId={activeNode.id}
						paneId={paneId}
						content={content}
						onCharCount={handleCharCount}
						isMarkdownView={activeNode.isMarkdownView}
						isSyncScrollEnabled={isSyncScrollEnabled}
						syncScrollRatio={syncScrollRatio}
						syncScrollSource={syncScrollSource}
						onScrollSync={setSyncScrollRatio}
						onWikiNavigate={handleWikiNavigate}
						getNoteTitles={getNoteTitles}
						isZenMode={isZenMode}
						onSave={(c) => {
							setSaveStatus(paneId, 'saving');
							return updateNoteContent(activeNode.id, c)
								.then(() => setSaveStatus(paneId, 'saved'))
								.catch(() => setSaveStatus(paneId, 'error'));
						}}
						onFocus={() => setFocusedPane(paneId)}
						isFocused={isFocused}
					/>
					</motion.div>
				) : (
					<div className="h-full flex items-center justify-center text-muted-foreground bg-card/10">
						<div className="text-center space-y-4 px-8">
							<FileText className="w-14 h-14 mx-auto opacity-[0.08]" strokeWidth={1.5} />
							<div>
								<p className="text-sm font-medium tracking-tight">ノートが選択されていません</p>
								<p className="text-xs mt-1.5 opacity-50 font-normal">ツリーから選ぶか、すぐ書き始められます</p>
							</div>
							<div className="flex flex-col gap-1.5 text-[11px] text-muted-foreground/40 pt-2">
								<span><kbd className="px-1.5 py-0.5 bg-muted/30 border border-border/40 rounded font-mono text-[10px]">Ctrl+Shift+M</kbd> 一言メモ</span>
								<span><kbd className="px-1.5 py-0.5 bg-muted/30 border border-border/40 rounded font-mono text-[10px]">Ctrl+P</kbd> ノート検索</span>
								<span><kbd className="px-1.5 py-0.5 bg-muted/30 border border-border/40 rounded font-mono text-[10px]">Ctrl+Shift+P</kbd> コマンド</span>
								<span><kbd className="px-1.5 py-0.5 bg-muted/30 border border-border/40 rounded font-mono text-[10px]">Enter</kbd> 選択中のノートを開く</span>
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
	onCharCount,
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
	onSave: (c: string) => Promise<void> | void;
	onFocus: () => void;
	isFocused: boolean;
	activeNodeId: string;
	paneId: 1 | 2;
	onCharCount: (n: number) => void;
	isMarkdownView: boolean;
	isSyncScrollEnabled: boolean;
	syncScrollRatio: number;
	syncScrollSource: 1 | 2 | null;
	onScrollSync: (ratio: number, source: 1 | 2) => void;
	onWikiNavigate: (title: string, openInOtherPane?: boolean) => void;
	getNoteTitles: () => string[];
	isZenMode: boolean;
}) {
	const { focusTarget, contentSaveSeq, isLineWrapEnabled } = useNoteStore();
	const treeNodes = useNoteStore((s) => s.treeNodes);
	const wikiLinkRefreshCounterRef = useRef(0);
	const lineWrapCompartmentRef = useRef<Compartment | null>(null);
	const wysiwygCompartmentRef = useRef<Compartment | null>(null);
	if (!lineWrapCompartmentRef.current) lineWrapCompartmentRef.current = new Compartment();
	if (!wysiwygCompartmentRef.current) wysiwygCompartmentRef.current = new Compartment();
	const isLineWrapEnabledRef = useRef(isLineWrapEnabled);
	isLineWrapEnabledRef.current = isLineWrapEnabled;
	const savedContentSeq = contentSaveSeq[activeNodeId] ?? 0;
	const consumedTriggerRef = useRef(-1);
	const editorRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);
	const [isDirty, setIsDirty] = useState(false);
	const [saveTick, setSaveTick] = useState(0);
	const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const isSyncingRef = useRef(false);
	const isDirtyRef = useRef(false);
	const onSaveRef = useRef(onSave);
	const previewTimerRef = useRef<NodeJS.Timeout | null>(null);
	const lastSavedContentRef = useRef(content);
	const saveGenerationRef = useRef(0);
	const saveRequestSeqRef = useRef(0);

	useEffect(() => {
		saveGenerationRef.current += 1;
		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
			saveTimeoutRef.current = null;
		}
	}, [activeNodeId]);

	// Volatile values read inside CodeMirror extensions/handlers. Kept in refs so
	// they don't have to live in the view-creation effect's deps — otherwise the
	// whole EditorView would be torn down and recreated whenever they change,
	// stealing focus mid-edit (e.g. on every autosave when `content` updates).
	const isZenModeRef = useRef(isZenMode);
	isZenModeRef.current = isZenMode;
	const isFocusedRef = useRef(isFocused);
	isFocusedRef.current = isFocused;
	const isSyncScrollEnabledRef = useRef(isSyncScrollEnabled);
	isSyncScrollEnabledRef.current = isSyncScrollEnabled;

	useEffect(() => {
		wikiLinkRefreshCounterRef.current += 1;
		const view = viewRef.current;
		if (view) view.dispatch({});
	}, [treeNodes]);
	const isComposingRef = useRef(false);
	const [compositionTick, setCompositionTick] = useState(0);
	const onCharCountRef = useRef(onCharCount);
	onCharCountRef.current = onCharCount;

	// Mark the editor dirty AND flip the save indicator to "saving" immediately on
	// edit, so the indicator reflects unsaved changes instead of staying green.
	const markDirty = useCallback(() => {
		isDirtyRef.current = true;
		setIsDirty(true);
		setSaveTick((tick) => tick + 1);
		useNoteStore.getState().setSaveStatus(paneId, 'saving');
	}, [paneId]);

	const schedulePreview = useCallback(
		(doc: string) => {
			if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
			previewTimerRef.current = setTimeout(() => {
				useNoteStore.getState().patchLocalContent(activeNodeId, doc);
			}, 500);
		},
		[activeNodeId]
	);

	useEffect(() => {
		onSaveRef.current = onSave;
	}, [onSave]);

	const markSaved = useCallback(() => {
		isDirtyRef.current = false;
		setIsDirty(false);
	}, []);

	const flushSaveAsync = useCallback(async (): Promise<void> => {
		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
			saveTimeoutRef.current = null;
		}
		if (!isDirtyRef.current || !viewRef.current) return;

		saveEditorSession(activeNodeId, viewRef.current);
		const contentToSave = viewRef.current.state.doc.toString();
		if (contentToSave === lastSavedContentRef.current) {
			markSaved();
			return;
		}
		const gen = saveGenerationRef.current;
		const requestSeq = ++saveRequestSeqRef.current;
		const result = onSaveRef.current(contentToSave);
		if (result && typeof (result as Promise<void>).then === 'function') {
			try {
				await result;
				if (gen !== saveGenerationRef.current) return;
				if (requestSeq !== saveRequestSeqRef.current) return;
				if (viewRef.current?.state.doc.toString() !== contentToSave) return;
				lastSavedContentRef.current = contentToSave;
				markSaved();
			} catch {
				if (gen !== saveGenerationRef.current) return;
				if (requestSeq !== saveRequestSeqRef.current) return;
				if (viewRef.current?.state.doc.toString() !== contentToSave) return;
				useNoteStore.getState().setSaveStatus(paneId, 'error');
			}
		} else {
			if (viewRef.current?.state.doc.toString() === contentToSave) {
				lastSavedContentRef.current = contentToSave;
				markSaved();
			}
		}
	}, [markSaved, activeNodeId, paneId]);

	const flushSave = useCallback(() => {
		void flushSaveAsync();
	}, [flushSaveAsync]);

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
					const doc = view.state.doc;
					// Table blocks are rendered by mdTableField (block decorations must come
					// from a state field, not a view plugin); skip those lines here.
					const codeBlockLines = collectFencedCodeLineNumbers(doc);
					const tableRanges = collectMarkdownTableRanges(doc, codeBlockLines);
					const ranges: Range<Decoration>[] = [];

					for (let i = 1; i <= doc.lines; i++) {
						const line = doc.line(i);
						if (tableRanges.some((r) => line.from >= r.from && line.from <= r.to)) continue;
						const parsed = parseMarkdownLine(line.text, {
							isCodeLine: codeBlockLines.has(i),
							isFenceLine: isMarkdownFenceLine(line.text),
						});
						if (parsed.lineClasses.length > 0) {
							ranges.push(Decoration.line({ class: parsed.lineClasses.join(' ') }).range(line.from));
						}
						for (const decoration of parsed.decorations) {
							addMarkdownDecoration(ranges, line.from, decoration);
						}
					}

					return Decoration.set(ranges, true);
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
				'.cm-strike': { textDecoration: 'line-through', opacity: '0.78' },
				'.cm-link': {
					color: '#7dd3fc',
					textDecoration: 'underline',
					textUnderlineOffset: '2px',
				},
				'.cm-inline-code': {
					backgroundColor: 'rgba(255,255,255,0.1)',
					padding: '0.1em 0.4em',
					borderRadius: '4px',
					fontFamily: 'var(--font-mono)',
					fontSize: '0.9em',
				},
				'.cm-blockquote-line': {
					borderLeft: '3px solid rgba(255,255,255,0.22)',
					color: 'rgba(255,255,255,0.72)',
					paddingLeft: '0.9em',
				},
				'.cm-blockquote-marker': {
					display: 'inline-block',
					width: '0.8em',
					color: 'rgba(255,255,255,0.45)',
				},
				'.cm-checkbox-marker': {
					display: 'inline-block',
					minWidth: '1.5em',
					color: 'rgba(255,255,255,0.74)',
					fontVariantNumeric: 'tabular-nums',
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
				'.cm-code-block-line': {
					backgroundColor: 'rgba(255,255,255,0.055)',
					fontFamily: 'var(--font-mono)',
				},
				'.cm-code-fence-line': {
					color: 'rgba(255,255,255,0.42)',
				},
				'.cm-horizontal-rule-line': {
					color: 'rgba(255,255,255,0.24)',
				},
				'.cm-horizontal-rule': {
					display: 'inline-block',
					width: 'min(32rem, 70%)',
					height: '1px',
					margin: '0.6em 0',
					backgroundColor: 'rgba(255,255,255,0.22)',
					verticalAlign: 'middle',
				},
				'.cm-md-image': {
					display: 'inline-flex',
					alignItems: 'center',
					gap: '0.45em',
					maxWidth: '100%',
					verticalAlign: 'middle',
				},
				'.cm-md-image img': {
					display: 'inline-block',
					maxWidth: 'min(100%, 34rem)',
					maxHeight: '18rem',
					borderRadius: '6px',
					border: '1px solid rgba(255,255,255,0.12)',
					objectFit: 'contain',
				},
				'.cm-md-image-alt': {
					color: 'rgba(255,255,255,0.46)',
					fontSize: '0.86em',
				},
				'.cm-md-table-wrap': {
					overflowX: 'auto',
					margin: '0.7em 0',
				},
				'.cm-md-table': {
					borderCollapse: 'collapse',
					fontSize: '0.9em',
					lineHeight: '1.4',
					border: '1px solid rgba(255,255,255,0.16)',
					borderRadius: '6px',
					overflow: 'hidden',
					userSelect: 'text',
					WebkitUserSelect: 'text',
					cursor: 'text',
				},
				'.cm-md-table th, .cm-md-table td': {
					border: '1px solid rgba(255,255,255,0.12)',
					padding: '6px 12px',
					verticalAlign: 'top',
				},
				'.cm-md-table th': {
					backgroundColor: 'rgba(255,255,255,0.07)',
					fontWeight: '600',
					color: '#ffffff',
					whiteSpace: 'nowrap',
				},
				'.cm-md-table td': {
					color: 'rgba(255,255,255,0.82)',
				},
				'.cm-md-table tbody tr:nth-child(even) td': {
					backgroundColor: 'rgba(255,255,255,0.025)',
				},
				'.cm-md-table code': {
					fontFamily: 'var(--font-mono)',
					fontSize: '0.9em',
					backgroundColor: 'rgba(255,255,255,0.1)',
					padding: '0.05em 0.35em',
					borderRadius: '4px',
				},
				'.cm-md-table a': {
					color: '#7dd3fc',
					textDecoration: 'underline',
					textUnderlineOffset: '2px',
				},
				'.cm-md-table img': {
					maxHeight: '8rem',
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
				// Keep the active-line tint barely-there so it never competes with the
				// selection highlight. Selection is a translucent white wash to match
				// the monochrome black/white theme (no colored accent).
				'.cm-activeLine': {
					backgroundColor: 'rgba(255,255,255,0.035)',
				},
				'.cm-selectionBackground': {
					backgroundColor: 'rgba(255,255,255,0.20) !important',
					borderRadius: '3px',
				},
				'.cm-content ::selection, ::selection': {
					backgroundColor: 'rgba(255,255,255,0.20) !important',
				},
				'&.cm-focused .cm-selectionBackground': {
					backgroundColor: 'rgba(255,255,255,0.28) !important',
				},
				// Smooth, slightly thicker caret for a more refined feel.
				'.cm-cursor, .cm-dropCursor': {
					borderLeftWidth: '2px',
					borderLeftColor: '#ffffff',
				},
			},
			{ dark: true }
		);

		const lineWrapCompartment = lineWrapCompartmentRef.current;
		const wysiwygCompartment = wysiwygCompartmentRef.current;
		if (!lineWrapCompartment || !wysiwygCompartment) return;

		const extensions = [
			lineWrapCompartment.of(isLineWrapEnabledRef.current ? EditorView.lineWrapping : []),
			wysiwygCompartment.of(isMarkdownView ? [wysiwygPlugin, wysiwygTheme, mdTableField] : []),
			// Rendered markdown tables are block widgets; let the browser copy the
			// natively-selected text inside them instead of CodeMirror's doc selection.
			EditorView.domEventHandlers({
				copy(event) {
					const sel = window.getSelection();
					if (!sel || sel.isCollapsed || !sel.toString()) return false;
					const inTable = (node: Node | null) => {
						const el = node && (node.nodeType === 3 ? node.parentElement : (node as Element));
						return !!el?.closest?.('.cm-md-table');
					};
					if (inTable(sel.anchorNode) && inTable(sel.focusNode)) {
						event.clipboardData?.setData('text/plain', sel.toString());
						event.preventDefault();
						return true;
					}
					return false;
				},
			}),
			history(),
			drawSelection(),
			dropCursor(),
			EditorState.allowMultipleSelections.of(true),
			indentOnInput(),
			bracketMatching(),
			rectangularSelection(),
			highlightActiveLine(),
			highlightSpecialChars(),
			scrollPastEnd(),
			markdown(),
			themeConfig,
			search({ top: true }),
			markdownContinueKeymap(),
			markdownFormatKeymap(),
			markdownAutoBullet(),
			editorPlaceholder(),
			typewriterScrollExtension(() => isZenModeRef.current && isFocusedRef.current),
			wikiLinkPlugin(
				onWikiNavigate,
				(t) => getNoteTitles().some((n) => n.toLowerCase() === t.toLowerCase()),
				() => wikiLinkRefreshCounterRef.current
			),
			wikiLinkAutocomplete(getNoteTitles),
			checkboxClickHandler((lineNum, checked) => {
				const view = viewRef.current;
				if (!view) return;
				const line = view.state.doc.line(lineNum);
				const text = line.text;
				const newLine = checked
					? text.replace(/^(\s*)((?:[-*+])|(?:\d+[.)]))(\s+)\[ \](\s+)/, '$1$2$3[x]$4')
					: text.replace(/^(\s*)((?:[-*+])|(?:\d+[.)]))(\s+)\[[xX]\](\s+)/, '$1$2$3[ ]$4');
				if (newLine === text) return;
				view.dispatch({ changes: { from: line.from, to: line.to, insert: newLine } });
				markDirty();
				schedulePreview(view.state.doc.toString());
			}),
			EditorView.updateListener.of((u) => {
				if (u.docChanged) onCharCountRef.current(u.state.doc.length);
			}),
			EditorView.updateListener.of((u) => {
				if (u.docChanged && !isComposingRef.current) markDirty();
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
				{
					key: 'Mod-s',
					run: () => {
						flushSave();
						return true;
					},
				},
			]),
			...imeCompositionGuard(
				(doc) => {
					markDirty();
					schedulePreview(doc);
				},
				isComposingRef,
				() => setCompositionTick((t) => t + 1)
			),
		];

		const state = EditorState.create({
			doc: content,
			extensions,
		});

		const view = new EditorView({
			state,
			parent: editorRef.current,
		});

		viewRef.current = view;
		onCharCountRef.current(view.state.doc.length);

		if (!restoreEditorSession(activeNodeId, view)) {
			if (content === '') {
				const end = view.state.doc.length;
				view.dispatch({ selection: { anchor: end, head: end } });
			}
		}

		const handleScroll = () => {
			if (isZenModeRef.current && isFocusedRef.current) return;
			if (!isSyncScrollEnabledRef.current || isSyncingRef.current) return;
			const scroller = view.scrollDOM;
			const maxScroll = scroller.scrollHeight - scroller.clientHeight;
			if (maxScroll <= 0) return;
			onScrollSync(scroller.scrollTop / maxScroll, paneId);
		};
		view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true });

		return () => {
			view.scrollDOM.removeEventListener('scroll', handleScroll);
			if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
			saveEditorSession(activeNodeId, view);
			flushSave();
			view.destroy();
		};
		// NOTE: intentionally excludes content / isFocused / isZenMode /
		// isSyncScrollEnabled — those are read via refs so the view is created once
		// per note — markdown mode toggles via compartment reconfigure (see below).
		// External content updates are applied by the "sync external content" effect
		// below without recreating the view.
	}, [onScrollSync, paneId, onWikiNavigate, getNoteTitles, flushSave, schedulePreview, activeNodeId]);

	// Apply synced scroll from the other pane (disabled in Zen — typewriter scroll owns the view)
	useEffect(() => {
		if (isZenMode || !isSyncScrollEnabled || syncScrollSource === paneId || syncScrollSource === null) return;
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
	}, [syncScrollRatio, syncScrollSource, isSyncScrollEnabled, isZenMode, paneId]);

	// Toggle WYSIWYG markdown view live without recreating the editor.
	useEffect(() => {
		const view = viewRef.current;
		const compartment = wysiwygCompartmentRef.current;
		if (view && compartment) {
			view.dispatch({
				effects: compartment.reconfigure(isMarkdownView ? [wysiwygPlugin, wysiwygTheme, mdTableField] : []),
			});
		}
	}, [isMarkdownView, wysiwygPlugin, wysiwygTheme]);

	// Toggle soft line-wrap live, without recreating the editor (keeps cursor/scroll).
	useEffect(() => {
		const view = viewRef.current;
		const compartment = lineWrapCompartmentRef.current;
		if (view && compartment) {
			view.dispatch({ effects: compartment.reconfigure(isLineWrapEnabled ? EditorView.lineWrapping : []) });
		}
	}, [isLineWrapEnabled]);

	// Focus editor when triggered; only jump to end for empty notes
	useEffect(() => {
		if (isFocused && viewRef.current && focusTarget.nodeId === activeNodeId && focusTarget.paneId === paneId) {
			if (focusTarget.trigger > consumedTriggerRef.current) {
				const view = viewRef.current;
				if (view.state.doc.length === 0) {
					view.dispatch({ selection: { anchor: 0, head: 0 } });
				}
				if (!view.hasFocus) view.focus();
				consumedTriggerRef.current = focusTarget.trigger;
			}
		}
	}, [isFocused, focusTarget, activeNodeId, paneId]);

	// Sync external content (templates, etc.) when saved from outside while editor is clean
	useEffect(() => {
		const view = viewRef.current;
		if (!view || isDirtyRef.current) return;
		const doc = view.state.doc.toString();
		if (content !== doc) {
			view.dispatch({ changes: { from: 0, to: doc.length, insert: content } });
		}
	}, [savedContentSeq, content, activeNodeId]);

	useEffect(() => {
		useNoteStore.getState().registerEditorFlush(paneId, flushSave);
		useNoteStore.getState().registerEditorFlushAsync(paneId, flushSaveAsync);
		useNoteStore.getState().registerEditorGetDoc(paneId, () => viewRef.current?.state.doc.toString() ?? '');
		return () => {
			useNoteStore.getState().registerEditorFlush(paneId, null);
			useNoteStore.getState().registerEditorFlushAsync(paneId, null);
			useNoteStore.getState().registerEditorGetDoc(paneId, null);
		};
	}, [paneId, flushSave, flushSaveAsync]);

	useEffect(() => {
		lastSavedContentRef.current = content;
		isDirtyRef.current = false;
		setIsDirty(false);
	}, [activeNodeId]);

	useEffect(() => {
		if (!isDirtyRef.current) {
			lastSavedContentRef.current = content;
		}
	}, [content]);

	// Save effect (debounced) — skip while IME is composing
	useEffect(() => {
		if (isDirty && viewRef.current && !isComposingRef.current) {
			if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
			const contentToSave = viewRef.current.state.doc.toString();
			if (contentToSave === lastSavedContentRef.current) {
				markSaved();
				return;
			}
			saveTimeoutRef.current = setTimeout(() => {
				const gen = saveGenerationRef.current;
				const requestSeq = ++saveRequestSeqRef.current;
				const result = onSaveRef.current(contentToSave);
				if (result && typeof (result as Promise<void>).then === 'function') {
					(result as Promise<void>)
						.then(() => {
							if (gen !== saveGenerationRef.current) return;
							if (requestSeq !== saveRequestSeqRef.current) return;
							if (viewRef.current?.state.doc.toString() !== contentToSave) return;
							lastSavedContentRef.current = contentToSave;
							markSaved();
						})
						.catch(() => {
							if (gen !== saveGenerationRef.current) return;
							if (requestSeq !== saveRequestSeqRef.current) return;
							if (viewRef.current?.state.doc.toString() !== contentToSave) return;
							useNoteStore.getState().setSaveStatus(paneId, 'error');
						});
				} else {
					if (viewRef.current?.state.doc.toString() === contentToSave) {
						lastSavedContentRef.current = contentToSave;
						markSaved();
					}
				}
			}, 400);
		}
		return () => {
			if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
		};
	}, [isDirty, markSaved, compositionTick, saveTick, paneId]);

	// Flush on window blur / before close (focused pane only for blur)
	useEffect(() => {
		const onBlur = () => {
			if (useNoteStore.getState().focusedPane === paneId) flushSave();
		};
		const onBeforeUnload = (e: BeforeUnloadEvent) => {
			flushSave();
			if (isDirtyRef.current) {
				e.preventDefault();
				e.returnValue = '';
			}
		};
		window.addEventListener('blur', onBlur);
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => {
			window.removeEventListener('blur', onBlur);
			window.removeEventListener('beforeunload', onBeforeUnload);
		};
	}, [flushSave, paneId]);

	return (
		<div
			ref={editorRef}
			className="h-full w-full"
			onFocus={onFocus}
			onBlur={() => flushSave()}
		/>
	);
}

function addMarkdownDecoration(ranges: Range<Decoration>[], lineFrom: number, decoration: MarkdownLineDecoration) {
	const from = lineFrom + decoration.from;
	const to = lineFrom + decoration.to;

	if (decoration.kind === 'hide') {
		ranges.push(Decoration.replace({}).range(from, to));
		return;
	}
	if (decoration.kind === 'mark') {
		ranges.push(
			Decoration.mark({
				class: decoration.className,
				attributes: decoration.title ? { title: decoration.title } : undefined,
			}).range(from, to)
		);
		return;
	}
	if (decoration.kind === 'blockquote') {
		ranges.push(Decoration.replace({ widget: new BlockquoteWidget(decoration.depth) }).range(from, to));
		return;
	}
	if (decoration.kind === 'bullet') {
		ranges.push(Decoration.replace({ widget: new BulletWidget() }).range(from, to));
		return;
	}
	if (decoration.kind === 'number') {
		ranges.push(Decoration.replace({ widget: new NumberWidget(decoration.number, decoration.delimiter) }).range(from, to));
		return;
	}
	if (decoration.kind === 'checkbox') {
		ranges.push(Decoration.replace({ widget: new CheckboxWidget(decoration.checked, decoration.marker) }).range(from, to));
		return;
	}
	if (decoration.kind === 'hr') {
		ranges.push(Decoration.replace({ widget: new HorizontalRuleWidget() }).range(from, to));
		return;
	}
	if (decoration.kind === 'image') {
		ranges.push(Decoration.replace({ widget: new ImageWidget(decoration.alt, decoration.src, decoration.title) }).range(from, to));
	}
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
	constructor(private num: string, private delimiter = '.') {
		super();
	}
	toDOM() {
		const span = document.createElement('span');
		span.className = 'cm-number-marker';
		span.textContent = `${this.num}${this.delimiter} `;
		return span;
	}
}

class CheckboxWidget extends WidgetType {
	constructor(private checked: boolean, private marker: string) {
		super();
	}
	eq(other: CheckboxWidget) {
		return other.checked === this.checked && other.marker === this.marker;
	}
	toDOM() {
		const span = document.createElement('span');
		span.className = 'cm-checkbox-marker';
		const prefix = /^\d+[.)]$/.test(this.marker) ? `${this.marker} ` : '';
		span.textContent = `${prefix}${this.checked ? '☑' : '☐'} `;
		span.style.cssText = 'cursor:pointer;user-select:none';
		return span;
	}
	// Let clicks on the rendered checkbox reach the editor's mousedown handler
	// (default ignoreEvent() returns true, which would swallow the toggle click).
	ignoreEvent() {
		return false;
	}
}

class BlockquoteWidget extends WidgetType {
	constructor(private depth = 1) {
		super();
	}
	toDOM() {
		const span = document.createElement('span');
		span.className = 'cm-blockquote-marker';
		span.dataset.depth = String(this.depth);
		span.textContent = '▌ ';
		return span;
	}
}

class HorizontalRuleWidget extends WidgetType {
	toDOM() {
		const span = document.createElement('span');
		span.className = 'cm-horizontal-rule';
		return span;
	}
}

class ImageWidget extends WidgetType {
	constructor(private alt: string, private src: string, private title?: string) {
		super();
	}
	eq(other: ImageWidget) {
		return other.alt === this.alt && other.src === this.src && other.title === this.title;
	}
	toDOM() {
		const span = document.createElement('span');
		span.className = 'cm-md-image';
		span.title = this.title ?? this.src;

		if (!/^(https?:|data:image\/|file:|\/|\.\/|\.\.\/)/i.test(this.src)) {
			span.textContent = this.alt || this.src;
			return span;
		}

		const img = document.createElement('img');
		img.src = this.src;
		img.alt = this.alt;
		img.loading = 'lazy';
		if (this.title) img.title = this.title;
		span.appendChild(img);

		if (this.alt) {
			const caption = document.createElement('span');
			caption.className = 'cm-md-image-alt';
			caption.textContent = this.alt;
			span.appendChild(caption);
		}

		return span;
	}
}

// Renders a markdown table block (header / separator / body rows) as a real
// styled HTML table in the WYSIWYG markdown view.
class TableWidget extends WidgetType {
	constructor(private source: string) {
		super();
	}
	eq(other: TableWidget) {
		return other.source === this.source;
	}
	toDOM() {
		const parsed = parseMarkdownTable(this.source);

		const wrap = document.createElement('div');
		wrap.className = 'cm-md-table-wrap';
		if (!parsed) {
			wrap.textContent = this.source;
			return wrap;
		}

		const table = document.createElement('table');
		table.className = 'cm-md-table';

		const thead = document.createElement('thead');
		const htr = document.createElement('tr');
		parsed.headers.forEach((h, idx) => {
			const th = document.createElement('th');
			th.style.textAlign = parsed.aligns[idx] ?? 'left';
			appendMarkdownInline(th, h);
			htr.appendChild(th);
		});
		thead.appendChild(htr);
		table.appendChild(thead);

		const tbody = document.createElement('tbody');
		parsed.rows.forEach((row) => {
			const tr = document.createElement('tr');
			for (let c = 0; c < parsed.headers.length; c++) {
				const td = document.createElement('td');
				td.style.textAlign = parsed.aligns[c] ?? 'left';
				appendMarkdownInline(td, row[c] ?? '');
				tr.appendChild(td);
			}
			tbody.appendChild(tr);
		});
		table.appendChild(tbody);
		wrap.appendChild(table);
		return wrap;
	}
	// Let the browser handle events on the table so its text can be selected.
	ignoreEvent() {
		return true;
	}
}

function buildTableDecoSet(doc: Text): DecorationSet {
	return Decoration.set(
		collectMarkdownTableRanges(doc).map((r) => Decoration.replace({ widget: new TableWidget(r.source), block: true }).range(r.from, r.to)),
		true
	);
}

// Block decorations must be provided by a state field (a view plugin would break
// height measurement). Active only when the markdown view extensions are added.
const mdTableField = StateField.define<DecorationSet>({
	create(state) {
		return buildTableDecoSet(state.doc);
	},
	update(deco, tr) {
		return tr.docChanged ? buildTableDecoSet(tr.newDoc) : deco;
	},
	provide: (f) => EditorView.decorations.from(f),
});
