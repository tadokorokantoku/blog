// ランキングの日ごとの順位を、リポジトリごとの推移に組み替える。
// astro:content を読まない純粋関数だけを置く。読み込みは news.ts の getRankingSeries

export interface TrendDayItem {
  url: string;
  title: string;
  rank: number;
  stars?: number;
}

// 1収集日ぶん。day は日本時間の YYYY-MM-DD
export interface TrendDay {
  day: string;
  items: TrendDayItem[];
}

// 前の収集日より SURGE_THRESHOLD 位以上上がったら「急上昇」
export const SURGE_THRESHOLD = 3;

// new は前の収集日にランク外だったもの。最初の収集日は比べる相手が無いので何も付けない
export type TrendMark = { kind: 'new' } | { kind: 'surge'; by: number };

export interface TrendPoint {
  rank: number;
  stars?: number;
  mark?: TrendMark;
}

export interface TrendRepo {
  url: string;
  title: string;
  // days と同じ長さ。ランク外の日は null（線はそこで切れる）
  points: (TrendPoint | null)[];
  bestRank: number;
  daysRanked: number;
  // 範囲の最後の日の順位。その日ランク外なら undefined
  lastRank?: number;
}

export interface TrendSeries {
  days: string[];
  repos: TrendRepo[];
}

// 同じリポジトリは url で突き合わせる。title は owner が同じ名前（skills など）だとぶつかる
export function buildTrendSeries(input: TrendDay[]): TrendSeries {
  const days = [...input].sort((a, b) => a.day.localeCompare(b.day));
  const byUrl = new Map<string, { title: string; points: (TrendPoint | null)[] }>();

  days.forEach(({ items }, i) => {
    const before = i > 0 ? new Map(days[i - 1].items.map(({ url, rank }) => [url, rank])) : undefined;
    for (const item of items) {
      let repo = byUrl.get(item.url);
      if (!repo) {
        repo = { title: item.title, points: Array(days.length).fill(null) };
        byUrl.set(item.url, repo);
      }
      repo.points[i] = { rank: item.rank, stars: item.stars, mark: before && trendMark(before.get(item.url), item.rank) };
    }
  });

  return finish(
    days.map(({ day }) => day),
    [...byUrl].map(([url, { title, points }]) => ({ url, title, points })),
  );
}

function trendMark(before: number | undefined, now: number): TrendMark | undefined {
  if (before === undefined) return { kind: 'new' };
  if (before - now >= SURGE_THRESHOLD) return { kind: 'surge', by: before - now };
  return undefined;
}

// from〜to（YYYY-MM-DD、両端を含む）の収集日だけ残す。印は切り出す前の全体で付けたものをそのまま使う
export function sliceTrend(series: TrendSeries, from: string, to: string): TrendSeries {
  const keep = series.days.flatMap((day, i) => (day >= from && day <= to ? [i] : []));
  return finish(
    keep.map((i) => series.days[i]),
    series.repos.map(({ url, title, points }) => ({ url, title, points: keep.map((i) => points[i]) })),
  );
}

// 最後の収集日から数えて直近 n 日（カレンダーの日数）。収集が飛んだ日は列にならない
export function lastDays(series: TrendSeries, n: number): TrendSeries {
  const to = series.days.at(-1);
  if (!to) return series;
  return sliceTrend(series, addDays(to, -(n - 1)), to);
}

export function addDays(day: string, n: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

// 範囲に1度も出てこないリポジトリを落とし、最後の日の順位 → 最高順位 → 登場日数の順に並べる
function finish(days: string[], repos: Pick<TrendRepo, 'url' | 'title' | 'points'>[]): TrendSeries {
  const ranked = repos.flatMap((repo): TrendRepo[] => {
    const ranks = repo.points.flatMap((point) => (point ? [point.rank] : []));
    if (ranks.length === 0) return [];
    return [{ ...repo, bestRank: Math.min(...ranks), daysRanked: ranks.length, lastRank: repo.points.at(-1)?.rank }];
  });
  ranked.sort(
    (a, b) =>
      (a.lastRank ?? Infinity) - (b.lastRank ?? Infinity) || a.bestRank - b.bestRank || b.daysRanked - a.daysRanked,
  );
  return { days, repos: ranked };
}

export interface TrendWeekStats {
  // 前の7日間に1度もランク入りしていなかったもの
  newcomers: TrendRepo[];
  // 週の収集日すべてでランク入りしていたもの
  stayers: TrendRepo[];
  // 週の中の最高順位が良い順に上位5件
  best: TrendRepo[];
}

export function trendWeekStats(series: TrendSeries, from: string, to: string): TrendWeekStats {
  const week = sliceTrend(series, from, to);
  const before = new Set(sliceTrend(series, addDays(from, -7), addDays(from, -1)).repos.map(({ url }) => url));
  const byBest = [...week.repos].sort((a, b) => a.bestRank - b.bestRank || b.daysRanked - a.daysRanked);
  return {
    newcomers: byBest.filter(({ url }) => !before.has(url)),
    stayers: byBest.filter(({ daysRanked }) => week.days.length > 0 && daysRanked === week.days.length),
    best: byBest.slice(0, 5),
  };
}
