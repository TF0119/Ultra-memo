const KEYS = {
	sortMode: 'ultra-memo:sortMode',
	followActive: 'ultra-memo:followActive',
	syncScroll: 'ultra-memo:syncScroll',
	sidebarWidth: 'ultra-memo:sidebarWidth',
	splitPosition: 'ultra-memo:splitPosition',
	splitMode: 'ultra-memo:splitMode',
	expandedNodes: 'ultra-memo:expandedNodes',
	lineWrap: 'ultra-memo:lineWrap',
} as const;

export type SortMode = 'manual' | 'recent';

export function loadSortMode(): SortMode {
	if (typeof window === 'undefined') return 'recent';
	const v = localStorage.getItem(KEYS.sortMode);
	return v === 'manual' ? 'manual' : 'recent';
}

export function saveSortMode(mode: SortMode) {
	localStorage.setItem(KEYS.sortMode, mode);
}

export function loadFollowActive(): boolean {
	if (typeof window === 'undefined') return true;
	return localStorage.getItem(KEYS.followActive) !== 'false';
}

export function saveFollowActive(enabled: boolean) {
	localStorage.setItem(KEYS.followActive, String(enabled));
}

export function loadSyncScroll(): boolean {
	if (typeof window === 'undefined') return false;
	return localStorage.getItem(KEYS.syncScroll) === 'true';
}

export function saveSyncScroll(enabled: boolean) {
	localStorage.setItem(KEYS.syncScroll, String(enabled));
}

export function loadLineWrap(): boolean {
	if (typeof window === 'undefined') return false;
	return localStorage.getItem(KEYS.lineWrap) === 'true';
}

export function saveLineWrap(enabled: boolean) {
	localStorage.setItem(KEYS.lineWrap, String(enabled));
}

export function loadSidebarWidth(): number {
	if (typeof window === 'undefined') return 280;
	const v = Number(localStorage.getItem(KEYS.sidebarWidth));
	return Number.isFinite(v) && v >= 200 && v <= 500 ? v : 280;
}

export function saveSidebarWidth(width: number) {
	localStorage.setItem(KEYS.sidebarWidth, String(Math.round(width)));
}

export function loadSplitPosition(): number {
	if (typeof window === 'undefined') return 50;
	const v = Number(localStorage.getItem(KEYS.splitPosition));
	return Number.isFinite(v) && v >= 20 && v <= 80 ? v : 50;
}

export function saveSplitPosition(percent: number) {
	localStorage.setItem(KEYS.splitPosition, String(Math.round(percent)));
}

export function loadSplitMode(): 'single' | 'split' {
	if (typeof window === 'undefined') return 'single';
	return localStorage.getItem(KEYS.splitMode) === 'split' ? 'split' : 'single';
}

export function saveSplitMode(mode: 'single' | 'split') {
	localStorage.setItem(KEYS.splitMode, mode);
}

export function loadExpandedNodes(): string[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = localStorage.getItem(KEYS.expandedNodes);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
	} catch {
		return [];
	}
}

export function saveExpandedNodes(ids: Iterable<string>) {
	localStorage.setItem(KEYS.expandedNodes, JSON.stringify([...ids]));
}

export function formatQuickCaptureTitle(): string {
	const now = new Date();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	const h = String(now.getHours()).padStart(2, '0');
	const min = String(now.getMinutes()).padStart(2, '0');
	return `${m}/${d} ${h}:${min}`;
}

export function formatRelativeTime(ts: number): string {
	const diff = Date.now() - ts;
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'たった今';
	if (mins < 60) return `${mins}分前`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}時間前`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}日前`;
	return new Date(ts).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}
