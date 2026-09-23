# Vite+ は Astro と Workers デプロイで使える？

調査日: 2026-09-23 / 対応 Issue: #2

## 結論

- **Astro の dev/build は Vite+ の `vp dev` / `vp build` では動かない。** これらは素の Vite サーバー／ビルドを直接起動するだけで、`astro dev` / `astro build` を呼ばない。Astro は `vp run dev` / `vp run build`（= package.json の script 経由で `astro` CLI を実行）でなら動く。
- 使い道として残るのは **`vp run`（タスクランナー）・`vp lint`（Oxlint）・`vp test`（Vitest）・`vp install`／Node バージョン管理**。ただし `.astro` は lint が `<script>` 部分だけ、format は未対応（Oxfmt が `.astro` を扱えない）。
- Workers デプロイとの相性は「バージョン上は OK、細かい既知バグあり」。Astro 7・`@astrojs/cloudflare` 14・Vite+ はいずれも Vite 8 系。ただし Vite+ を入れると `vite` が `@voidzero-dev/vite-plus-core` に差し替わり、Astro や `@cloudflare/vite-plugin` もその上で動くことになる。
- **このブログへの推奨: Vite+ は入れない。素の Astro ツールチェーン（`astro dev` / `astro build` / `wrangler deploy`）でいく。** 1.0 正式版が出て Astro 連携（vite-plus#1506）が入ったら再検討。

## 1. Vite+ の現状

| 項目 | 内容 | 出典 |
|---|---|---|
| 何か | Vite / Vitest / Oxlint / Oxfmt / Rolldown / tsdown / Vite Task をまとめた統合 CLI `vp`。Node ランタイムとパッケージマネージャの管理もする | [viteplus.dev](https://viteplus.dev/), [GitHub](https://github.com/voidzero-dev/vite-plus) |
| コマンド | `vp dev` / `vp build` / `vp check`（fmt+lint+型チェック）/ `vp test` / `vp pack` / `vp run` / `vp install` / `vp migrate` | [viteplus.dev/guide](https://viteplus.dev/guide/) |
| ライセンス | MIT（2026-03 の Alpha で OSS 化） | [Alpha 告知](https://voidzero.dev/posts/announcing-vite-plus-alpha), [GitHub API: license=MIT](https://github.com/voidzero-dev/vite-plus) |
| 安定度 | 2026-07-02 Beta。「stable, but not yet complete」。**2026-09-22 に `v1.0.0-rc.0`**（最新）。Q3 目標は 1.0 リリース | [Beta 告知](https://voidzero.dev/posts/announcing-vite-plus-beta), [Releases](https://github.com/voidzero-dev/vite-plus/releases), [Q3 計画 #2405](https://github.com/voidzero-dev/vite-plus/issues/2405) |
| 体制 | VoidZero は 2026-06 に Cloudflare が買収。Vite+ は MIT・OSS のまま継続と明言 | [VoidZero 告知](https://voidzero.dev/posts/voidzero-cloudflare), [Cloudflare Blog](https://blog.cloudflare.com/voidzero-joins-cloudflare/) |
| ベース | Vite 8 + Rolldown。npm 上の `vite-plus@1.0.0-rc.0` は `vite: npm:@voidzero-dev/vite-plus-core@1.0.0-rc.0`, `vitest: 5.0.1` に依存 | [guide/build](https://viteplus.dev/guide/build), `npm view vite-plus dependencies` |

## 2. Astro を Vite+ 上で動かせるか

### dev / build: `vp dev` / `vp build` は不可、`vp run` 経由なら可

- 公式ドキュメント: 「`vp dev` always runs the built-in Vite dev server. If your project also has a `dev` script in `package.json`, run `vp run dev`」、`vp build` も同様。([guide/dev](https://viteplus.dev/guide/dev), [guide/build](https://viteplus.dev/guide/build))
- `vp create astro` 後に `vp dev` すると 5173 で素の Vite が起動し Astro として動かない、`vp run dev` なら動く、という報告。([vite-plus#1123](https://github.com/voidzero-dev/vite-plus/issues/1123)) Nuxt/Astro で `vp dev`/`vp build` がほぼ無意味だという指摘もある（同 Issue のコメント）。
- 改善要望 [vite-plus#1506 "Better Nuxt/Astro integration"](https://github.com/voidzero-dev/vite-plus/issues/1506) は **open**。現時点の対応は、メタフレームワークで `vp dev` すると「`vpr dev` を使え」と注意を出すだけ（PR #2259）。Q3 計画でも「More integration with Nuxt and Astro」は 1.0 の後ろの項目扱い。([#2405](https://github.com/voidzero-dev/vite-plus/issues/2405))

### 設定ファイル

- Vite+ の設定（lint/fmt/staged など）はルートの `vite.config.ts` に置く必要があり、`astro.config.mjs` を設定源にする提案は却下済み。([vite-plus#912](https://github.com/voidzero-dev/vite-plus/issues/912))
- 一方 Astro は内部で `configFile: false` として Vite を起動するので、ルートの `vite.config.ts` を読まない。([astro/create-vite.ts](https://github.com/withastro/astro/blob/main/packages/astro/src/core/create-vite.ts)) つまり共存はできるけど、「Vite 設定っぽいのに Astro には効かないファイル」が1個増える。

### lint / format / test

- `vp lint`（Oxlint）: `.astro` は「`<script>` ブロックだけ」を lint する。([Oxlint docs](https://oxc.rs/docs/guide/usage/linter))
- `vp fmt`（Oxfmt）: 対応言語表に Astro が無い。Astro 対応の追跡 Issue でも Svelte は済、Astro は未チェック。([Oxfmt language support](https://oxc.rs/docs/guide/usage/formatter/language-support.html), [oxc#19715](https://github.com/oxc-project/oxc/issues/19715)) → `.astro` の整形は結局 Prettier + `prettier-plugin-astro` が必要。
- `vp test`（Vitest 5）: 普通に使える。ただしブログにテストはほぼ無いのでメリットは小さい。

## 3. Cloudflare Workers デプロイとの衝突

- バージョン整合: `astro@7.3.4` は `vite ^8.0.13`、`@astrojs/cloudflare@14.3.3` は `vite ^8.0.13` と `@cloudflare/vite-plugin ^1.53.0` に依存、`@cloudflare/vite-plugin@1.58.0` の peer は `vite ^6.1.0 || ^7 || ^8`。Vite+ も Vite 8 系なので**メジャーは揃っている**。(`npm view` で確認, 2026-09-23)
- ただし `vp migrate` は `vite` を `@voidzero-dev/vite-plus-core` へ override／catalog でエイリアスする（pnpm なら `vite@*`）。([guide/migrate-rules](https://viteplus.dev/guide/migrate-rules)) つまり Astro・`@astrojs/cloudflare`・`@cloudflare/vite-plugin` 全部が「素の Vite ではなく Vite+ コア」の上で動く。過去に peer 依存の警告も出ていた。([vite-plus#1021](https://github.com/voidzero-dev/vite-plus/issues/1021))
- `@cloudflare/vite-plugin` まわりの既知 Issue（open）:
  - 設定変更で dev サーバーが再起動するとき、リクエストが来ていると再起動が永久に止まる。素の Vite では再現せず、Vite+ のときだけ起きる。([vite-plus#2481](https://github.com/voidzero-dev/vite-plus/issues/2481))
  - TanStack Start + Cloudflare plugin で SSR 時に React が重複読み込みされる。([vite-plus#1671](https://github.com/voidzero-dev/vite-plus/issues/1671))
  - 過去には `vp test` + `@cloudflare/vitest-pool-workers` の不具合もあった（修正済み）。([vite-plus#1076](https://github.com/voidzero-dev/vite-plus/issues/1076))
- `wrangler deploy` 自体は Vite+ と無関係に動く（`vp run deploy` で呼ぶだけ）。直接ぶつかる箇所は見つからなかった。

## 4. このブログへの推奨

**Vite+ は採用しない。素の Astro ツールチェーンでいく。**

理由:
1. 一番欲しい dev/build 統合が Astro では効かない（`vp run dev` は `npm run dev` と実質同じ）。
2. 整形はどのみち Prettier + `prettier-plugin-astro` が要るので、「ツール1本化」にならない。
3. `vite` の差し替えで、Astro と Cloudflare plugin のスタックに RC 版コアが入る。小さい個人ブログで抱えるリスクとして割に合わない。

構成案: `astro dev` / `astro build`、デプロイは `wrangler deploy`（`@astrojs/cloudflare` アダプタ）。lint/format を入れるなら Prettier + `prettier-plugin-astro`（+ 必要なら ESLint or Oxlint 単体）。

**再検討のタイミング:** Vite+ 1.0 正式版が出て、[vite-plus#1506](https://github.com/voidzero-dev/vite-plus/issues/1506)（`vp dev`/`vp build` が Astro CLI を呼ぶ）と [oxc#19715](https://github.com/oxc-project/oxc/issues/19715)（Oxfmt の Astro 対応）が閉じたら。
