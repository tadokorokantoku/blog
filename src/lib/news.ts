import { getCollection } from 'astro:content';
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
  date: Date;
}

export function newsCategoryList() {
  return NEWS_CATEGORY_IDS.map((id) => ({ id, label: NEWS_CATEGORIES[id] }));
}

export async function getNewsArticles(): Promise<NewsArticle[]> {
  const days = await getCollection('news');
  return days
    .flatMap(({ data }) =>
      data.items.map(
        (item): NewsArticle => ({
          category: data.category,
          categoryLabel: NEWS_CATEGORIES[data.category],
          title: item.title,
          url: item.url,
          source: item.source,
          summary: item.summary,
          image: item.image,
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
