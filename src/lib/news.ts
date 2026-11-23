import { getCollection, type CollectionEntry } from 'astro:content';
import { marked } from 'marked';
import { NEWS_CATEGORIES, NEWS_CATEGORY_IDS, NEWS_TAGS, type NewsCategory, type NewsTag } from '../consts';
import { buildTrendSeries, type TrendSeries } from './trend';

export type { NewsCategory, NewsTag };

// 1日分の束をほどいた、表示用の1記事
export interface NewsArticle {
  category: NewsCategory;
  categoryLabel: string;
  title: string;
  url: string;
  source: string;
  tag?: NewsTag;
  summary?: string;
  // JSON に書かれた素の Markdown。表示側に渡す前に detailHtml へ変換する
  detail?: string;
  image?: string;
  rank?: number;
  // hackernews だけ。英語の見出し・ポイント・コメント数・HN のコメントページ
  originalTitle?: string;
  points?: number;
  comments?: number;
  commentsUrl?: string;
  // 個別ポストの URL のときだけ入る。トレンドの話題ページは埋め込めない
  xPost?: string;
  date: Date;
}

// summary レイアウトの1記事。生 Markdown を持たせないので、変換はこのファイルの中だけで起きる
export type NewsSummaryArticle = Omit<NewsArticle, 'detail'> & { detailHtml?: string };

const X_POST = /^https:\/\/(?:x|twitter)\.com\/[^/]+\/status\/\d+/;

export function xPostUrl(url: string) {
  return X_POST.test(url) ? url : undefined;
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
  | { layout: 'ranking'; ranking: NewsRanking | null; series: TrendSeries }
  | { layout: 'summary'; articles: NewsSummaryArticle[] };

// どのカテゴリも新しい順にこの件数まで
const NEWS_LIMIT = 15;

type NewsDay = CollectionEntry<'news'>;
type NewsDayItem = NewsDay['data']['items'][number];

export function newsCategoryList() {
  return NEWS_CATEGORY_IDS.map((id) => ({ id, ...NEWS_CATEGORIES[id] }));
}

export async function getNewsArticles(): Promise<NewsArticle[]> {
  const days = await getCollection('news');
  return days.flatMap(dayArticles).sort((a, b) => b.date.valueOf() - a.date.valueOf());
}

function dayArticles({ data }: NewsDay): NewsArticle[] {
  return data.items.map(
    (item): NewsArticle => ({
      category: data.category,
      categoryLabel: NEWS_CATEGORIES[data.category].label,
      title: item.title,
      url: item.url,
      source: item.source,
      tag: item.tag,
      summary: item.summary,
      detail: item.detail,
      image: item.image,
      rank: item.rank,
      originalTitle: item.originalTitle,
      points: item.points,
      comments: item.comments,
      commentsUrl: item.commentsUrl,
      xPost: xPostUrl(item.url),
      // 収集元が公開日を取れないことがあるので、そのときは収集時刻で並べる
      date: item.publishedAt ?? data.collectedAt,
    }),
  );
}

export async function getNewsArticlesByCategory(category: NewsCategory): Promise<NewsArticle[]> {
  if ('snapshot' in NEWS_CATEGORIES[category]) return getSnapshotArticles(category);
  return (await getNewsArticles())
    .filter((article) => article.category === category)
    .slice(0, NEWS_LIMIT);
}

// 最新の収集日の分だけを、その日の順位どおりに全部
async function getSnapshotArticles(category: NewsCategory): Promise<NewsArticle[]> {
  const [latest] = (await getCollection('news'))
    .filter(({ data }) => data.category === category)
    .sort((a, b) => b.data.collectedAt.valueOf() - a.data.collectedAt.valueOf());
  if (!latest) return [];
  return dayArticles(latest).sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
}

export async function getNewsCategoryView(category: NewsCategory): Promise<NewsCategoryView> {
  const { layout } = NEWS_CATEGORIES[category];
  if (layout === 'ranking') {
    return { layout: 'ranking', ranking: await getNewsRanking(category), series: await getRankingSeries(category) };
  }
  if (layout === 'summary') {
    const articles = (await getNewsArticlesByCategory(category)).map(
      ({ detail, ...article }): NewsSummaryArticle => ({
        ...article,
        // Shiki は通らないので、フェンスコードブロックに色は付かない
        detailHtml: detail === undefined ? undefined : marked.parse(detail, { async: false }),
      }),
    );
    return { layout: 'summary', articles };
  }
  return { layout: 'list', articles: await getNewsArticlesByCategory(category) };
}

async function getNewsRanking(category: NewsCategory): Promise<NewsRanking | null> {
  const days = (await getCollection('news'))
    .filter(({ data }) => data.category === category)
    .sort((a, b) => b.data.collectedAt.valueOf() - a.data.collectedAt.valueOf());
  const [latest, previous] = days;
  if (!latest) return null;

  const items = rankedItems(latest.data.items).slice(0, NEWS_LIMIT);
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

// 全収集日の順位を、リポジトリごとの推移にする（推移グラフと週のまとめが使う）
export async function getRankingSeries(category: NewsCategory): Promise<TrendSeries> {
  const days = (await getCollection('news')).filter(({ data }) => data.category === category);
  return buildTrendSeries(
    days.map(({ data }) => ({
      day: jstDay(data.collectedAt),
      items: rankedItems(data.items).map(({ url, title, rank, stars }) => ({ url, title, rank, stars })),
    })),
  );
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

export function newsTag(tag: NewsTag) {
  return { id: tag, ...NEWS_TAGS[tag] };
}

// 日本時間の YYYY-MM-DD。Today の判定はこの形で比べる
const JST_DAY = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' });

export function jstDay(date: Date) {
  return JST_DAY.format(date);
}
