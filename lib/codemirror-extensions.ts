import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { RangeSetBuilder, EditorState, Compartment } from '@codemirror/state';
import { autocompletion, CompletionContext } from '@codemirror/autocomplete';

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
		span.title = this.exists ? `[[${this.title}]] へ移動` : `[[${this.title}]] を作成して開く`;
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

export function wikiLinkPlugin(onNavigate: (title: string, openInOtherPane: boolean) => void, titleExists: (title: string) => boolean) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			constructor(view: EditorView) {
				this.decorations = this.build(view);
			}
			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
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
	return EditorView.domEventHandlers({
		click(event, view) {
			const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
			if (pos == null) return false;
			const line = view.state.doc.lineAt(pos);
			const unchecked = /^(\s*)- \[ \] /.exec(line.text);
			const checked = /^(\s*)- \[x\] /i.exec(line.text);
			const match = unchecked ?? checked;
			if (!match) return false;
			const markerEnd = line.from + match[0].length;
			if (pos > markerEnd) return false;
			if (unchecked) {
				onToggle(line.number, true);
				return true;
			}
			if (checked) {
				onToggle(line.number, false);
				return true;
			}
			return false;
		},
	});
}

export function toggleCheckboxLine(doc: string, lineNumber: number, checked: boolean): string {
	const lines = doc.split('\n');
	const idx = lineNumber - 1;
	if (idx < 0 || idx >= lines.length) return doc;
	const line = lines[idx];
	if (checked) {
		lines[idx] = line.replace(/^(\s*)- \[ \] /, '$1- [x] ');
	} else {
		lines[idx] = line.replace(/^(\s*)- \[[xX]\] /, '$1- [ ] ');
	}
	return lines.join('\n');
}
