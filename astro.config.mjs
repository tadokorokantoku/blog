// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { devAskAI } from './src/integrations/dev-ask-ai';

export default defineConfig({
  site: 'https://inok.dev',
  // dev サーバーでスラッシュ無しの URL も 404 にしない。本番は Cloudflare がスラッシュ付きに寄せる
  trailingSlash: 'ignore',
  // /news は最初のカテゴリに送る。全カテゴリ混在のページは持たない
  // claude-code は coding-agent に、orca は ade に改名した。古いリンクを生かしておく
  redirects: {
    '/news': '/news/xtrend/',
    '/news/claude-code': '/news/coding-agent/',
    '/news/orca': '/news/ade/',
  },
  // 赤ペンの「AIに聞く」。dev サーバーにだけ API の口を足す（ビルドには何も出ない）
  integrations: [devAskAI()],
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
  vite: {
    plugins: [tailwindcss()],
    // 赤ペンがブラウザで読む依存。初めて使われた時点で事前バンドルさせると、dev サーバーの途中で作り直しが起き、
    // 古い版番号のまま 504 になって赤ペンのスクリプトごと止まることがあった。起動時にまとめて用意させる
    optimizeDeps: {
      include: ['dompurify', 'marked'],
    },
  },
});
