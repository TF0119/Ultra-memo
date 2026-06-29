import { EditorView, keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { insertNewlineAndIndent } from '@codemirror/commands';

/** Continue markdown lists and checkboxes on Enter — natural typing flow. */
export function markdownContinueKeymap() {
	return Prec.high(
		keymap.of([
		{
			key: 'Enter',
			run: (view) => {
				const { state } = view;
				const line = state.doc.lineAt(state.selection.main.head);
				const text = line.text;

				// Heading: # title
				const headingMatch = /^(\s*)(#{1,6})\s+(.*)$/.exec(text);
				if (headingMatch) {
					const indent = headingMatch[1];
					const hashes = headingMatch[2];
					const content = headingMatch[3];
					if (content.trim() === '') {
						view.dispatch({
							changes: { from: line.from, to: line.to, insert: indent },
							selection: { anchor: line.from + indent.length },
						});
						return true;
					}
					return insertWithPrefix(view, `${indent}${hashes} `);
				}

				// Checkbox: - [ ] or - [x]
				const cbMatch = /^(\s*)- \[[ xX]\] (.*)$/.exec(text);
				if (cbMatch) {
					const indent = cbMatch[1];
					const content = cbMatch[2];
					if (content.trim() === '') {
						view.dispatch({
							changes: { from: line.from, to: line.to, insert: indent },
							selection: { anchor: line.from + indent.length },
						});
						return true;
					}
					return insertWithPrefix(view, `${indent}- [ ] `);
				}

				// Unordered list: - item
				const ulMatch = /^(\s*)([-*+]) (.*)$/.exec(text);
				if (ulMatch) {
					const indent = ulMatch[1];
					const content = ulMatch[3];
					if (content.trim() === '') {
						view.dispatch({
							changes: { from: line.from, to: line.to, insert: indent },
							selection: { anchor: line.from + indent.length },
						});
						return true;
					}
					return insertWithPrefix(view, `${indent}${ulMatch[2]} `);
				}

				// Ordered list: 1. item
				const olMatch = /^(\s*)(\d+)\. (.*)$/.exec(text);
				if (olMatch) {
					const indent = olMatch[1];
					const num = parseInt(olMatch[2], 10);
					const content = olMatch[3];
					if (content.trim() === '') {
						view.dispatch({
							changes: { from: line.from, to: line.to, insert: indent },
							selection: { anchor: line.from + indent.length },
						});
						return true;
					}
					return insertWithPrefix(view, `${indent}${num + 1}. `);
				}

				// Blockquote: > text
				const bqMatch = /^(\s*)> (.*)$/.exec(text);
				if (bqMatch) {
					const indent = bqMatch[1];
					const content = bqMatch[2];
					if (content.trim() === '') {
						view.dispatch({
							changes: { from: line.from, to: line.to, insert: indent },
							selection: { anchor: line.from + indent.length },
						});
						return true;
					}
					return insertWithPrefix(view, `${indent}> `);
				}

				return false;
			},
		},
		{
			key: 'Mod-Enter',
			run: (view) => {
				// Soft line break without list continuation
				const pos = view.state.selection.main.head;
				view.dispatch({
					changes: { from: pos, insert: '\n' },
					selection: { anchor: pos + 1 },
				});
				return true;
			},
		},
		])
	);
}

function insertWithPrefix(view: EditorView, prefix: string): boolean {
	const pos = view.state.selection.main.head;
	const line = view.state.doc.lineAt(pos);
	const insert = `\n${prefix}`;
	view.dispatch({
		changes: { from: pos, insert },
		selection: { anchor: pos + insert.length },
	});
	return true;
}
