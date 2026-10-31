import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { noteTitle } from '../lib/posts';
import { getTimeline } from '../lib/timeline';

export async function GET(context: APIContext) {
  const entries = await getTimeline();
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site!,
    // 記事は description（抜粋）、短ポストは本文全文
    items: entries.map((entry) =>
      entry.kind === 'post'
        ? {
            title: entry.post.data.title,
            description: entry.post.data.description,
            pubDate: entry.post.data.date,
            categories: entry.post.data.tags,
            link: `/posts/${entry.post.id}/`,
          }
        : {
            title: noteTitle(entry.note),
            description: entry.note.body?.trim() ?? '',
            pubDate: entry.note.data.date,
            categories: entry.note.data.tags,
            link: `/notes/${entry.note.id}/`,
          },
    ),
  });
}
