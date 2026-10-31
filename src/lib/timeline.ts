import type { CollectionEntry } from 'astro:content';
import { getNotes, getPosts } from './posts';

export type TimelineEntry =
  | { kind: 'post'; post: CollectionEntry<'posts'> }
  | { kind: 'note'; note: CollectionEntry<'notes'> };

export interface TimelineYear {
  year: number;
  entries: TimelineEntry[];
}

export function entryDate(entry: TimelineEntry) {
  return entry.kind === 'post' ? entry.post.data.date : entry.note.data.date;
}

export function entryTags(entry: TimelineEntry) {
  return entry.kind === 'post' ? entry.post.data.tags : entry.note.data.tags;
}

// 記事と短ポストを混ぜて新しい順。同日は date の時刻で決まる
export async function getTimeline(): Promise<TimelineEntry[]> {
  const [posts, notes] = await Promise.all([getPosts(), getNotes()]);
  return [
    ...posts.map((post): TimelineEntry => ({ kind: 'post', post })),
    ...notes.map((note): TimelineEntry => ({ kind: 'note', note })),
  ].sort((a, b) => entryDate(b).valueOf() - entryDate(a).valueOf());
}

// 絞り込みのチップ用。名前順
export function countTags(entries: TimelineEntry[]) {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entryTags(entry)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => a.localeCompare(b, 'ja')).map(([tag, count]) => ({ tag, count }));
}

export function groupByYear(entries: TimelineEntry[]): TimelineYear[] {
  const years = new Map<number, TimelineEntry[]>();
  for (const entry of entries) {
    const year = entryDate(entry).getFullYear();
    const bucket = years.get(year);
    if (bucket) bucket.push(entry);
    else years.set(year, [entry]);
  }
  return [...years]
    .sort(([a], [b]) => b - a)
    .map(([year, yearEntries]) => ({ year, entries: yearEntries }));
}
