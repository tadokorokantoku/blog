// The numbers a week's video shows, read straight from src/content/news.
// Mirrors src/lib/week.ts (ISO weeks, Monday first, days in JST) because the
// TypeScript there needs Astro to load.
import fs from 'node:fs';
import path from 'node:path';

const JST_DAY = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' });
const WEEK_ID = /^(\d{4})-W(\d{2})$/;

export const isWeekId = id => WEEK_ID.test(id);

function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekRange(id) {
  const [, year, week] = WEEK_ID.exec(id);
  const jan4 = new Date(Date.UTC(+year, 0, 4));
  const monday = addDays(jan4.toISOString().slice(0, 10), -((jan4.getUTCDay() + 6) % 7));
  const from = addDays(monday, (+week - 1) * 7);
  return { from, to: addDays(from, 6) };
}

// collectedAt has no zone. The collector runs in Japan, so read it as JST.
function jstDay(value) {
  const zoned = value.length <= 10 || /(Z|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value}+09:00`;
  return JST_DAY.format(new Date(zoned));
}

function readNewsDays(newsDir) {
  return fs.readdirSync(newsDir).flatMap(category =>
    fs
      .readdirSync(path.join(newsDir, category))
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(newsDir, category, f), 'utf-8'))),
  );
}

// Per category, the items dated inside the week (by publishedAt, else the
// collection time). GitHub trending lists the same repo day after day, so it
// counts distinct ranked repos. Elsewhere one URL can carry several items (a
// release split into its features and its breaking changes, an incident and
// its fix), so an item is its URL and title together.
function countCategories(days, from, to) {
  const keys = {};
  for (const { category, collectedAt, items } of days) {
    for (const item of items) {
      if (category === 'githubtrend' && item.rank == null) continue;
      const day = jstDay(item.publishedAt ?? collectedAt);
      if (day < from || day > to) continue;
      const key = category === 'githubtrend' ? item.url : `${item.url}\n${item.title}`;
      (keys[category] ??= new Set()).add(key);
    }
  }
  return Object.fromEntries(Object.entries(keys).map(([category, set]) => [category, set.size]));
}

// Each trending repo's rank on each day of the week (null when unranked).
function trendRanks(days, from, to) {
  const trend = days
    .filter(d => d.category === 'githubtrend')
    .map(d => ({ day: jstDay(d.collectedAt), items: d.items.filter(i => i.rank != null) }))
    .filter(({ day }) => day >= from && day <= to)
    .sort((a, b) => a.day.localeCompare(b.day));
  const repos = new Map();
  trend.forEach(({ items }, i) => {
    for (const { url, title, rank } of items) {
      if (!repos.has(url)) repos.set(url, { title, ranks: Array(trend.length).fill(null) });
      repos.get(url).ranks[i] = rank;
    }
  });
  return { days: trend.map(t => t.day), repos: [...repos.values()] };
}

export function loadWeekData(rootDir, week) {
  const { from, to } = weekRange(week);
  const days = readNewsDays(path.join(rootDir, 'src/content/news'));
  const weeklyFile = path.join(rootDir, 'src/content/news-weekly', `${week}.json`);
  return {
    week,
    from,
    to,
    counts: countCategories(days, from, to),
    trend: trendRanks(days, from, to),
    notes: fs.existsSync(weeklyFile) ? JSON.parse(fs.readFileSync(weeklyFile, 'utf-8')) : null,
  };
}

// The repo that held the best rank for the most days: the chart topic's default.
export function topTrendRepo({ repos }) {
  const score = ranks => ranks.reduce((s, r) => s + (r == null ? 0 : 1 / r), 0);
  return [...repos].sort((a, b) => score(b.ranks) - score(a.ranks))[0]?.title;
}
