import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { NEWS_CATEGORY_IDS, NEWS_TAG_IDS } from './consts';

// 長文記事。URL は /posts/<slug>/
const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '*/index.md' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      description: z.string(),
      tags: z.array(z.string()).default([]),
      updated: z.coerce.date().optional(),
      draft: z.boolean().default(false),
      cover: image().optional(),
    }),
});

// 短いポスト。URL は /notes/<slug>/
// title は任意（無いときは日付を見出しに使う）。date は時刻まで持つので同日に何本でも書ける
const notes = defineCollection({
  loader: glob({ base: './src/content/notes', pattern: '*/index.md' }),
  schema: z.object({
    date: z.coerce.date(),
    // Sveltia はタイトル欄を空のまま保存すると '' を書くので、無しと同じ扱いに寄せる
    title: z.string().optional().transform((v) => (v?.trim() ? v : undefined)),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

// AI が収集したニュース。1ファイルが <category>/<YYYY-MM-DD>.json で1日分の束
const news = defineCollection({
  loader: glob({ base: './src/content/news', pattern: '**/*.json' }),
  schema: z.object({
    category: z.enum(NEWS_CATEGORY_IDS),
    collectedAt: z.coerce.date(),
    items: z
      .array(
        z.object({
          title: z.string(),
          url: z.url(),
          source: z.string(),
          // カテゴリの中の分類（coding-agent なら claude-code や codex、ade なら orca）。src/consts.ts の NEWS_TAGS のどれか
          tag: z.enum(NEWS_TAG_IDS).optional(),
          summary: z.string().optional(),
          // 特筆すべき内容を Markdown で。これがある記事だけ一覧でモーダルが開く。
          // Sveltia は空欄のまま保存すると '' を書くので、無しと同じ扱いに寄せる
          detail: z
            .string()
            .optional()
            .transform((v) => (v?.trim() ? v : undefined)),
          image: z.url().optional(),
          publishedAt: z.coerce.date().optional(),
          // rank は githubtrend と hackernews、stars は githubtrend だけが使う。
          // Sveltia は数値欄を空のまま保存すると null を書くので、無しと同じ扱いに寄せる
          rank: z
            .number()
            .int()
            .positive()
            .nullish()
            .transform((v) => v ?? undefined),
          stars: z
            .number()
            .int()
            .nonnegative()
            .nullish()
            .transform((v) => v ?? undefined),
          // ここから下は hackernews だけが使う。title は日本語訳、originalTitle が HN に出ている英語の見出し
          originalTitle: z.string().optional(),
          points: z
            .number()
            .int()
            .nonnegative()
            .nullish()
            .transform((v) => v ?? undefined),
          comments: z
            .number()
            .int()
            .nonnegative()
            .nullish()
            .transform((v) => v ?? undefined),
          // HN のコメントページ（https://news.ycombinator.com/item?id=<id>）。Ask HN などリンク先が無い投稿は url もこれになる
          commentsUrl: z.url().optional(),
        }),
      )
      .default([]),
  }),
});

// 週のまとめの文章。1ファイルが <YYYY-Www>.json（ISO 週、月曜始まり、日本時間）で1週ぶん。
// 件数や時系列は news から自動で出すので、ここには人（か AI）が読んで書く部分だけを入れる。
// ファイルが無い週は自動集計だけが出る。書き方は README の「週のまとめ」
const newsWeekly = defineCollection({
  loader: glob({ base: './src/content/news-weekly', pattern: '*.json' }),
  schema: z.object({
    // ファイル名と揃える。2026-W47 の形
    week: z.string().regex(/^\d{4}-W\d{2}$/),
    // 今週の要点。1行1文で3〜5行
    highlights: z.array(z.string()).min(1).max(5),
    // 注目トピックの短い解説。body は Markdown、links はその根拠になった記事の URL
    topics: z
      .array(
        z.object({
          title: z.string(),
          body: z.string(),
          links: z.array(z.url()).default([]),
        }),
      )
      .default([]),
  }),
});

export const collections = { posts, notes, news, newsWeekly };
