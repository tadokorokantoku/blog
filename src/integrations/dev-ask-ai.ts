import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AstroIntegration } from 'astro';
import { askAI, type AskInput } from './ask-ai';

// 赤ペンの「AIに聞く」を受ける口。astro dev のときだけ Vite のサーバーに生える。
// 静的ビルドには何も出ないので、本番の inok.dev からは呼べない
export const ASK_PATH = '/__redpen/ask';

const NEWS_DIR = 'src/content/news';

// 記事の本文（detail）は長いので HTML には載せていない。URL を手がかりにニュースの JSON から探す。
// 聞かれるたびに読み直すので、dev サーバーを起動したあとに足した記事でも見つかる
function findDetail(url: string): string | undefined {
  for (const file of readdirSync(NEWS_DIR, { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('.json')) continue;
    try {
      const { items = [] } = JSON.parse(readFileSync(join(NEWS_DIR, file), 'utf8')) as {
        items?: { url?: string; detail?: string }[];
      };
      const detail = items.find((item) => item.url === url)?.detail?.trim();
      if (detail) return detail;
    } catch {
      // 書きかけの JSON は飛ばす
    }
  }
  return undefined;
}

export function devAskAI(): AstroIntegration {
  return {
    name: 'dev-ask-ai',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(ASK_PATH, async (req, res) => {
          const reply = (status: number, body: unknown) => {
            res.statusCode = status;
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(body));
          };
          if (req.method !== 'POST') return reply(405, { error: 'POST だけ受ける' });

          let raw = '';
          for await (const chunk of req) raw += chunk;
          let input: AskInput;
          try {
            input = JSON.parse(raw);
          } catch {
            return reply(400, { error: 'JSON として読めない' });
          }
          if (typeof input?.selection !== 'string' || typeof input.article?.url !== 'string') {
            return reply(400, { error: 'selection と article.url が要る' });
          }

          try {
            const article = { ...input.article, detail: findDetail(input.article.url) };
            reply(200, {
              answer: await askAI({ ...input, article, question: input.question ?? '', history: input.history ?? [] }),
            });
          } catch (error) {
            reply(502, { error: error instanceof Error ? error.message : String(error) });
          }
        });
      },
    },
  };
}
