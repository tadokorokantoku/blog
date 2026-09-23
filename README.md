# blog

Astro で作った個人ブログ。静的ビルドして Cloudflare Workers（Static Assets）で配信する。

## 記事を書く

`src/content/posts/<slug>/index.md` を作る。URL は `/posts/<slug>/`。

```md
---
title: Hello World        # 必須
date: 2026-09-24          # 必須（公開日）
description: はじめまして  # 必須（一覧・RSS の抜粋）
tags: [astro, diary]      # 任意
updated: 2026-09-30       # 任意
draft: true               # 任意。true だと本番ビルドから除外（dev では表示）
---
```

画像は記事と同じフォルダに置いて、ファイル名で参照する（`![](photo.png)`、`cover: photo.png`）。

### ブラウザのエディタで書く

`/admin/` に Sveltia CMS を置いている。保存すると main に commit される。新規記事は `draft: true` で始まる。

ログインは「アクセストークンを使用してログイン」を使う。トークンは GitHub の fine-grained PAT で、対象リポは `tadokorokantoku/blog` だけ、権限は Contents の Read and write。「GitHub にログイン」ボタンは OAuth 用の認証サーバーを立てるまで使えない。

Sveltia のバージョンは `public/admin/index.html` の URL で固定している。

## コマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | 開発サーバー（draft も表示） |
| `pnpm build` | `dist/` に静的ビルド |
| `pnpm preview` | ビルド結果を wrangler でローカル配信 |
| `pnpm check` | 型チェック |

## デプロイ

Workers Builds（Cloudflare ダッシュボードの Git 連携）で `main` への push ごとに自動デプロイする。

- Build command: `pnpm run build`
- Deploy command: `npx wrangler deploy`
