import type { Text } from '@codemirror/state';

export type MarkdownInlineDecoration =
	| { kind: 'hide'; from: number; to: number }
	| { kind: 'mark'; from: number; to: number; className: string; title?: string; href?: string }
	| { kind: 'image'; from: number; to: number; alt: string; src: string; title?: string };

export type MarkdownLineDecoration =
	| MarkdownInlineDecoration
	| { kind: 'blockquote'; from: number; to: number; depth: number }
	| { kind: 'bullet'; from: number; to: number }
	| { kind: 'number'; from: number; to: number; number: string; delimiter: string }
	| { kind: 'checkbox'; from: number; to: number; checked: boolean; marker: string }
	| { kind: 'hr'; from: number; to: number };

export interface ParsedMarkdownLine {
	lineClasses: string[];
	decorations: MarkdownLineDecoration[];
}

export interface MarkdownTable {
	headers: string[];
	aligns: Array<'left' | 'center' | 'right'>;
	rows: string[][];
}

export interface MarkdownTableRange {
	from: number;
	to: number;
	source: string;
}

interface Span {
	from: number;
	to: number;
}

const ESCAPABLE = /[\\`*{}\[\]()#+\-.!_|>~]/;

export function collectFencedCodeLineNumbers(doc: Text): Set<number> {
	const lines = new Set<number>();
	let openFence: { ch: '`' | '~'; len: number } | null = null;

	for (let i = 1; i <= doc.lines; i++) {
		const text = doc.line(i).text;
		const fence = parseFence(text);

		if (openFence) {
			lines.add(i);
			if (fence && fence.ch === openFence.ch && fence.len >= openFence.len) openFence = null;
			continue;
		}

		if (fence) {
			lines.add(i);
			openFence = fence;
		}
	}

	return lines;
}

export function isMarkdownFenceLine(text: string): boolean {
	return parseFence(text) !== null;
}

export function parseMarkdownLine(text: string, options: { isCodeLine?: boolean; isFenceLine?: boolean } = {}): ParsedMarkdownLine {
	if (options.isCodeLine) {
		return {
			lineClasses: ['cm-code-block-line'],
			decorations: options.isFenceLine ? [{ kind: 'mark', from: 0, to: text.length, className: 'cm-code-fence-line' }] : [],
		};
	}

	const lineClasses: string[] = [];
	const decorations: MarkdownLineDecoration[] = [];
	const blockquote = readBlockquotePrefix(text);

	if (blockquote.markers.length > 0) {
		const depth = Math.min(blockquote.markers.length, 6);
		lineClasses.push('cm-blockquote-line', `cm-blockquote-depth-${depth}`);
		blockquote.markers.forEach((marker, index) => {
			decorations.push({ kind: 'blockquote', from: marker.from, to: marker.to, depth: index + 1 });
		});
	}

	const contentStart = blockquote.contentStart;
	const blockIndent = countMarkdownIndent(text, contentStart);
	const blockStart = contentStart + blockIndent;
	const rawBlock = text.slice(blockStart);

	if (rawBlock.trim() && isHorizontalRule(rawBlock)) {
		const firstNonSpace = rawBlock.search(/\S/);
		const from = blockStart + (firstNonSpace < 0 ? 0 : firstNonSpace);
		lineClasses.push('cm-horizontal-rule-line');
		decorations.push({ kind: 'hr', from, to: text.length });
		return { lineClasses, decorations };
	}

	const heading = parseHeading(text, blockStart);
	if (heading) {
		lineClasses.push(`cm-heading-line-${heading.level}`);
		decorations.push({ kind: 'hide', from: heading.markerFrom, to: heading.contentFrom });
		if (heading.closingFrom !== null) decorations.push({ kind: 'hide', from: heading.closingFrom, to: text.length });
		if (heading.contentFrom < heading.contentTo) {
			decorations.push({ kind: 'mark', from: heading.contentFrom, to: heading.contentTo, className: `cm-heading-${heading.level}` });
			decorations.push(...parseMarkdownInline(text, heading.contentFrom, heading.contentTo));
		}
		return { lineClasses, decorations };
	}

	const task = /^((?:[-*+])|(?:\d{1,9}[.)]))([ \t]+)\[([ xX])\]([ \t]+)/.exec(rawBlock);
	if (task) {
		const markerEnd = blockStart + task[0].length;
		decorations.push({
			kind: 'checkbox',
			from: blockStart,
			to: markerEnd,
			checked: task[3].toLowerCase() === 'x',
			marker: task[1],
		});
		decorations.push(...parseMarkdownInline(text, markerEnd, text.length));
		return { lineClasses, decorations };
	}

	const unordered = /^([-*+])([ \t]+)/.exec(rawBlock);
	if (unordered) {
		const markerEnd = blockStart + unordered[0].length;
		decorations.push({ kind: 'bullet', from: blockStart, to: markerEnd });
		decorations.push(...parseMarkdownInline(text, markerEnd, text.length));
		return { lineClasses, decorations };
	}

	const ordered = /^(\d{1,9})([.)])([ \t]+)/.exec(rawBlock);
	if (ordered) {
		const markerEnd = blockStart + ordered[0].length;
		decorations.push({ kind: 'number', from: blockStart, to: markerEnd, number: ordered[1], delimiter: ordered[2] });
		decorations.push(...parseMarkdownInline(text, markerEnd, text.length));
		return { lineClasses, decorations };
	}

	decorations.push(...parseMarkdownInline(text, contentStart, text.length));
	return { lineClasses, decorations };
}

export function parseMarkdownInline(text: string, from = 0, to = text.length): MarkdownInlineDecoration[] {
	const decorations: MarkdownInlineDecoration[] = [];
	const reserved: Span[] = [];
	const start = Math.max(0, from);
	const end = Math.min(text.length, to);

	const addHide = (a: number, b: number) => {
		if (a < b) decorations.push({ kind: 'hide', from: a, to: b });
	};
	const addReserved = (a: number, b: number) => {
		if (a < b) reserved.push({ from: a, to: b });
	};

	collectCodeSpans(text, start, end, decorations, addReserved, addHide);
	collectLinksAndImages(text, start, end, decorations, reserved, addReserved, addHide);
	collectAutolinks(text, start, end, decorations, reserved, addReserved, addHide);
	collectEscapedCharacters(text, start, end, decorations, reserved, addReserved, addHide);
	collectBareUrls(text, start, end, decorations, reserved);
	collectDelimited(text, start, end, '***', ['cm-bold', 'cm-italic'], decorations, reserved, addReserved, addHide);
	collectDelimited(text, start, end, '___', ['cm-bold', 'cm-italic'], decorations, reserved, addReserved, addHide);
	collectDelimited(text, start, end, '~~', ['cm-strike'], decorations, reserved, addReserved, addHide);
	collectDelimited(text, start, end, '**', ['cm-bold'], decorations, reserved, addReserved, addHide);
	collectDelimited(text, start, end, '__', ['cm-bold'], decorations, reserved, addReserved, addHide);
	collectDelimited(text, start, end, '*', ['cm-italic'], decorations, reserved, addReserved, addHide);
	collectDelimited(text, start, end, '_', ['cm-italic'], decorations, reserved, addReserved, addHide);

	return decorations;
}

export function collectMarkdownTableRanges(doc: Text, codeLines = collectFencedCodeLineNumbers(doc)): MarkdownTableRange[] {
	const ranges: MarkdownTableRange[] = [];
	let i = 1;

	while (i <= doc.lines) {
		if (codeLines.has(i) || i + 1 > doc.lines || codeLines.has(i + 1)) {
			i++;
			continue;
		}

		const headerLine = doc.line(i);
		const separatorLine = doc.line(i + 1);
		const headerText = normalizeTableLine(headerLine.text);
		const separatorText = normalizeTableLine(separatorLine.text);
		const initialTable = parseMarkdownTable([headerText, separatorText].join('\n'));

		if (!initialTable) {
			i++;
			continue;
		}

		const sourceLines = [headerText, separatorText];
		let endLine = i + 1;
		let j = i + 2;

		while (j <= doc.lines && !codeLines.has(j)) {
			const bodyText = normalizeTableLine(doc.line(j).text);
			if (!isPotentialTableRow(bodyText)) break;
			sourceLines.push(bodyText);
			endLine = j;
			j++;
		}

		const last = doc.line(endLine);
		ranges.push({ from: headerLine.from, to: last.to, source: sourceLines.join('\n') });
		i = endLine + 1;
	}

	return ranges;
}

export function parseMarkdownTable(source: string): MarkdownTable | null {
	const lines = source.split('\n').filter((line) => line.trim());
	if (lines.length < 2) return null;

	const headers = splitMarkdownTableRow(lines[0]).map((cell) => cell.trim());
	const separator = splitMarkdownTableRow(lines[1]);
	if (headers.length < 2 || separator.length < 2) return null;

	const aligns = separator.map(parseTableAlignment);
	if (aligns.some((align) => align === null)) return null;

	const columnCount = Math.max(headers.length, separator.length);
	const normalizedHeaders = normalizeCells(headers, columnCount);
	const normalizedAligns = normalizeCells(aligns as Array<'left' | 'center' | 'right'>, columnCount, 'left');
	const rows = lines.slice(2).map((line) => normalizeCells(splitMarkdownTableRow(line).map((cell) => cell.trim()), columnCount));

	return { headers: normalizedHeaders, aligns: normalizedAligns, rows };
}

export function appendMarkdownInline(parent: HTMLElement, text: string): void {
	const doc = parent.ownerDocument;
	const tokens = parseMarkdownInline(text);
	const hidden = tokens.filter((token): token is Extract<MarkdownInlineDecoration, { kind: 'hide' }> => token.kind === 'hide');
	const images = tokens.filter((token): token is Extract<MarkdownInlineDecoration, { kind: 'image' }> => token.kind === 'image');
	const marks = tokens.filter((token): token is Extract<MarkdownInlineDecoration, { kind: 'mark' }> => token.kind === 'mark');
	const boundaries = new Set<number>([0, text.length]);

	for (const token of tokens) {
		boundaries.add(token.from);
		boundaries.add(token.to);
	}

	const sortedBoundaries = [...boundaries].filter((n) => n >= 0 && n <= text.length).sort((a, b) => a - b);
	let pos = 0;

	while (pos < text.length) {
		const image = images.find((token) => token.from === pos);
		if (image) {
			parent.appendChild(createImageElement(doc, image));
			pos = image.to;
			continue;
		}

		const hiddenRange = hidden.find((token) => token.from <= pos && pos < token.to);
		if (hiddenRange) {
			pos = hiddenRange.to;
			continue;
		}

		const nextBoundary = sortedBoundaries.find((n) => n > pos) ?? text.length;
		if (nextBoundary <= pos) {
			pos++;
			continue;
		}

		const activeMarks = marks.filter((mark) => mark.from <= pos && nextBoundary <= mark.to);
		parent.appendChild(wrapInlineText(doc, text.slice(pos, nextBoundary), activeMarks));
		pos = nextBoundary;
	}
}

function parseFence(text: string): { ch: '`' | '~'; len: number } | null {
	const match = /^ {0,3}(`{3,}|~{3,})/.exec(text);
	if (!match) return null;
	return { ch: match[1][0] as '`' | '~', len: match[1].length };
}

function readBlockquotePrefix(text: string): { markers: Span[]; contentStart: number } {
	const markers: Span[] = [];
	let pos = 0;

	while (pos < text.length) {
		const markerStart = pos;
		let p = pos;
		let spaces = 0;
		while (p < text.length && text[p] === ' ' && spaces < 3) {
			p++;
			spaces++;
		}
		if (text[p] !== '>') break;
		p++;
		if (text[p] === ' ' || text[p] === '\t') p++;
		markers.push({ from: markerStart, to: p });
		pos = p;
	}

	return { markers, contentStart: pos };
}

function normalizeTableLine(text: string): string {
	return text.slice(readBlockquotePrefix(text).contentStart);
}

function countMarkdownIndent(text: string, pos: number): number {
	let count = 0;
	while (pos + count < text.length && text[pos + count] === ' ' && count < 3) count++;
	return count;
}

function parseHeading(text: string, from: number) {
	const match = /^(#{1,6})(?:[ \t]+|$)/.exec(text.slice(from));
	if (!match) return null;
	const markerFrom = from;
	const contentFrom = from + match[0].length;
	let contentTo = text.length;
	let closingFrom: number | null = null;
	const closingMatch = /[ \t]+#{1,}[ \t]*$/.exec(text.slice(contentFrom));
	if (closingMatch) {
		closingFrom = contentFrom + closingMatch.index;
		contentTo = closingFrom;
	}
	return {
		level: match[1].length,
		markerFrom,
		contentFrom,
		contentTo,
		closingFrom,
	};
}

function isHorizontalRule(text: string): boolean {
	const compact = text.trim().replace(/[ \t]/g, '');
	return /^-{3,}$/.test(compact) || /^\*{3,}$/.test(compact) || /^_{3,}$/.test(compact);
}

function collectCodeSpans(
	text: string,
	from: number,
	to: number,
	decorations: MarkdownInlineDecoration[],
	addReserved: (from: number, to: number) => void,
	addHide: (from: number, to: number) => void
) {
	let pos = from;
	while (pos < to) {
		if (text[pos] !== '`' || isEscaped(text, pos)) {
			pos++;
			continue;
		}
		const tickCount = countRun(text, pos, '`');
		let close = pos + tickCount;
		while (close < to) {
			const found = text.indexOf('`'.repeat(tickCount), close);
			if (found < 0 || found + tickCount > to) {
				close = -1;
				break;
			}
			if (!isEscaped(text, found)) {
				close = found;
				break;
			}
			close = found + 1;
		}
		if (close < 0 || close <= pos + tickCount) {
			pos += tickCount;
			continue;
		}
		addHide(pos, pos + tickCount);
		decorations.push({ kind: 'mark', from: pos + tickCount, to: close, className: 'cm-inline-code' });
		addHide(close, close + tickCount);
		addReserved(pos, close + tickCount);
		pos = close + tickCount;
	}
}

function collectLinksAndImages(
	text: string,
	from: number,
	to: number,
	decorations: MarkdownInlineDecoration[],
	reserved: Span[],
	addReserved: (from: number, to: number) => void,
	addHide: (from: number, to: number) => void
) {
	let pos = from;
	while (pos < to) {
		const isImage = text[pos] === '!' && text[pos + 1] === '[' && !isEscaped(text, pos) && !intersectsAny(pos, pos + 2, reserved);
		const isLink = text[pos] === '[' && !isEscaped(text, pos) && !intersectsAny(pos, pos + 1, reserved);
		if (!isImage && !isLink) {
			pos++;
			continue;
		}

		const labelOpen = isImage ? pos + 1 : pos;
		const labelClose = findClosingBracket(text, labelOpen, to);
		if (labelClose < 0 || text[labelClose + 1] !== '(') {
			pos++;
			continue;
		}
		const destination = findClosingParen(text, labelClose + 1, to);
		if (!destination) {
			pos++;
			continue;
		}

		const labelFrom = labelOpen + 1;
		const labelTo = labelClose;
		const tokenTo = destination.close + 1;
		const target = parseLinkTarget(text.slice(labelClose + 2, destination.close));
		const label = text.slice(labelFrom, labelTo);

		if (isImage) {
			decorations.push({ kind: 'image', from: pos, to: tokenTo, alt: label, src: target.href, title: target.title });
			addReserved(pos, tokenTo);
		} else {
			addHide(pos, labelFrom);
			addHide(labelTo, labelClose + 2);
			addHide(labelClose + 2, tokenTo);
			addReserved(pos, labelFrom);
			addReserved(labelTo, tokenTo);
			if (labelFrom < labelTo) {
				decorations.push({ kind: 'mark', from: labelFrom, to: labelTo, className: 'cm-link', title: target.title ?? target.href, href: target.href });
			}
		}

		pos = tokenTo;
	}
}

function collectAutolinks(
	text: string,
	from: number,
	to: number,
	decorations: MarkdownInlineDecoration[],
	reserved: Span[],
	addReserved: (from: number, to: number) => void,
	addHide: (from: number, to: number) => void
) {
	let pos = from;
	while (pos < to) {
		if (text[pos] !== '<' || isEscaped(text, pos) || intersectsAny(pos, pos + 1, reserved)) {
			pos++;
			continue;
		}
		const close = text.indexOf('>', pos + 1);
		if (close < 0 || close >= to || intersectsAny(pos, close + 1, reserved)) {
			pos++;
			continue;
		}
		const value = text.slice(pos + 1, close);
		const href = autolinkHref(value);
		if (!href) {
			pos++;
			continue;
		}
		addHide(pos, pos + 1);
		decorations.push({ kind: 'mark', from: pos + 1, to: close, className: 'cm-link', title: href, href });
		addHide(close, close + 1);
		addReserved(pos, pos + 1);
		addReserved(close, close + 1);
		pos = close + 1;
	}
}

function collectEscapedCharacters(
	text: string,
	from: number,
	to: number,
	decorations: MarkdownInlineDecoration[],
	reserved: Span[],
	addReserved: (from: number, to: number) => void,
	addHide: (from: number, to: number) => void
) {
	for (let pos = from; pos + 1 < to; pos++) {
		if (text[pos] !== '\\' || intersectsAny(pos, pos + 1, reserved)) continue;
		if (!ESCAPABLE.test(text[pos + 1])) continue;
		addHide(pos, pos + 1);
		addReserved(pos, pos + 1);
		pos++;
	}
}

function collectBareUrls(text: string, from: number, to: number, decorations: MarkdownInlineDecoration[], reserved: Span[]) {
	const urlRe = /https?:\/\/[^\s<>\]]+/g;
	urlRe.lastIndex = from;
	let match: RegExpExecArray | null;
	while ((match = urlRe.exec(text)) !== null) {
		if (match.index >= to) break;
		let end = Math.min(match.index + match[0].length, to);
		end = trimUrlEnd(text, match.index, end);
		if (end <= match.index || intersectsAny(match.index, end, reserved)) continue;
		const href = text.slice(match.index, end);
		decorations.push({ kind: 'mark', from: match.index, to: end, className: 'cm-link', title: href, href });
	}
}

function collectDelimited(
	text: string,
	from: number,
	to: number,
	delimiter: string,
	classNames: string[],
	decorations: MarkdownInlineDecoration[],
	reserved: Span[],
	addReserved: (from: number, to: number) => void,
	addHide: (from: number, to: number) => void
) {
	let pos = from;
	while (pos < to) {
		const open = findDelimiter(text, delimiter, pos, to, reserved, true);
		if (open < 0) return;
		const close = findDelimiter(text, delimiter, open + delimiter.length, to, reserved, false);
		if (close < 0) return;
		const contentFrom = open + delimiter.length;
		const contentTo = close;
		if (!text.slice(contentFrom, contentTo).trim()) {
			pos = open + delimiter.length;
			continue;
		}
		addHide(open, contentFrom);
		for (const className of classNames) {
			decorations.push({ kind: 'mark', from: contentFrom, to: contentTo, className });
		}
		addHide(close, close + delimiter.length);
		addReserved(open, contentFrom);
		addReserved(close, close + delimiter.length);
		pos = close + delimiter.length;
	}
}

function findDelimiter(text: string, delimiter: string, from: number, to: number, reserved: Span[], opening: boolean): number {
	let pos = from;
	while (pos < to) {
		const found = text.indexOf(delimiter, pos);
		if (found < 0 || found + delimiter.length > to) return -1;
		if (
			!isEscaped(text, found) &&
			!intersectsAny(found, found + delimiter.length, reserved) &&
			isValidDelimiterBoundary(text, found, delimiter, opening)
		) {
			return found;
		}
		pos = found + 1;
	}
	return -1;
}

function isValidDelimiterBoundary(text: string, pos: number, delimiter: string, opening: boolean): boolean {
	const before = text[pos - 1] ?? '';
	const after = text[pos + delimiter.length] ?? '';
	const ch = delimiter[0];

	if (delimiter.length === 1 && (text[pos - 1] === ch || text[pos + 1] === ch)) return false;
	if (ch === '_' && isWord(before) && isWord(after)) return false;
	if (opening) return !!after && !/\s/.test(after);
	return !!before && !/\s/.test(before);
}

function findClosingBracket(text: string, open: number, to: number): number {
	let depth = 0;
	for (let pos = open; pos < to; pos++) {
		if (isEscaped(text, pos)) continue;
		if (text[pos] === '[') depth++;
		if (text[pos] === ']') {
			depth--;
			if (depth === 0) return pos;
		}
	}
	return -1;
}

function findClosingParen(text: string, open: number, to: number): { close: number } | null {
	let depth = 0;
	let quote: '"' | "'" | null = null;
	for (let pos = open; pos < to; pos++) {
		const ch = text[pos];
		if (isEscaped(text, pos)) continue;
		if (quote) {
			if (ch === quote) quote = null;
			continue;
		}
		if (ch === '"' || ch === "'") {
			quote = ch;
			continue;
		}
		if (ch === '(') depth++;
		if (ch === ')') {
			depth--;
			if (depth === 0) return { close: pos };
		}
	}
	return null;
}

function parseLinkTarget(raw: string): { href: string; title?: string } {
	const trimmed = raw.trim();
	const titleMatch = /^(.+?)[ \t]+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\))[ \t]*$/.exec(trimmed);
	const hrefRaw = titleMatch ? titleMatch[1].trim() : trimmed;
	const href = stripAngleDestination(hrefRaw);
	return {
		href: unescapeMarkdownText(href),
		title: titleMatch ? unescapeMarkdownText(titleMatch[2] ?? titleMatch[3] ?? titleMatch[4] ?? '') : undefined,
	};
}

function stripAngleDestination(value: string): string {
	return value.startsWith('<') && value.endsWith('>') ? value.slice(1, -1) : value;
}

function autolinkHref(value: string): string | null {
	if (/^[a-z][a-z0-9+.-]{1,31}:[^\s<>]*$/i.test(value)) return value;
	if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) return `mailto:${value}`;
	return null;
}

function trimUrlEnd(text: string, from: number, to: number): number {
	let end = to;
	while (end > from && /[.,!?;:]/.test(text[end - 1])) end--;
	while (end > from && text[end - 1] === ')' && countChar(text.slice(from, end), '(') < countChar(text.slice(from, end), ')')) end--;
	return end;
}

function splitMarkdownTableRow(line: string): string[] {
	const cells: string[] = [];
	let current = '';
	let codeTicks = 0;
	let pos = 0;

	while (pos < line.length) {
		const ch = line[pos];
		if (ch === '`' && !isEscaped(line, pos)) {
			const ticks = countRun(line, pos, '`');
			if (codeTicks === 0) codeTicks = ticks;
			else if (ticks === codeTicks) codeTicks = 0;
			current += line.slice(pos, pos + ticks);
			pos += ticks;
			continue;
		}
		if (ch === '|' && codeTicks === 0 && !isEscaped(line, pos)) {
			cells.push(current);
			current = '';
			pos++;
			continue;
		}
		current += ch;
		pos++;
	}

	cells.push(current);
	if (cells.length > 1 && cells[0].trim() === '') cells.shift();
	if (cells.length > 1 && cells[cells.length - 1].trim() === '') cells.pop();
	return cells;
}

function isPotentialTableRow(text: string): boolean {
	return splitMarkdownTableRow(text).length > 1 && text.trim().length > 0;
}

function parseTableAlignment(cell: string): 'left' | 'center' | 'right' | null {
	const compact = cell.trim().replace(/[ \t]/g, '');
	const match = /^(:)?-{3,}(:)?$/.exec(compact);
	if (!match) return null;
	if (match[1] && match[2]) return 'center';
	if (match[2]) return 'right';
	return 'left';
}

function normalizeCells<T>(cells: T[], columnCount: number, fallback = '' as T): T[] {
	return Array.from({ length: columnCount }, (_, index) => cells[index] ?? fallback);
}

function createImageElement(doc: Document, image: Extract<MarkdownInlineDecoration, { kind: 'image' }>): HTMLElement {
	const span = doc.createElement('span');
	span.className = 'cm-md-image';
	span.title = image.title ?? image.src;

	if (!isSafeImageSrc(image.src)) {
		span.textContent = image.alt || image.src;
		return span;
	}

	const img = doc.createElement('img');
	img.src = image.src;
	img.alt = image.alt;
	img.loading = 'lazy';
	if (image.title) img.title = image.title;
	span.appendChild(img);

	if (image.alt) {
		const caption = doc.createElement('span');
		caption.className = 'cm-md-image-alt';
		caption.textContent = image.alt;
		span.appendChild(caption);
	}

	return span;
}

function wrapInlineText(doc: Document, value: string, marks: Extract<MarkdownInlineDecoration, { kind: 'mark' }>[]): Node {
	const uniqueMarks = dedupeMarks(marks).sort((a, b) => markPriority(a.className) - markPriority(b.className));
	let node: Node = doc.createTextNode(value);

	for (let i = uniqueMarks.length - 1; i >= 0; i--) {
		const mark = uniqueMarks[i];
		const el = createMarkElement(doc, mark);
		el.appendChild(node);
		node = el;
	}

	return node;
}

function createMarkElement(doc: Document, mark: Extract<MarkdownInlineDecoration, { kind: 'mark' }>): HTMLElement {
	if (mark.className === 'cm-bold') {
		const el = doc.createElement('strong');
		el.className = mark.className;
		return el;
	}
	if (mark.className === 'cm-italic') {
		const el = doc.createElement('em');
		el.className = mark.className;
		return el;
	}
	if (mark.className === 'cm-strike') {
		const el = doc.createElement('s');
		el.className = mark.className;
		return el;
	}
	if (mark.className === 'cm-inline-code') {
		const el = doc.createElement('code');
		el.className = mark.className;
		return el;
	}
	if (mark.className === 'cm-link') {
		const el = doc.createElement('a');
		el.className = mark.className;
		el.title = mark.title ?? mark.href ?? '';
		if (mark.href && isSafeHref(mark.href)) {
			el.href = mark.href;
			if (/^https?:\/\//i.test(mark.href)) {
				el.target = '_blank';
				el.rel = 'noreferrer';
			}
		}
		return el;
	}

	const el = doc.createElement('span');
	el.className = mark.className;
	if (mark.title) el.title = mark.title;
	return el;
}

function dedupeMarks(marks: Extract<MarkdownInlineDecoration, { kind: 'mark' }>[]) {
	const seen = new Set<string>();
	return marks.filter((mark) => {
		const key = `${mark.className}:${mark.href ?? ''}:${mark.title ?? ''}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function markPriority(className: string): number {
	if (className === 'cm-link') return 1;
	if (className === 'cm-bold') return 2;
	if (className === 'cm-italic') return 3;
	if (className === 'cm-strike') return 4;
	if (className === 'cm-inline-code') return 5;
	return 10;
}

function isSafeHref(href: string): boolean {
	return /^(https?:|mailto:|#|\/|\.\/|\.\.\/)/i.test(href);
}

function isSafeImageSrc(src: string): boolean {
	return /^(https?:|data:image\/|file:|\/|\.\/|\.\.\/)/i.test(src);
}

function unescapeMarkdownText(value: string): string {
	return value.replace(/\\([\\`*{}\[\]()#+\-.!_|>~])/g, '$1');
}

function isEscaped(text: string, pos: number): boolean {
	let slashCount = 0;
	for (let i = pos - 1; i >= 0 && text[i] === '\\'; i--) slashCount++;
	return slashCount % 2 === 1;
}

function intersectsAny(from: number, to: number, ranges: Span[]): boolean {
	return ranges.some((range) => from < range.to && to > range.from);
}

function countRun(text: string, from: number, ch: string): number {
	let count = 0;
	while (text[from + count] === ch) count++;
	return count;
}

function countChar(value: string, ch: string): number {
	let count = 0;
	for (const c of value) if (c === ch) count++;
	return count;
}

function isWord(ch: string): boolean {
	return /^[A-Za-z0-9]$/.test(ch);
}
