export const SITE_TITLE = 'blog';
export const SITE_DESCRIPTION = '個人ブログ';

// ニュースのカテゴリはここだけで定義する。Zod の enum・タブ・ページ生成が全部これを読む
// （public/admin/config.yml の select は YAML なので手で揃える）
export const NEWS_CATEGORIES = {
  xtrend: 'X トレンド',
  githubtrend: 'GitHub トレンド',
  'claude-code': 'Claude Code',
  orca: 'Orca',
} as const;

export type NewsCategory = keyof typeof NEWS_CATEGORIES;

export const NEWS_CATEGORY_IDS = Object.keys(NEWS_CATEGORIES) as [NewsCategory, ...NewsCategory[]];
