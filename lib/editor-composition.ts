import { EditorView } from '@codemirror/view';

/** Track IME composition so we don't fight Japanese/Chinese input mid-conversion. */
export function imeCompositionGuard(
	onDocChange: (doc: string) => void,
	isComposingRef?: { current: boolean },
	onCompositionEnd?: () => void
) {
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
				if (isComposingRef) isComposingRef.current = true;
				return false;
			},
			compositionend: () => {
				composing = false;
				if (isComposingRef) isComposingRef.current = false;
				flush();
				onCompositionEnd?.();
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
