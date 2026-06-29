import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';

const PLACEHOLDER_TEXT = '思いついたことを、そのまま書く…';

export function editorPlaceholder(text = PLACEHOLDER_TEXT) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			constructor(view: EditorView) {
				this.decorations = this.build(view);
			}
			update(update: ViewUpdate) {
				if (update.docChanged || update.focusChanged) {
					this.decorations = this.build(update.view);
				}
			}
			build(view: EditorView): DecorationSet {
				if (view.state.doc.length > 0 || view.hasFocus) {
					return Decoration.none;
				}
				return Decoration.set([
					Decoration.widget({
						widget: new PlaceholderWidget(text),
						side: 1,
					}).range(0),
				]);
			}
		},
		{ decorations: (v) => v.decorations }
	);
}

class PlaceholderWidget {
	constructor(private text: string) {}
	toDOM() {
		const span = document.createElement('span');
		span.textContent = this.text;
		span.style.cssText = 'color:#444;pointer-events:none;user-select:none;font-style:italic';
		return span;
	}
	ignoreEvent() {
		return false;
	}
}
