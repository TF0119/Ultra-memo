import { EditorView } from '@codemirror/view';

/** Keep the cursor line near vertical center while typing (Zen / long-form). */
export function typewriterScrollExtension(enabled: () => boolean) {
	return EditorView.updateListener.of((update) => {
		if (!enabled()) return;
		if (!update.docChanged && !update.selectionSet) return;
		if (!update.view.hasFocus) return;

		const view = update.view;
		const head = view.state.selection.main.head;
		const coords = view.coordsAtPos(head);
		if (!coords) return;

		const scroller = view.scrollDOM;
		const scrollerRect = scroller.getBoundingClientRect();
		const targetY = scrollerRect.top + scrollerRect.height * 0.4;
		const delta = coords.top - targetY;

		if (Math.abs(delta) > 8) {
			scroller.scrollTop += delta;
		}
	});
}
