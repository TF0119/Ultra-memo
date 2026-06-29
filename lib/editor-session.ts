import type { EditorView } from '@codemirror/view';

type EditorSession = {
	anchor: number;
	head: number;
	scrollTop: number;
};

const sessions = new Map<string, EditorSession>();

export function saveEditorSession(noteId: string, view: EditorView) {
	const main = view.state.selection.main;
	sessions.set(noteId, {
		anchor: main.anchor,
		head: main.head,
		scrollTop: view.scrollDOM.scrollTop,
	});
}

export function restoreEditorSession(noteId: string, view: EditorView): boolean {
	const session = sessions.get(noteId);
	if (!session) return false;

	const len = view.state.doc.length;
	const anchor = Math.min(session.anchor, len);
	const head = Math.min(session.head, len);
	view.dispatch({ selection: { anchor, head } });
	view.scrollDOM.scrollTop = session.scrollTop;
	return true;
}
