import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { RangeSetBuilder, EditorState, Compartment } from '@codemirror/state';
import { autocompletion, CompletionContext } from '@codemirror/autocomplete';
import { isPlaceholderTitle } from './wiki-links';

class WikiLinkWidget extends WidgetType {
	constructor(
		private title: string,
		private onClick: (title: string, openInOtherPane: boolean) => void,
		private exists: boolean
	) {
		super();
	}
	toDOM() {
		const span = document.createElement('span');
		span.className = 'cm-wiki-link';
		span.textContent = this.title;
		span.title = this.exists ? `[[${this.title}]] へ移動 · Mod+クリックで反対ペイン` : `[[${this.title}]] を作成して開く · Mod+クリックで反対ペイン`;
		span.style.cssText = this.exists
			? 'color:#7dd3fc;cursor:pointer;text-decoration:underline;text-underline-offset:2px'
			: 'color:#fbbf24;cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px;opacity:0.85';
		span.addEventListener('mousedown', (e) => e.preventDefault());
		span.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.onClick(this.title, e.metaKey || e.ctrlKey);
		});
		return span;
	}
}

export function wikiLinkPlugin(
	onNavigate: (title: string, openInOtherPane: boolean) => void,
	titleExists: (title: string) => boolean,
	getRefreshTick: () => number
) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			refreshTick = getRefreshTick();
			constructor(view: EditorView) {
				this.decorations = this.build(view);
			}
			update(update: ViewUpdate) {
				const tick = getRefreshTick();
				if (update.docChanged || update.viewportChanged || tick !== this.refreshTick) {
					this.refreshTick = tick;
					this.decorations = this.build(update.view);
				}
			}
			build(view: EditorView): DecorationSet {
				const builder = new RangeSetBuilder<Decoration>();
				const text = view.state.doc.toString();
				const regex = /\[\[([^\]]+)\]\]/g;
				let match;
				while ((match = regex.exec(text)) !== null) {
					const from = match.index;
					const to = from + match[0].length;
					const title = match[1].trim();
					builder.add(
						from,
						to,
						Decoration.replace({
							widget: new WikiLinkWidget(title, onNavigate, titleExists(title)),
						})
					);
				}
				return builder.finish();
			}
		},
		{ decorations: (v) => v.decorations }
	);
}

export function wikiLinkAutocomplete(getTitles: () => string[]) {
	return autocompletion({
		override: [
			(context: CompletionContext) => {
				const before = context.matchBefore(/\[\[[^\]]*/);
				if (!before) return null;
				const query = before.text.slice(2).toLowerCase();
				const titles = getTitles()
					.filter((t) => !isPlaceholderTitle(t))
					.filter((t) => t.toLowerCase().includes(query))
					.sort((a, b) => {
						const al = a.toLowerCase();
						const bl = b.toLowerCase();
						const aStarts = al.startsWith(query);
						const bStarts = bl.startsWith(query);
						if (aStarts !== bStarts) return aStarts ? -1 : 1;
						return al.localeCompare(bl, 'ja');
					});
				return {
					from: before.from + 2,
					options: titles.slice(0, 20).map((t) => ({
						label: t,
						type: 'text',
						apply: (view, _completion, from, to) => {
							view.dispatch({
								changes: { from, to, insert: `${t}]]` },
								selection: { anchor: from + t.length + 2 },
							});
						},
					})),
				};
			},
		],
	});
}

export function checkboxClickHandler(onToggle: (line: number, checked: boolean) => void) {
	// Handle on mousedown (not click): returning true makes CodeMirror preventDefault,
	// so the caret/focus never jumps to the checkbox before the toggle happens.
	const handle = (event: MouseEvent, view: EditorView): boolean => {
		if (event.button !== 0) return false;
		const target = event.target as HTMLElement | null;
		// WYSIWYG view: the "- [ ] " marker is replaced by a rendered glyph widget.
		// Resolve its line directly from the DOM so any click on the glyph counts —
		// posAtCoords is imprecise over a replaced widget and only fires beside it.
		const widget = target?.closest?.('.cm-checkbox-marker') as HTMLElement | null;
		let pos: number | null;
		if (widget) {
			pos = view.posAtDOM(widget);
		} else {
			pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
		}
		if (pos == null) return false;
		const line = view.state.doc.lineAt(pos);
		const unchecked = /^(\s*)((?:[-*+])|(?:\d+[.)]))(\s+)\[ \](\s+)/.exec(line.text);
		const checked = /^(\s*)((?:[-*+])|(?:\d+[.)]))(\s+)\[x\](\s+)/i.exec(line.text);
		const match = unchecked ?? checked;
		if (!match) return false;
		// Raw view: only toggle when the click lands on the "[ ]" marker itself.
		// WYSIWYG view: the whole marker is a single glyph, so any click on it counts.
		if (!widget && pos > line.from + match[0].length) return false;
		onToggle(line.number, !!unchecked);
		return true;
	};
	return EditorView.domEventHandlers({
		mousedown: handle,
	});
}

export function toggleCheckboxLine(doc: string, lineNumber: number, checked: boolean): string {
	const lines = doc.split('\n');
	const idx = lineNumber - 1;
	if (idx < 0 || idx >= lines.length) return doc;
	const line = lines[idx];
	if (checked) {
		lines[idx] = line.replace(/^(\s*)((?:[-*+])|(?:\d+[.)]))(\s+)\[ \](\s+)/, '$1$2$3[x]$4');
	} else {
		lines[idx] = line.replace(/^(\s*)((?:[-*+])|(?:\d+[.)]))(\s+)\[[xX]\](\s+)/, '$1$2$3[ ]$4');
	}
	return lines.join('\n');
}
