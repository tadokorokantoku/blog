import type { AstroIntegration } from 'astro';

// 推移グラフの3案を並べる比較ページ /news/trend-lab/。astro dev のときだけ足し、静的ビルドには出さない。
// オーナーが1案を選んだら、このファイルと src/lab/、src/components/trend-lab/ の残りを消す
export function devTrendLab(): AstroIntegration {
  return {
    name: 'dev-trend-lab',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (command !== 'dev') return;
        injectRoute({ pattern: '/news/trend-lab', entrypoint: './src/lab/trend-lab.astro' });
      },
    },
  };
}
