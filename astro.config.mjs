// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { devAskAI } from './src/integrations/dev-ask-ai';
import { devTrendLab } from './src/integrations/dev-trend-lab';

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
  // 赤ペンの「AIに聞く」の API と、推移グラフの比較ページ。どちらも dev サーバーにだけ足す（ビルドには何も出ない）
  integrations: [devAskAI(), devTrendLab()],
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
