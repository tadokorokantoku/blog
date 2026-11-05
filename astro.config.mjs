// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://inok.dev',
  trailingSlash: 'always',
  // /news は最初のカテゴリに送る。全カテゴリ混在のページは持たない
  redirects: { '/news': '/news/xtrend' },
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
