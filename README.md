# blog

Astro で作った個人ブログ。静的ビルドして Cloudflare Workers（Static Assets）で配信する。

書けるものは2種類ある。

| | 置き場所 | URL | 用途 |
| --- | --- | --- | --- |
| 記事 | `src/content/posts/<slug>/index.md` | `/posts/<slug>/` | 長文。タイトルと説明文が必須 |
| ひとこと | `src/content/notes/<slug>/index.md` | `/notes/<slug>/` | 短文。タイトルは任意 |

どっちもタグを持ち、トップ `/` で時系列に混ざって並ぶ（タイムライン）。年ごとに区切られるので、興味の変遷が上から下に読める。

- `/` … 記事+ひとことのタイムライン（全件・1ページ）。タグの絞り込みもここでやる
- `/posts/<slug>/`, `/notes/<slug>/` … 個別ページ
- `/rss.xml` … 記事とひとことを1本にまとめたフィード。ひとことは本文全文が入る

### タグの絞り込み

トップの上にタグのチップが並ぶ。押すと絞り込まれ、もう一度押すと外れる。**複数選べて、選んだタグのどれかを持つものが出る**（AND ではなく OR）。「絞り込みを外す」で全部戻る。カードや年ラベルの中のタグを押しても同じように切り替わる。

絞り込みの状態は `/?tags=music,book` として URL に入るので、そのまま共有できるしブラウザの戻るも効く。ページ遷移はせず、`document.startViewTransition()` で 0.5 秒かけて並べ替えのアニメーションをする。見えている分だけで左右の振り分けを決め直し、中身が無くなった年は畳むので、絞り込んだあともトップと同じ見た目になる。

タグごとの静的ページ（`/tags/<tag>/`）は持っていない。絞り込みが全部この画面で完結するため。

タイムラインは縦線の左右にカードが交互に並ぶ形（[daisyUI の timeline](https://daisyui.com/components/timeline/)）。記事は塗りつぶしのノード+タイトルと説明文、ひとことは白抜きのノード+本文全文。狭い画面では線が左端に寄って片側に積まれる。

スタイルは素の CSS が主体で、daisyUI（Tailwind CSS 4）はタイムラインのレイアウトにだけ使っている。Tailwind の preflight は読み込んでいない（既存の見た目とマークダウン本文を壊さないため）。daisyUI の色は `src/styles/global.css` でこのサイトの配色に差し替えている。

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

## ひとことを書く

`src/content/notes/<slug>/index.md` を作る。URL は `/notes/<slug>/`。slug は日時から作る（`2026-10-31-1430`）。

```md
---
date: 2026-10-31T14:30   # 必須。時刻まで入れる
title: タイトル           # 任意。無いと日付が見出しになる
tags: [music]            # 任意
draft: false             # 任意。既定は公開
---
```

`date` に時刻を持たせているので、同じ日に何本書いても slug が衝突せず、同日内の並び順も時刻で決まる。画像は記事と同じくフォルダに置いてファイル名で参照する。

### エディタ画面（/admin）で書く

Sveltia CMS を置いていて、**記事とひとことの両方をここから書ける**。左の一覧が「記事」「ひとこと」に分かれる。

使い方は2通り。

**手元で書く（おすすめ）**

```
pnpm editor
```

dev サーバーを立てて、エディタを**単独ウィンドウ**で開く（Chrome のアプリモードなのでタブもアドレスバーも付かない）。開いたら「ローカルリポジトリで作業」を選んで blog フォルダを指定する。

トークンが要らず、保存すると `src/content/` のファイルが直接書き換わる。commit と push は自分でやる。閉じるときは起動したターミナルで Ctrl+C。

File System Access API を使うので Chrome か Edge が必要。Chrome が無ければ既定のブラウザで普通に開く。`pnpm dev` から手で開く場合は <http://localhost:4321/admin/index.html>（dev はディレクトリの index を解決しないので `/admin/` ではなく `index.html` まで。本番は `/admin/` でよい）。

**公開中のサイトから書く**

<https://blog.katsuki104.workers.dev/admin/> を開いて「アクセストークンを使用してログイン」。トークンは GitHub の fine-grained PAT で、対象リポは `tadokorokantoku/blog` だけ、権限は Contents の Read and write。保存するとそのまま main に commit され、Workers Builds が公開する。「GitHub にログイン」ボタンは OAuth 用の認証サーバーを立てるまで使えない。

#### 挙動のメモ

- 新規は「記事」が `draft: true`、「ひとこと」が `draft: false` で始まる（ひとことは書いたら公開、が既定）
- 記事の slug は右の slug 欄に自分で入れる（`{{fields._slug}}`）。ひとことの slug は `date` から自動で作られる
- slug の日付は `date` フィールドの値から作られる。Sveltia は既定でこれを UTC で読むので、`config.yml` で `slug.timezone: local` にしてある（しないと朝に書いたひとことの slug が前日になる）
- slug が既存のものとぶつかると Sveltia が末尾に連番を付ける。同じ分に2本書いても壊れない
- Sveltia のバージョンは `public/admin/index.html` の URL で固定している

## コマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | 開発サーバー（draft も表示） |
| `pnpm editor` | エディタを単独ウィンドウで開く（dev サーバーごと起動） |
| `pnpm build` | `dist/` に静的ビルド |
| `pnpm preview` | ビルド結果を wrangler でローカル配信 |
| `pnpm check` | 型チェック |

## デプロイ

Workers Builds（Cloudflare ダッシュボードの Git 連携）で `main` への push ごとに自動デプロイする。

- Build command: `pnpm run build`
- Deploy command: `npx wrangler deploy`
