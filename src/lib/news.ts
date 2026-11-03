import { getCollection, type CollectionEntry } from 'astro:content';
import { NEWS_CATEGORIES, NEWS_CATEGORY_IDS, type NewsCategory } from '../consts';

export type { NewsCategory };

// 1日分の束をほどいた、表示用の1記事
export interface NewsArticle {
  category: NewsCategory;
  categoryLabel: string;
  title: string;
  url: string;
  source: string;
  summary?: string;
  image?: string;
  rank?: number;
  date: Date;
}

// 前回の収集日と比べた順位の動き
export type RankDelta =
  | { kind: 'new' }
  | { kind: 'up'; by: number }
  | { kind: 'down'; by: number }
  | { kind: 'same' };

export interface RankedNewsItem {
  rank: number;
  title: string;
  url: string;
  summary?: string;
  stars?: number;
  delta: RankDelta;
}

export interface NewsRanking {
  collectedAt: Date;
  items: RankedNewsItem[];
}

// カテゴリの layout ごとに、表示に必要なものだけを持つ
export type NewsCategoryView =
  | { layout: 'list'; articles: NewsArticle[] }
  | { layout: 'ranking'; ranking: NewsRanking | null };

const RANKING_LIMIT = 10;

type NewsDay = CollectionEntry<'news'>;
type NewsDayItem = NewsDay['data']['items'][number];

export function newsCategoryList() {
  return NEWS_CATEGORY_IDS.map((id) => ({ id, ...NEWS_CATEGORIES[id] }));
}

export async function getNewsArticles(): Promise<NewsArticle[]> {
  const days = await getCollection('news');
  return days
    .flatMap(({ data }) =>
      data.items.map(
        (item): NewsArticle => ({
          category: data.category,
          categoryLabel: NEWS_CATEGORIES[data.category].label,
          title: item.title,
          url: item.url,
          source: item.source,
          summary: item.summary,
          image: item.image,
          rank: item.rank,
          // 収集元が公開日を取れないことがあるので、そのときは収集時刻で並べる
          date: item.publishedAt ?? data.collectedAt,
        }),
      ),
    )
    .sort((a, b) => b.date.valueOf() - a.date.valueOf());
}

export async function getNewsArticlesByCategory(category: NewsCategory): Promise<NewsArticle[]> {
  return (await getNewsArticles()).filter((article) => article.category === category);
}

export async function getNewsCategoryView(category: NewsCategory): Promise<NewsCategoryView> {
  if (NEWS_CATEGORIES[category].layout === 'ranking') {
    return { layout: 'ranking', ranking: await getNewsRanking(category) };
  }
  return { layout: 'list', articles: await getNewsArticlesByCategory(category) };
}

async function getNewsRanking(category: NewsCategory): Promise<NewsRanking | null> {
  const days = (await getCollection('news'))
    .filter(({ data }) => data.category === category)
    .sort((a, b) => b.data.collectedAt.valueOf() - a.data.collectedAt.valueOf());
  const [latest, previous] = days;
  if (!latest) return null;

  const items = rankedItems(latest.data.items).slice(0, RANKING_LIMIT);
  if (items.length === 0) return null;

  const before = new Map(rankedItems(previous?.data.items ?? []).map(({ url, rank }) => [url, rank]));
  // 収集が1日飛んでもいいように、日付の引き算ではなく「今日より前の最も新しい収集日」と比べる。
  // その日がまだ無いときに NEW だらけにならないよう、比較対象が空なら全件を変化なしにする
  const comparable = before.size > 0;

  return {
    collectedAt: latest.data.collectedAt,
    items: items.map(
      (item): RankedNewsItem => ({
        rank: item.rank,
        title: item.title,
        url: item.url,
        summary: item.summary,
        stars: item.stars,
        delta: comparable ? rankDelta(before.get(item.url), item.rank) : { kind: 'same' },
      }),
    ),
  };
}

function rankedItems(items: NewsDayItem[]): (NewsDayItem & { rank: number })[] {
  return items
    .flatMap((item) => (item.rank === undefined ? [] : [{ ...item, rank: item.rank }]))
    .sort((a, b) => a.rank - b.rank);
}

function rankDelta(before: number | undefined, now: number): RankDelta {
  if (before === undefined) return { kind: 'new' };
  if (before > now) return { kind: 'up', by: before - now };
  if (before < now) return { kind: 'down', by: now - before };
  return { kind: 'same' };
}
