// A week's script: the narration is written by hand in weeks/<YYYY-Www>.json,
// the numbers come from the data. Strings may use {placeholders} (see vars()),
// stats scenes get their values, and the chart scene gets its repo's ranks.
import fs from 'node:fs';
import { topTrendRepo } from './week-data.mjs';

const TODO = 'TODO';
const md = day => `${+day.slice(5, 7)}/${+day.slice(8, 10)}`;

// 2026年11月16日〜22日, or 2026年11月30日〜12月6日 across months.
function longPeriod(from, to) {
  const [y, m, d] = from.split('-').map(Number);
  const [, m2, d2] = to.split('-').map(Number);
  return `${y}年${m}月${d}日〜${m2 === m ? '' : `${m2}月`}${d2}日`;
}

function vars({ week, from, to, counts }) {
  return {
    week,
    year: week.slice(0, 4),
    weekNo: String(+week.slice(6)),
    period: `${md(from)} 〜 ${md(to)}`,
    periodLong: longPeriod(from, to),
    ...Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, String(v)])),
  };
}

function fill(value, v) {
  if (typeof value === 'string') {
    return value.replace(/\{([\w-]+)\}/g, (m, key) => {
      if (!(key in v)) throw new Error(`unknown placeholder ${m} (known: ${Object.keys(v).join(', ')})`);
      return v[key];
    });
  }
  if (Array.isArray(value)) return value.map(x => fill(x, v));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, x]) => [k, fill(x, v)]));
  return value;
}

function trendData(data, repo) {
  const found = data.trend.repos.find(r => r.title === repo);
  if (!found) throw new Error(`${repo} is not on GitHub trending in ${data.week}`);
  return data.trend.days.map((day, i) => ({ date: md(day), rank: found.ranks[i] }));
}

export function buildScript(raw, data) {
  if (JSON.stringify(raw).includes(TODO)) throw new Error('the script still has TODO in it');
  const script = fill(raw, vars(data));
  const scenes = script.scenes.map(scene => {
    if (scene.type === 'stats') {
      return { ...scene, stats: scene.stats.map(s => ({ ...s, value: data.counts[s.category] ?? 0 })) };
    }
    if (scene.type === 'topic_chart') return { ...scene, trendData: trendData(data, scene.repo) };
    return scene;
  });
  return { ...script, week: data.week, period: `${data.from} 〜 ${data.to}`, scenes };
}

const topic = (n, title) => ({
  id: `scene_0${n + 2}_topic${n}`,
  type: 'topic_deepdive',
  category: TODO,
  badge: `TOPIC ${n}`,
  title: title ?? TODO,
  cards: ['何が起きたか', 'なぜ大事か', '次に何を見ておくか'].map(step => ({ step, heading: TODO, detail: TODO })),
  narration: `${TODO}。${TODO}。${TODO}。`,
  subtitles: [`【何が起きたか】${TODO}`, TODO, `【なぜ大事か】${TODO}`, `【次に注目】${TODO}`],
});

// The fixed scenes come filled in; the topics are left as TODO, titled after
// src/content/news-weekly/<week>.json when it exists. The third topic is the
// GitHub trending chart for the week's strongest repo.
export function scriptTemplate(data) {
  const titles = data.notes?.topics.map(t => t.title) ?? [];
  const repo = topTrendRepo(data.trend);
  const chart = {
    ...topic(3, repo && `${repo.split('/')[1]} がトレンド上位に`),
    type: 'topic_chart',
    category: 'GitHub Trending',
    repo: repo ?? TODO,
  };
  return {
    readings: { 'inok.dev': 'イノック ドット デブ' },
    teaser: [titles[0] ?? TODO, titles[1] ?? TODO, chart.title],
    hints: data.notes?.highlights ?? [],
    scenes: [
      {
        id: 'scene_01_intro',
        type: 'intro',
        badge: 'WEEKLY AI DIGEST',
        title: '週刊 AI ニュースまとめ',
        subtitle: '{week} ({period})',
        narration: '{year}年第{weekNo}週のAIニュースダイジェストです。',
        subtitles: ['{year}年 第{weekNo}週 AIニュースまとめ'],
      },
      {
        id: 'scene_02_numbers',
        type: 'stats',
        badge: 'DATA OVERVIEW',
        title: '今週の数字まとめ',
        caption: '{periodLong}の収集データ概要',
        stats: [
          { category: 'coding-agent', label: 'Coding Agent', unit: '件', desc: 'エージェント新機能・運用' },
          { category: 'ade', label: 'ADE (開発環境)', unit: '件', desc: '開発連携ツール' },
          { category: 'githubtrend', label: 'GitHub トレンド', unit: 'リポ', desc: 'ランク入りリポジトリ数' },
          { category: 'xtrend', label: 'X トレンド', unit: '件', desc: '注目の技術トピック' },
        ],
        narration: '今週はCoding Agentが{coding-agent}件、GitHubトレンドには{githubtrend}件のリポジトリが浮上しました。',
        subtitles: ['Coding Agent {coding-agent}件、GitHubトレンド {githubtrend}リポジトリを観測'],
        note: 'ℹ️ GitHubトレンドは週内にランク入りした個別{githubtrend}リポジトリ数',
      },
      topic(1, titles[0]),
      topic(2, titles[1]),
      chart,
      {
        id: 'scene_06_outro',
        type: 'outro',
        badge: 'WEEKLY DIGEST',
        title: '今週のまとめ',
        subtitle: '各記事の詳細・リンクはブログで公開中',
        site: 'inok.dev/news/weekly/{week}/',
        narration: '以上、今週の注目トピックでした。詳細はブログ inok.dev をご覧ください。',
        subtitles: ['以上、今週の注目トピックでした', '詳細はブログ inok.dev/news/weekly/ をチェック！'],
      },
    ],
  };
}

export function loadOrTemplate(file, data) {
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  fs.writeFileSync(file, JSON.stringify(scriptTemplate(data), null, 2) + '\n', 'utf-8');
  return null;
}
