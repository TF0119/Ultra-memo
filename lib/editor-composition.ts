import { EditorView } from '@codemirror/view';

/** Track IME composition so we don't fight Japanese/Chinese input mid-conversion. */
export function imeCompositionGuard(onDocChange: (doc: string) => void) {
	let composing = false;
	let pendingDoc: string | null = null;

	const flush = () => {
		if (pendingDoc !== null) {
			onDocChange(pendingDoc);
			pendingDoc = null;
		}
	};

	return [
		EditorView.domEventHandlers({
			compositionstart: () => {
				composing = true;
				return false;
			},
			compositionend: () => {
				composing = false;
				flush();
				return false;
			},
		}),
		EditorView.updateListener.of((update) => {
			if (!update.docChanged) return;
			const doc = update.state.doc.toString();
			if (composing) {
				pendingDoc = doc;
				return;
			}
			onDocChange(doc);
		}),
	];
}
