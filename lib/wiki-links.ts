export const WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/g;

export function extractWikiLinks(content: string): string[] {
	const links: string[] = [];
	let match;
	const regex = new RegExp(WIKI_LINK_REGEX);
	while ((match = regex.exec(content)) !== null) {
		links.push(match[1].trim());
	}
	return links;
}

export function isPlaceholderTitle(title: string): boolean {
	const t = title.trim();
	if (!t || t === '無題' || t === 'New Note' || t === 'New Child' || t.startsWith('メモ ')) return true;
	// Quick capture timestamp titles e.g. "06/29 14:30"
	if (/^\d{1,2}\/\d{1,2} \d{1,2}:\d{2}$/.test(t)) return true;
	return false;
}
