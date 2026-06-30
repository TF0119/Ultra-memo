import { extractWikiLinks, isPlaceholderTitle } from './wiki-links';

function collectChangedWikiLinkTitles(oldContent: string, newContent: string): string[] {
	const oldLinks = extractWikiLinks(oldContent);
	const newLinks = extractWikiLinks(newContent);
	const oldSet = new Set(oldLinks.map((t) => t.toLowerCase()));
	const newSet = new Set(newLinks.map((t) => t.toLowerCase()));
	const changed: string[] = [];
	for (const title of oldLinks) {
		if (!newSet.has(title.toLowerCase())) changed.push(title);
	}
	for (const title of newLinks) {
		if (!oldSet.has(title.toLowerCase())) changed.push(title);
	}
	return changed;
}

export function deriveTitleFromContent(content: string, fallback: string): string {
	if (!isPlaceholderTitle(fallback)) return fallback;
	const firstLine = content.split('\n').find((l) => l.trim());
	if (!firstLine) return fallback;
	return firstLine.trim().replace(/^#+\s*/, '').replace(/^- \[[ x]\]\s*/, '').slice(0, 40);
}

export async function invalidateBacklinksForWikiChanges(
	resolveWikiLink: (title: string) => Promise<string | null>,
	loadBacklinks: (noteId: string) => void,
	savedNoteId: string,
	oldContent: string,
	newContent: string,
	oldTitle: string,
	newTitle: string
) {
	const changedTitles = collectChangedWikiLinkTitles(oldContent, newContent);
	const noteIds = new Set<string>();

	for (const title of changedTitles) {
		const targetId = await resolveWikiLink(title);
		if (targetId) noteIds.add(targetId);
	}

	if (oldTitle !== newTitle) {
		noteIds.add(savedNoteId);
	}

	for (const noteId of noteIds) {
		loadBacklinks(noteId);
	}
}
