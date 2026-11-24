import type { CollectionEntry } from 'astro:content';
import { getNotes, getPosts } from './posts';

export type TimelineEntry =
  | { kind: 'post'; post: CollectionEntry<'posts'> }
  | { kind: 'note'; note: CollectionEntry<'notes'> };

export function entryDate(entry: TimelineEntry) {
  return entry.kind === 'post' ? entry.post.data.date : entry.note.data.date;
}

// 記事と短ポストを混ぜて新しい順。同日は date の時刻で決まる
export async function getTimeline(): Promise<TimelineEntry[]> {
  const [posts, notes] = await Promise.all([getPosts(), getNotes()]);
  return [
    ...posts.map((post): TimelineEntry => ({ kind: 'post', post })),
    ...notes.map((note): TimelineEntry => ({ kind: 'note', note })),
  ].sort((a, b) => entryDate(b).valueOf() - entryDate(a).valueOf());
}
