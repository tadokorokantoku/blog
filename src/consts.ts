export const SITE_TITLE = 'blog';
export const SITE_DESCRIPTION = '個人ブログ';

// list は menthas 風の行、ranking は順位表
export type NewsLayout = 'list' | 'ranking';

// ニュースのカテゴリはここだけで定義する。Zod の enum・タブ・ページ生成・表示の出し分けが全部これを読む
// （public/admin/config.yml の select は YAML なので手で揃える）
export const NEWS_CATEGORIES = {
  xtrend: { label: 'X トレンド', layout: 'list' },
  githubtrend: { label: 'GitHub トレンド', layout: 'ranking' },
  'claude-code': { label: 'Claude Code', layout: 'list' },
  orca: { label: 'Orca', layout: 'list' },
} as const satisfies Record<string, { label: string; layout: NewsLayout }>;

export type NewsCategory = keyof typeof NEWS_CATEGORIES;

export const NEWS_CATEGORY_IDS = Object.keys(NEWS_CATEGORIES) as [NewsCategory, ...NewsCategory[]];
