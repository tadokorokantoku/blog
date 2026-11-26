export const SITE_TITLE = 'inok';
export const SITE_DESCRIPTION = '個人ブログ';

export const PROFILE = {
  name: 'Ino Katsuki',
  role: 'Software Engineer',
  location: 'Nara -> Chiba',
  bio: ['データエンジニアやSaaSの開発をやってきました。今はSWEとして働いていて、AIに自分のポストを焼き尽くされる前に何かを為したいと思っています。1児の父。', '趣味：音楽、ゲーム、甘いもの、韓国ドラマ'],
  links: [
    { label: 'GitHub', href: 'https://github.com/tadokorokantoku' },
  ],
} as const;

// 週のまとめ動画などの置き場。R2 の blog-media バケットをこのドメインで公開している（Range に対応）
export const MEDIA_ORIGIN = 'https://media.inok.dev';

// list は menthas 風の行、ranking は順位表、summary は見出しだけ並べてクリックでモーダル
export type NewsLayout = 'list' | 'ranking' | 'summary';

// snapshot は「その日の上位」を毎日撮り直すカテゴリ。日をまたいで混ぜず、最新の収集日の分だけを順位順に出す

// ニュースのカテゴリはここだけで定義する。Zod の enum・タブ・ページ生成・表示の出し分けが全部これを読む
// （public/admin/config.yml の select は YAML なので手で揃える）
export const NEWS_CATEGORIES = {
  xtrend: { label: 'X トレンド', layout: 'list' },
  githubtrend: { label: 'GitHub トレンド', layout: 'ranking' },
  'coding-agent': { label: 'CodingAgent', layout: 'summary' },
  ade: { label: 'ADE', layout: 'summary' },
  skills: { label: 'Skills', layout: 'summary' },
  hackernews: { label: 'Hacker News', layout: 'summary', snapshot: true },
} as const satisfies Record<string, { label: string; layout: NewsLayout; snapshot?: true }>;

export type NewsCategory = keyof typeof NEWS_CATEGORIES;

export const NEWS_CATEGORY_IDS = Object.keys(NEWS_CATEGORIES) as [NewsCategory, ...NewsCategory[]];

// カテゴリの中をさらに分ける印。記事の tag に入れると、カードがこの色になり、一覧の上のチップで絞り込める
// （public/admin/config.yml の select は YAML なので手で揃える）
export const NEWS_TAGS = {
  'claude-code': { label: 'Claude Code', color: '#d97757' },
  codex: { label: 'Codex', color: '#10a37f' },
  gemini: { label: 'Gemini', color: '#4285f4' },
  grok: { label: 'Grok', color: '#9ca3af' },
  copilot: { label: 'Copilot', color: '#a371f7' },
  opencode: { label: 'OpenCode', color: '#f59e0b' },
  orca: { label: 'Orca', color: '#8b5cf6' },
  cursor: { label: 'Cursor', color: '#0ea5e9' },
  t3code: { label: 'T3 Code', color: '#ec4899' },
  devin: { label: 'Devin', color: '#14b8a6' },
  threadbear: { label: 'Threadbear', color: '#a86b3c' },
  capy: { label: 'Capy', color: '#ef4444' },
  'mattpocock-skills': { label: 'mattpocock/skills', color: '#65a30d' },
  pstack: { label: 'pstack', color: '#c026d3' },
} as const satisfies Record<string, { label: string; color: string }>;

export type NewsTag = keyof typeof NEWS_TAGS;

export const NEWS_TAG_IDS = Object.keys(NEWS_TAGS) as [NewsTag, ...NewsTag[]];
