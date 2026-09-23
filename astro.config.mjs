// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://blog.katsuki104.workers.dev',
  trailingSlash: 'always',
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
});
