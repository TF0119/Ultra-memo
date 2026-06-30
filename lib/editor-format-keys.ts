import { EditorView, keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { copyLineDown, deleteLine } from '@codemirror/commands';

function wrapSelection(view: EditorView, marker: string): boolean {
	const { from, to } = view.state.selection.main;
	if (from === to) {
		view.dispatch({
			changes: { from, insert: `${marker}${marker}` },
			selection: { anchor: from + marker.length },
		});
		return true;
	}
	const selected = view.state.sliceDoc(from, to);
	if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= marker.length * 2) {
		view.dispatch({
			changes: { from, to, insert: selected.slice(marker.length, selected.length - marker.length) },
		});
		return true;
	}
	view.dispatch({
		changes: { from, to, insert: `${marker}${selected}${marker}` },
		selection: { anchor: from + marker.length, head: to + marker.length },
	});
	return true;
}

function indentListLine(view: EditorView, deltaSpaces: number): boolean {
	const head = view.state.selection.main.head;
	const line = view.state.doc.lineAt(head);
	if (!/^(\s*)([-*+] |\d+\. |- \[[ xX]\] |> )/.test(line.text)) return false;
	const indent = /^(\s*)/.exec(line.text)?.[1] ?? '';
	const newIndent =
		deltaSpaces > 0 ? `${indent}${' '.repeat(deltaSpaces)}` : indent.slice(0, Math.max(0, indent.length + deltaSpaces));
	if (newIndent === indent) return false;
	const delta = newIndent.length - indent.length;
	view.dispatch({
		changes: { from: line.from, to: line.from + indent.length, insert: newIndent },
		selection: { anchor: view.state.selection.main.anchor + delta, head: view.state.selection.main.head + delta },
	});
	return true;
}

/** Bold/italic wrap and list Tab indent */
export function markdownFormatKeymap() {
	return Prec.high(
		keymap.of([
			{ key: 'Mod-b', run: (view) => wrapSelection(view, '**') },
			{ key: 'Mod-i', run: (view) => wrapSelection(view, '*') },
			{ key: 'Mod-Shift-d', run: copyLineDown },
			{ key: 'Mod-Shift-k', run: deleteLine },
			{
				key: 'Mod-Alt-1',
				run: (view) => {
					const line = view.state.doc.lineAt(view.state.selection.main.from);
					view.dispatch({ changes: { from: line.from, to: line.from, insert: '# ' } });
					return true;
				},
			},
			{
				key: 'Mod-Alt-2',
				run: (view) => {
					const line = view.state.doc.lineAt(view.state.selection.main.from);
					view.dispatch({ changes: { from: line.from, to: line.from, insert: '## ' } });
					return true;
				},
			},
			{
				key: 'Mod-Alt-3',
				run: (view) => {
					const line = view.state.doc.lineAt(view.state.selection.main.from);
					view.dispatch({ changes: { from: line.from, to: line.from, insert: '### ' } });
					return true;
				},
			},
			{ key: 'Tab', run: (view) => indentListLine(view, 2) },
			{ key: 'Shift-Tab', run: (view) => indentListLine(view, -2) },
		])
	);
}
