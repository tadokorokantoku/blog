# blog

Astro で作った個人ブログ。静的ビルドして Cloudflare Workers（Static Assets）で配信する。

## 記事を書く

`src/content/posts/<slug>.md` を作る。URL は `/posts/<slug>/`。

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

画像は記事と同じフォルダに置いて相対パスで参照する。

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
