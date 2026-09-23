# Astro on Workers の配信方式とデプロイ手段

調査日: 2026-09-23 / 対象 issue: tadokorokantoku/blog#4

前提: 個人ブログ。Astro で作り、Cloudflare Workers の `workers.dev` サブドメイン（Free プラン）で配信する。記事は public リポジトリの GitHub Issues から取るので、コンテンツの変更は git の外で起きる。

## 結論（先に）

- **おすすめは「完全静的ビルド + Workers Static Assets」+「Issue 更新をトリガーに再ビルド」**。静的アセットへのリクエストは無料・無制限で、Worker の 10ms CPU 制限や 1 日 10 万リクエスト制限にかからない。
- 再ビルドのトリガーは 2 通り。
  - **GitHub Actions + wrangler**: `on: issues` で直接起動できる。public リポジトリなら Actions は無料。記事ソースと同じリポジトリならこっちが一番シンプル。
  - **Workers Builds**: Git push 以外のきっかけは **Deploy Hook**（POST するだけの URL）で起こす。Issue 更新を拾うには Actions か GitHub Webhook から Deploy Hook を叩く中継が要る。
- SSR が必要になったら `@astrojs/cloudflare` + **Workers Cache**（Worker の前段に置く CDN キャッシュ、`workers.dev` でも使える）+ Astro 7 の **Route Caching**（experimental）が ISR に一番近い。KV は Free だと書き込みが 1 日 1,000 回なので、キャッシュ用途には向かない。

## 1. 現行バージョン

| パッケージ | 最新 (npm, 2026-09-23) | 備考 |
|---|---|---|
| `astro` | 7.3.4 | Route Caching は `astro@7.0.0` から |
| `@astrojs/cloudflare` | 14.3.3 | peerDeps: `astro ^7.2.0`, `wrangler ^4.125.0` |
| `wrangler` | 4.137.0 | |

- adapter v13（Astro 6 対応）で **Cloudflare Pages のサポートは削除**され、Workers 専用になった。`astro dev` も workerd 上で動くようになった。wrangler 設定ファイルは単純な構成なら省略可。https://docs.astro.build/en/guides/integrations-guide/cloudflare/

## 2. 完全静的ビルド vs `@astrojs/cloudflare`（オンデマンドレンダリング）

### A. 完全静的ビルド + Workers Static Assets

- 「Astro を静的サイトビルダーとして使うなら adapter は不要」。https://docs.astro.build/en/guides/integrations-guide/cloudflare/
- `main` なしで `assets.directory` だけ書いた wrangler 設定で、`astro build && wrangler deploy` すれば出せる。「静的アセットだけを配信するので `main` フィールドはない」。https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/

```jsonc
{ "name": "blog", "compatibility_date": "2026-09-23", "assets": { "directory": "./dist" } }
```

- 「静的アセットへのリクエストは無料かつ無制限」。Worker スクリプトが起動したリクエストだけが課金・制限の対象になる。https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- 記事は Content Layer のビルド時ローダーで取得する（CMS や API からリモートデータを取得するカスタムローダーを作れる）。https://docs.astro.build/en/guides/content-collections/
- デメリット: Issue を更新してから反映されるまでビルド時間ぶん遅れる。記事が増えるほどビルドが長くなる。

### B. `@astrojs/cloudflare` によるオンデマンドレンダリング

- `npx astro add cloudflare` で入れる。adapter は `output: 'server'` を設定し、ルート単位で `export const prerender = true` を付けると事前レンダリングになる。wrangler 設定は `main: ./dist/_worker.js/index.js`、`nodejs_compat`、`assets.binding: "ASSETS"`。https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/
- Sessions は KV（`SESSION` バインディング）、画像サービスのデフォルトは v14 から `'cloudflare-binding'`。プリレンダーが workerd 非互換の依存を使うなら `prerenderEnvironment: 'node'` にする。https://docs.astro.build/en/guides/integrations-guide/cloudflare/
- Live Content Collections（`src/live.config.ts` / `defineLiveCollection()`）でリクエスト時にデータを取れる。オンデマンドレンダリング用の adapter が必須。`cacheHint`（tags, lastModified）が Route Caching と連携する。https://docs.astro.build/en/guides/content-collections/
- デメリット: キャッシュミスのたびに Worker が走るので Free の **CPU 10ms/リクエスト** と **1 日 10 万リクエスト**にかかる。GitHub API を叩くレート制限の管理も必要になる。

## 3. SSR で外部 API（GitHub）の結果をキャッシュする手段

| 手段 | スコープ | Free での使い勝手 | 出典 |
|---|---|---|---|
| **Workers Cache**（`"cache": {"enabled": true}`） | Worker の前段、階層キャッシュ（全世界で共有） | ◎ `workers.dev` 可。ヒット時は Worker が起動せず CPU 課金ゼロ。`Cache-Control`（`stale-while-revalidate` 含む）で制御。`Cache-Tag` + `ctx.cache.purge({tags})` でパージ | https://developers.cloudflare.com/workers/cache/ |
| **Astro Route Caching**（`cacheCloudflare()`） | 上の Workers Cache を Astro から使うラッパー | ○ experimental。`Astro.cache.set({ maxAge, swr, tags })`、`cache.invalidate({ tags } / { path })` | https://docs.astro.build/en/guides/caching/ |
| **Cache API**（`caches.default`） | **データセンター単位**（他の DC に複製されない） | △ ヒット率が低い。`cache.put` は階層キャッシュ非対応 | https://developers.cloudflare.com/workers/runtime-apis/cache/ |
| **KV** | グローバル（結果整合、伝播は最大約 60 秒） | ✕ Free だと書き込み 1,000/日、同じキーへの書き込みは 1 回/秒 | https://developers.cloudflare.com/kv/platform/limits/ |

Workers Cache の要点（https://developers.cloudflare.com/workers/cache/ , https://developers.cloudflare.com/workers/cache/limitations/ ）:
- ヒットすれば Worker は実行されない。リクエストは通常の Workers リクエストとして数えられるが、CPU 時間は Worker が走ったときだけ。
- キャッシュされるのは GET/HEAD だけ。`Set-Cookie` 付きのレスポンスと `Authorization` 付きのリクエストはバイパスされる。`Vary: *` を付けるとキャッシュされない。
- 「ビルド時に生成したレスポンスをキャッシュへ事前投入する API はない」。`ctx.cache.purge()` はアカウントのプランに関係なく Free のレート制限が適用される。
- Free のパージ制限: tag/prefix/hostname/everything は **5 リクエスト/分（バケット 25）**。https://developers.cloudflare.com/cache/how-to/purge-cache/

Astro の設定例（https://docs.astro.build/en/guides/caching/ ）:

```js
import { cacheCloudflare } from '@astrojs/cloudflare/cache';
export default defineConfig({ adapter: cloudflare(), cache: { provider: cacheCloudflare() } });
```

**ISR っぽい動きにするには**: `maxAge` + `swr` で TTL 型の再生成、Issue 更新の Webhook を受けたら該当タグを purge、の組み合わせ。ただし Webhook 受信用のエンドポイントは自分で作る必要がある（これは推論で、公式レシピではない）。

GitHub API のレート制限: 未認証は **60 リクエスト/時**、PAT なら 5,000/時、Actions の `GITHUB_TOKEN` は 1,000/時/リポジトリ。https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
→ SSR でもビルドでも、トークンは持たせておいたほうがいい。

## 4. デプロイ手段と外部イベントからの再デプロイ

### Workers Builds（Git 連携）
- Git push でビルドする。Git 以外のきっかけで起動するには **Deploy Hook** を使う。Settings > Builds > Deploy Hooks でブランチを選んで URL を作る。
- 起動方法は URL に POST するだけ。「`Authorization` ヘッダは不要。URL に埋め込まれた一意な ID が認証情報になる」ので、シークレットとして扱うこと。
- レート制限: **Worker ごとに 10 ビルド/分、アカウントごとに 100 ビルド/分**。ビルド待ちの間に重複して POST しても既存のビルドが返る（冪等）。`build_uuid` でビルドの状態を追える。
- https://developers.cloudflare.com/workers/ci-cd/builds/deploy-hooks/
- Free の枠: **月 3,000 ビルド分、同時ビルド 1、タイムアウト 20 分**、2 vCPU / 8 GB。https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/
- Issue 更新から起動する経路: (a) GitHub Actions の `on: issues` から `curl -X POST <hook>` する。(b) リポジトリの Webhook（Issues イベント）の送信先を Deploy Hook URL にする。(b) は POST が届けば起動するという仕様からの推論で、公式の手順としては書かれていない。

### GitHub Actions + wrangler
- `cloudflare/wrangler-action@v4` に `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を渡す。https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- トリガーは `issues`（opened / edited / deleted / closed / reopened / labeled など）、`issue_comment`、`repository_dispatch`（外部から API で起動）、`workflow_dispatch`（手動）が使える。ワークフローファイルはデフォルトブランチにある必要がある。https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- 「public リポジトリで標準の GitHub ホストランナーを使う場合、Actions は無料」。https://docs.github.com/en/billing/concepts/product-billing/github-actions
- 記事リポジトリとブログのリポジトリが同じなら `on: issues` だけで済む。別リポジトリなら記事側から `repository_dispatch` を送る（PAT が必要）か、Deploy Hook を叩く。

**比較**: Issue 起点で動かすなら Actions のほうが仕組みが 1 つで済む（トリガーからビルド、デプロイまで同じ場所）。Workers Builds は PR プレビューやダッシュボードでの管理が楽な反面、Issue 起点で起動するには結局 Actions か Webhook の中継が必要になる。

## 5. Free プランの制限で気になりそうなもの

https://developers.cloudflare.com/workers/platform/limits/ より:

- リクエスト: **10 万/日**（静的アセットは対象外）。超えると Error 1027、または fail open の設定なら Worker をバイパスする。`run_worker_first` のパスは超過時 429 になる（https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/ ）。
- **CPU 10ms/リクエスト**: SSR で Markdown の変換（GitHub の Issue 本文を HTML にする処理）を毎回やると引っかかる可能性がある。静的ビルドかキャッシュで逃がす。
- サブリクエスト 50/リクエスト、Cache API の呼び出し 50/リクエスト、メモリ 128MB、起動時間 1 秒。
- Worker サイズ 64 MiB（非圧縮）、静的アセットは **1 バージョンあたり 20,000 ファイル、1 ファイル 25 MiB**。個人ブログならまず足りる。
- Cron Triggers は 5/アカウント（定期再ビルドや定期フェッチに使う場合）。
- KV: 読み取り 10 万/日、書き込み 1,000/日、容量 1GB。https://developers.cloudflare.com/kv/platform/limits/
- Workers Builds は 3,000 分/月。Issue を編集するたびにビルドが走っても、1 回数分なら十分余裕がある。

## 推奨構成（このブログの場合）

1. Astro 7 で静的出力。GitHub Issues をビルド時ローダーで取得する（トークンは `GITHUB_TOKEN` など）。
2. wrangler 設定は `assets.directory: ./dist` だけにする（adapter なし）。
3. GitHub Actions を `on: issues` / `issue_comment` / `workflow_dispatch` で起動し、`wrangler-action` でデプロイする。短時間に連続で編集されたとき用に `concurrency` を設定しておく。
4. 将来、反映の即時性が必要になったら `@astrojs/cloudflare` + Workers Cache（Route Caching）に移行し、Webhook を受けてタグを purge する。
