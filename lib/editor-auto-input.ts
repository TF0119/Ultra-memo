import { EditorView } from '@codemirror/view';

/** Markdown typing conveniences: "- ", "> ", "1. " at line start */
export function markdownAutoBullet() {
	return EditorView.inputHandler.of((view, from, _to, text) => {
		if (text !== ' ') return false;
		const line = view.state.doc.lineAt(from);
		const before = view.state.sliceDoc(line.from, from);

		if (before === '-' || before === '*') {
			view.dispatch({
				changes: { from: line.from, to: from + 1, insert: `${before} ` },
				selection: { anchor: line.from + 2 },
			});
			return true;
		}

		if (before === '>') {
			view.dispatch({
				changes: { from: line.from, to: from + 1, insert: '> ' },
				selection: { anchor: line.from + 2 },
			});
			return true;
		}

		if (/^\d+$/.test(before)) {
			view.dispatch({
				changes: { from: line.from, to: from + 1, insert: `${before}. ` },
				selection: { anchor: line.from + before.length + 2 },
			});
			return true;
		}

		return false;
	});
}
