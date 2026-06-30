import type { TreeNode } from './store';

export function getBreadcrumbPath(nodes: TreeNode[], nodeId: string): { id: string; title: string }[] {
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));
	const path: { id: string; title: string }[] = [];
	let currentId: string | null = nodeId;

	while (currentId) {
		const node = nodeMap.get(currentId);
		if (!node) break;
		path.unshift({ id: node.id, title: node.title });
		currentId = node.parentId;
	}

	return path;
}

export function getParentPathLabel(nodes: TreeNode[], nodeId: string, maxSegments = 2): string {
	const path = getBreadcrumbPath(nodes, nodeId);
	if (path.length <= 1) return '';
	return path
		.slice(0, -1)
		.slice(-maxSegments)
		.map((p) => p.title)
		.join(' / ');
}
