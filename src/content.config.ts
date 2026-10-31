import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

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
    title: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts, notes };
