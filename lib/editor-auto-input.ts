import { EditorView } from '@codemirror/view';

/** Turn "- " at line start into a bullet list marker */
export function markdownAutoBullet() {
	return EditorView.inputHandler.of((view, from, _to, text) => {
		if (text !== ' ') return false;
		const line = view.state.doc.lineAt(from);
		const before = view.state.sliceDoc(line.from, from);
		if (before !== '-') return false;
		view.dispatch({
			changes: { from: line.from, to: from + 1, insert: '- ' },
			selection: { anchor: line.from + 2 },
		});
		return true;
	});
}
