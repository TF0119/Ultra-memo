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
	return !t || t === '無題' || t === 'New Note' || t === 'New Child' || t.startsWith('メモ ');
}
