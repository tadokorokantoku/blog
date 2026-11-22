// 赤ペンの「AIに聞く」の中身。呼び出し口はこの askAI だけにしておき、
// 本番に出すときはこれを Cloudflare Workers などの中で動く実装に差し替える。
// サーバー側でしか動かない（API キーと子プロセスを使う）ので、ブラウザ向けのコードから import しない
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import Anthropic from '@anthropic-ai/sdk';

export interface AskInput {
  // 選んだ範囲の文字列
  selection: string;
  // detail は記事の本文（Markdown）。summary レイアウトの記事にだけある
  article: { title: string; summary?: string; detail?: string; url: string };
  // 空なら「これは何？」として扱う
  question: string;
  // 同じ赤ペンでのそれまでのやりとり。古い順
  history: { question: string; answer: string }[];
}

const MODEL = 'claude-sonnet-5-5';
// リンク先を読んだり検索したりするので、1回で数十秒かかる
const TIMEOUT_MS = 180_000;

const SYSTEM = [
  'あなたはニュースサイトの読者の質問に答えるアシスタント。読者は記事の一部を選んで質問している。',
  'まず記事（タイトル・要約・本文）を読む。それで足りなければ、記事の URL の中身を読み、Web でも検索して調べる。自分の知識も使ってよい。',
  'そのうえで質問に直接答える。日本語で、専門外の人にもわかるようにかんたんに、3〜8文で。Markdown の見出しは使わない。',
  '「わからない」と答えるのは、調べても見つからなかったときだけ。そのときは何を調べたかを一言添える。',
  '最後に、答えの根拠にした出典の URL を1〜2個、「出典:」に続けて書く。記事の中身だけで答えたなら記事の URL を書く。',
].join('\n');

function prompt({ selection, article, question, history }: AskInput) {
  const lines = [
    `記事のタイトル: ${article.title}`,
    article.summary && `記事の要約: ${article.summary}`,
    `記事の URL: ${article.url}`,
    article.detail && `記事の本文:\n${article.detail}`,
    '',
    `読者が選んだ部分: 「${selection}」`,
  ];
  for (const turn of history) lines.push('', `読者: ${turn.question}`, `あなた: ${turn.answer}`);
  lines.push('', `読者: ${question.trim() || 'これは何？'}`);
  return lines.filter((line) => line !== undefined).join('\n');
}

// ANTHROPIC_API_KEY があれば API、無ければ手元の claude -p。どちらも Web の検索と取得だけを使える
export async function askAI(input: AskInput): Promise<string> {
  return process.env.ANTHROPIC_API_KEY ? viaApi(prompt(input)) : viaCli(prompt(input));
}

async function viaApi(text: string) {
  // キーは SDK が ANTHROPIC_API_KEY から読む。ここでは触らない（ログにも出さない）
  const client = new Anthropic({ timeout: TIMEOUT_MS });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: text }];
  // サーバーツールの途中で止まる（pause_turn）ことがあるので、続きを数回まで頼む
  for (let turn = 0; turn < 4; turn++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages,
      tools: [
        { type: 'web_search_20260209', name: 'web_search', max_uses: 3 },
        { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 3 },
      ],
      // 安全判定で断られたときは、断られた種類に合う別のモデルでやり直してもらう
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    if (response.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: response.content });
      continue;
    }
    if (response.stop_reason === 'refusal') throw new Error('モデルが回答を断った');
    // 「調べます」のような途中の文は捨て、最後のツール結果より後の文だけを答えにする
    const lastTool = response.content.findLastIndex((block) => block.type !== 'text');
    return response.content
      .slice(lastTool + 1)
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('')
      .trim();
  }
  throw new Error('調べるのが終わらなかった');
}

function viaCli(text: string) {
  return new Promise<string>((resolve, reject) => {
    // 使えるツールは WebFetch と WebSearch だけ。-p では許可を聞けないので allowedTools でも許しておく。
    // リポジトリの CLAUDE.md を読まないよう cwd は tmp にする。
    // Claude Code の中から dev サーバーを起動したときに入れ子と判定されないよう CLAUDECODE を外す
    const { CLAUDECODE: _, ...env } = process.env;
    const child = spawn(
      'claude',
      [
        '-p',
        '--model',
        MODEL,
        '--tools',
        'WebFetch,WebSearch',
        '--allowedTools',
        'WebFetch,WebSearch',
        '--strict-mcp-config',
        '--no-session-persistence',
        '--system-prompt',
        SYSTEM,
      ],
      { cwd: tmpdir(), env, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
    child.stdout.on('data', (chunk) => (out += chunk));
    child.stderr.on('data', (chunk) => (err += chunk));
    child.on('error', (error) => reject(new Error(`claude を起動できない: ${error.message}`)));
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && out.trim()) resolve(out.trim());
      else reject(new Error(`claude -p が終了コード ${code} で終わった: ${err.slice(0, 300)}`));
    });
    child.stdin.end(text);
  });
}
