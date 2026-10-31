import { getCollection, type CollectionEntry } from 'astro:content';

// draft は本番ビルドから除外し、dev では表示する
const published = ({ data }: { data: { draft: boolean } }) => import.meta.env.DEV || !data.draft;

const byDateDesc = (a: { data: { date: Date } }, b: { data: { date: Date } }) =>
  b.data.date.valueOf() - a.data.date.valueOf();

export async function getPosts() {
  return (await getCollection('posts', published)).sort(byDateDesc);
}

export async function getNotes() {
  return (await getCollection('notes', published)).sort(byDateDesc);
}

export function formatDate(date: Date) {
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// 年見出しで年を出しているので、タイムライン内では月日だけ出す
export function formatMonthDay(date: Date) {
  return date.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' });
}

// title は任意なので、無いときは日付が見出しになる
export function noteTitle(note: CollectionEntry<'notes'>) {
  return note.data.title ?? formatDate(note.data.date);
}

// meta description 用。Markdown 記法は残るが抜粋としては十分
export function excerpt(body: string | undefined, max = 120) {
  const text = (body ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
