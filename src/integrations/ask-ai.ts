// 赤ペンの「AIに聞く」の中身。呼び出し口はこの askAI だけにしておき、
// 本番に出すときはこれを Cloudflare Workers などの中で動く実装に差し替える。
// サーバー側でしか動かない（API キーと子プロセスを使う）ので、ブラウザ向けのコードから import しない
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

export interface AskInput {
  // 選んだ範囲の文字列
  selection: string;
  article: { title: string; summary?: string; url: string };
  // 空なら「これは何？」として扱う
  question: string;
  // 同じ赤ペンでのそれまでのやりとり。古い順
  history: { question: string; answer: string }[];
}

const MODEL = 'claude-sonnet-5-5';
const TIMEOUT_MS = 120_000;

const SYSTEM = [
  'あなたはニュースサイトの読者の質問に答えるアシスタント。',
  '読者は記事の一部を選んで質問している。日本語で、専門外の人にもわかるようにかんたんに、3〜6文で答える。',
  '記事に書かれていないことを推測で言うときはそう断る。知らないことは知らないと言う。Markdown の見出しは使わない。',
].join('\n');

function prompt({ selection, article, question, history }: AskInput) {
  const lines = [
    `記事のタイトル: ${article.title}`,
    article.summary && `記事の要約: ${article.summary}`,
    `記事の URL: ${article.url}`,
    '',
    `読者が選んだ部分: 「${selection}」`,
  ];
  for (const turn of history) lines.push('', `読者: ${turn.question}`, `あなた: ${turn.answer}`);
  lines.push('', `読者: ${question.trim() || 'これは何？'}`);
  return lines.filter((line) => line !== undefined).join('\n');
}

// ANTHROPIC_API_KEY があれば API、無ければ手元の claude -p
export async function askAI(input: AskInput): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  return key ? viaApi(key, prompt(input)) : viaCli(prompt(input));
}

async function viaApi(key: string, text: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: SYSTEM, messages: [{ role: 'user', content: text }] }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // 失敗時もキーを含むヘッダーは出さず、ステータスと本文だけを返す
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { content: { type: string; text?: string }[] };
  return body.content.flatMap(({ type, text }) => (type === 'text' && text ? [text] : [])).join('\n');
}

function viaCli(text: string) {
  return new Promise<string>((resolve, reject) => {
    // ツールも MCP も使わせず、答えるだけにする。リポジトリの CLAUDE.md を読まないよう cwd も外す。
    // Claude Code の中から dev サーバーを起動したときに入れ子と判定されないよう CLAUDECODE を外す
    const { CLAUDECODE: _, ...env } = process.env;
    const child = spawn(
      'claude',
      ['-p', '--model', MODEL, '--tools', '', '--strict-mcp-config', '--no-session-persistence', '--system-prompt', SYSTEM],
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
