// 週のまとめの集計。週は ISO 週（月曜始まり）で、日付は日本時間の YYYY-MM-DD で扱う。
// astro:content を読まない純粋関数だけを置く。読み込みは weekly.ts

import { addDays } from './trend';

// 2026-W47 の形。ISO 週なので、年末年始の数日は前後の年の週に入る
export type WeekId = `${number}-W${string}`;

const WEEK_ID = /^(\d{4})-W(\d{2})$/;

export function isWeekId(value: string): value is WeekId {
  return WEEK_ID.test(value);
}

export function weekOf(day: string): WeekId {
  const date = new Date(`${day}T00:00:00Z`);
  // 月曜を 0 にした曜日。その週の木曜が入っている年が ISO 週の年になる
  const weekday = (date.getUTCDay() + 6) % 7;
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() - weekday + 3);
  const year = thursday.getUTCFullYear();
  const dayOfYear = (thursday.valueOf() - Date.UTC(year, 0, 1)) / 86400000;
  const week = Math.floor(dayOfYear / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// 月曜〜日曜
export function weekRange(id: WeekId): { from: string; to: string } {
  const [, year, week] = WEEK_ID.exec(id) ?? [];
  // 1月4日は必ず第1週にある。そこから第1週の月曜を出して週数ぶん進める
  const jan4 = new Date(Date.UTC(Number(year), 0, 4));
  const monday = addDays(jan4.toISOString().slice(0, 10), -((jan4.getUTCDay() + 6) % 7));
  const from = addDays(monday, (Number(week) - 1) * 7);
  return { from, to: addDays(from, 6) };
}

export interface WeekArticle {
  category: string;
  tag?: string;
  url: string;
  // 日本時間の YYYY-MM-DD
  day: string;
}

export interface WeekCount<K extends string> {
  key: K;
  count: number;
}

// その週に入る記事を、カテゴリ別・タグ別に数える。0件のものは出さない。
// 同じ URL が何日も載るカテゴリ（GitHub トレンド）は延べではなく URL の数で数える
export function countWeek<A extends WeekArticle>(articles: A[], from: string, to: string) {
  const inWeek = articles.filter(({ day }) => day >= from && day <= to);
  const byCategory = new Map<string, Set<string>>();
  const byTag = new Map<string, Set<string>>();
  for (const { category, tag, url } of inWeek) {
    byCategory.set(category, (byCategory.get(category) ?? new Set()).add(url));
    if (tag) byTag.set(tag, (byTag.get(tag) ?? new Set()).add(url));
  }
  const counts = (map: Map<string, Set<string>>) =>
    [...map].map(([key, urls]) => ({ key, count: urls.size })).sort((a, b) => b.count - a.count);
  return { articles: inWeek, categories: counts(byCategory), tags: counts(byTag) };
}

// タグごとに、古い順の時系列にする。タグは件数の多い順
export function timelineByTag<A extends WeekArticle & { date: Date }>(articles: A[]) {
  const byTag = new Map<string, A[]>();
  for (const article of articles) {
    if (!article.tag) continue;
    byTag.set(article.tag, [...(byTag.get(article.tag) ?? []), article]);
  }
  return [...byTag]
    .map(([tag, items]) => ({ tag, items: items.sort((a, b) => a.date.valueOf() - b.date.valueOf()) }))
    .sort((a, b) => b.items.length - a.items.length);
}
