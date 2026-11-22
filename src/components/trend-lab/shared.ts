// 推移グラフの3案（バンプ・カード・ヒートマップ）が共通で使う、見せ方のための小さな関数
import type { TrendMark, TrendRepo, TrendSeries } from '../../lib/trend';

// 色を付けるのは最終日の上位このぶんだけ。dataviz の検証済みパレットが8色なので、それ以上は増やさない
export const FEATURED = 8;

// 最終日にランク入りしているリポジトリを順位順に。色の番号（1〜）もここで決める
export function featured(series: TrendSeries, limit = FEATURED) {
  return series.repos
    .filter((repo) => repo.lastRank !== undefined)
    .sort((a, b) => (a.lastRank ?? 0) - (b.lastRank ?? 0))
    .slice(0, limit)
    .map((repo, i) => ({ repo, color: i + 1 }));
}

// 最終日の印だけをバッジにする。途中の日の印は出さない
export function badge(repo: TrendRepo): { text: string; kind: TrendMark['kind'] } | undefined {
  const mark = repo.points.at(-1)?.mark;
  if (mark?.kind === 'new') return { text: 'NEW', kind: 'new' };
  if (mark?.kind === 'surge') return { text: `↑${mark.by}`, kind: 'surge' };
  return undefined;
}

const MD = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', timeZone: 'UTC' });

export function shortDay(day: string) {
  return MD.format(new Date(`${day}T00:00:00Z`));
}

// owner/name の name だけ
export function repoName(title: string) {
  return title.split('/').at(-1) ?? title;
}

export function stars(value: number | undefined) {
  return value === undefined ? undefined : `★${value.toLocaleString('ja-JP')}`;
}
