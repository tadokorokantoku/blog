import type { AstroIntegration } from 'astro';
import { askAI, type AskInput } from './ask-ai';

// 赤ペンの「AIに聞く」を受ける口。astro dev のときだけ Vite のサーバーに生える。
// 静的ビルドには何も出ないので、本番の inok.dev からは呼べない
export const ASK_PATH = '/__redpen/ask';

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
            reply(200, { answer: await askAI({ ...input, question: input.question ?? '', history: input.history ?? [] }) });
          } catch (error) {
            reply(502, { error: error instanceof Error ? error.message : String(error) });
          }
        });
      },
    },
  };
}
