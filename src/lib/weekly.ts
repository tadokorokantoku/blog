import { getCollection } from 'astro:content';
import { marked } from 'marked';
import videoWeeks from '../content/weekly-videos.json';
import { MEDIA_ORIGIN, NEWS_CATEGORIES, NEWS_CATEGORY_IDS } from '../consts';
import { getNewsArticles, getRankingSeries, jstDay, newsTag, type NewsArticle, type NewsCategory, type NewsTag } from './news';
import { sliceTrend, trendWeekStats, type TrendSeries, type TrendWeekStats } from './trend';
import { countWeek, timelineByTag, weekOf, weekRange, type WeekId } from './week';

export type { WeekId };

export interface WeeklyNotes {
  // 1行ずつ、インラインの Markdown（`code` など）だけを HTML にしたもの
  highlightsHtml: string[];
  topics: { title: string; bodyHtml: string; links: string[] }[];
}

export interface WeeklyDigest {
  id: WeekId;
  from: string;
  to: string;
  // 隣の週。データの無い週は飛ばす
  prev?: WeekId;
  next?: WeekId;
  categories: { id: NewsCategory; label: string; count: number }[];
  tags: { id: NewsTag; label: string; color: string; count: number }[];
  // summary レイアウト（coding-agent, ade）の記事を、タグごとに古い順で
  timeline: { id: NewsTag; label: string; color: string; articles: NewsArticle[] }[];
  trend?: { series: TrendSeries; stats: TrendWeekStats };
  // src/content/news-weekly/<id>.json があるときだけ
  notes?: WeeklyNotes;
}

// 順位の推移を持つのは ranking レイアウトのカテゴリ（今は githubtrend だけ）
const RANKING = NEWS_CATEGORY_IDS.find((id) => NEWS_CATEGORIES[id].layout === 'ranking');
const TIMELINE = new Set(NEWS_CATEGORY_IDS.filter((id) => NEWS_CATEGORIES[id].layout === 'summary'));

export interface WeeklyVideoPage {
  id: WeekId;
  from: string;
  to: string;
  // 隣の週。データの無い週は飛ばす。動画の有無は見ない
  prev?: WeekId;
  next?: WeekId;
  // src/content/weekly-videos.json に載っている週だけ。動画もポスターも R2 にある
  video?: { src: string; poster: string };
}

// 記事が1件でもある週。新しい順
export async function getNewsWeeks(): Promise<WeekId[]> {
  const weeks = new Set((await getNewsArticles()).map(({ date }) => weekOf(jstDay(date))));
  return [...weeks].sort().reverse();
}

export async function getWeeklyDigest(id: WeekId): Promise<WeeklyDigest> {
  const { from, to } = weekRange(id);
  const weeks = await getNewsWeeks();
  const index = weeks.indexOf(id);
  const articles = (await getNewsArticles()).map((article) => ({ ...article, day: jstDay(article.date) }));
  const week = countWeek(articles, from, to);

  const series = RANKING ? await getRankingSeries(RANKING) : undefined;
  const trendSeries = series && sliceTrend(series, from, to);
  const entry = (await getCollection('newsWeekly')).find(({ data }) => data.week === id);

  return {
    id,
    from,
    to,
    prev: weeks[index + 1],
    next: index > 0 ? weeks[index - 1] : undefined,
    categories: week.categories.map(({ key, count }) => {
      const category = key as NewsCategory;
      return { id: category, label: NEWS_CATEGORIES[category].label, count };
    }),
    tags: week.tags.map(({ key, count }) => ({ ...newsTag(key as NewsTag), count })),
    timeline: timelineByTag(week.articles.filter(({ category }) => TIMELINE.has(category))).map(
      ({ tag, items }) => ({ ...newsTag(tag as NewsTag), articles: items }),
    ),
    trend:
      series && trendSeries && trendSeries.days.length > 0
        ? { series: trendSeries, stats: trendWeekStats(series, from, to) }
        : undefined,
    notes: entry && {
      highlightsHtml: entry.data.highlights.map((line) => marked.parseInline(line, { async: false })),
      topics: entry.data.topics.map(({ title, body, links }) => ({
        title,
        bodyHtml: marked.parse(body, { async: false }),
        links,
      })),
    },
  };
}

// 週のまとめ動画。R2 の weekly/<id>.mp4 と weekly/<id>.jpg を、一覧に載っている週だけ出す
function weeklyVideo(id: WeekId): WeeklyVideoPage['video'] {
  if (!videoWeeks.includes(id)) return undefined;
  const base = `${MEDIA_ORIGIN}/weekly/${id}`;
  return { src: `${base}.mp4`, poster: `${base}.jpg` };
}

// /news/weekly/ に出す週。動画のある一番新しい週で、動画が1本も無ければ記事のある一番新しい週
export async function getLatestVideoWeek(): Promise<WeekId | undefined> {
  const weeks = await getNewsWeeks();
  return weeks.find((week) => weeklyVideo(week)) ?? weeks[0];
}

export async function getWeeklyVideoPage(id: WeekId): Promise<WeeklyVideoPage> {
  const weeks = await getNewsWeeks();
  const index = weeks.indexOf(id);
  return {
    id,
    ...weekRange(id),
    prev: weeks[index + 1],
    next: index > 0 ? weeks[index - 1] : undefined,
    video: weeklyVideo(id),
  };
}
