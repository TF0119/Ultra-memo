export interface Template {
	id: string;
	name: string;
	content: string;
}

export const TEMPLATES: Template[] = [
	{
		id: 'blank',
		name: '空白',
		content: '',
	},
	{
		id: 'quick',
		name: '一言メモ',
		content: '',
	},
	{
		id: 'daily',
		name: '日次メモ',
		content: `# {{date}}

## やったこと

## メモ

`,
	},
	{
		id: 'todo',
		name: 'チェックリスト',
		content: `# タスク

- [ ] 
- [ ] 
- [ ] 
`,
	},
	{
		id: 'meeting',
		name: '会議メモ',
		content: `# 会議 {{date}}

## 参加者

## 議題

## 決定事項

## 次のアクション
`,
	},
];

export function applyTemplate(template: Template): string {
	const now = new Date();
	const date = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
	const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
	return template.content.replace(/\{\{date\}\}/g, date).replace(/\{\{time\}\}/g, time);
}
