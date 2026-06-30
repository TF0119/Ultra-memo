import type { EditorView } from '@codemirror/view';

type EditorSession = {
	anchor: number;
	head: number;
	scrollTop: number;
};

const sessions = new Map<string, EditorSession>();
const MAX_SESSIONS = 48;

export function saveEditorSession(noteId: string, view: EditorView) {
	const main = view.state.selection.main;
	if (sessions.has(noteId)) {
		sessions.delete(noteId);
	} else if (sessions.size >= MAX_SESSIONS) {
		const oldest = sessions.keys().next().value;
		if (oldest) sessions.delete(oldest);
	}
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

export function clearEditorSession(noteId: string) {
	sessions.delete(noteId);
}
