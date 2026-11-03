# blog

Astro で作った個人ブログ。静的ビルドして Cloudflare Workers（Static Assets）で配信する。

書けるものは2種類ある。

| | 置き場所 | URL | 用途 |
| --- | --- | --- | --- |
| 記事 | `src/content/posts/<slug>/index.md` | `/posts/<slug>/` | 長文。タイトルと説明文が必須 |
| ひとこと | `src/content/notes/<slug>/index.md` | `/notes/<slug>/` | 短文。タイトルは任意 |

どっちもタグを持ち、トップ `/` で時系列に混ざって並ぶ（タイムライン）。年ごとに区切られるので、興味の変遷が上から下に読める。

これとは別に、AI が集めたニュースが `/news` に並ぶ（自分では書かない。[ニュース](#ニュース)）。

- `/` … 記事+ひとことのタイムライン（全件・1ページ）。タグの絞り込みもここでやる
- `/posts/<slug>/`, `/notes/<slug>/` … 個別ページ
- `/news/`, `/news/<category>/` … ニュースの一覧とカテゴリ別
- `/rss.xml` … 記事とひとことを1本にまとめたフィード。ひとことは本文全文が入る。ニュースは入らない

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

## ニュース

AI が定期的に集めたニュースを `/news` に出す。収集するのは別の仕組みで、このリポジトリは**置かれた JSON を読んで並べるだけ**。

### 収集側が書くファイル

`src/content/news/<category>/<YYYY-MM-DD>.json` に、**1カテゴリ1日ぶんで1ファイル**。1ファイルの中に、その日の記事を `items` として何件でも入れる。

カテゴリは4つで、これ以外の値はビルドで弾かれる。

| `category` | 表示名 | 中身 |
| --- | --- | --- |
| `xtrend` | X トレンド | X で伸びているもの（Grokbot の出力を手で貼る） |
| `githubtrend` | GitHub トレンド | GitHub のトレンドリポジトリ |
| `claude-code` | Claude Code | Claude Code まわり |
| `orca` | Orca | Orca まわり |

```jsonc
{
  "category": "githubtrend",      // 必須。上の4つのどれか。フォルダ名と揃える
  "collectedAt": "2026-11-03T09:00", // 必須。収集した日時（分まで）
  "items": [
    {
      "title": "記事のタイトル",     // 必須
      "url": "https://...",        // 必須。絶対 URL
      "source": "GitHub",          // 必須。行に `from: GitHub` として出る
      "summary": "2〜3行の要約",     // 任意。3行で切られる
      "image": "https://...",      // 任意。絶対 URL。無ければサムネ無しの行になる
      "publishedAt": "2026-11-02", // 任意。無ければ collectedAt の日時で並ぶ
      "rank": 1,                   // 任意。githubtrend だけ。1位からの順位
      "stars": 1284                // 任意。githubtrend だけ。その日に獲得した star 数
    }
  ]
}
```

画像は外部 URL をそのまま読む（ビルド時に落としてこない）。ホットリンクを弾くドメインの URL を入れると画像が割れるので、OGP 画像のように外から読める URL を入れる。

並び順は `publishedAt ?? collectedAt` の降順。カテゴリ一覧と日本語の表示名、カテゴリごとの表示（`layout`）は `src/consts.ts` の `NEWS_CATEGORIES` が持っていて、Zod のスキーマ・タブ・ページ生成・表示の出し分けが全部そこを読む。カテゴリを増やすときはここと `public/admin/config.yml` の select を直す。

### GitHub トレンドだけランキングの表になる

`githubtrend` は `layout: 'ranking'` なので、`/news/githubtrend/` が行のリストではなく**順位 / 変動 / リポジトリ / 獲得スターの表**になる。出るのは**最新の収集日の上位10件**だけ。他のカテゴリは `layout: 'list'` のままで行形式。

このカテゴリのファイルには `rank` と `stars` を入れる。`rank` の無いエントリは表に出ない。

**前日比は書かなくていい。** 収集側はその日の順位だけ書けばよくて、変動（`NEW` / 何位上昇 / 何位下降 / 変化なし）はビルド時に計算する。比べる相手は日付の引き算ではなく**そのカテゴリで今日より前にある最も新しい収集日**なので、収集が1日飛んでも動く。同じ `url` のエントリ同士を突き合わせるので、URL は日をまたいで同じものを書くこと。前の収集日がまだ無いときは全件が変化なしになる。

`/news/` の混在一覧は時系列の行形式のままで、`rank` を持つ記事だけタイトルの前に `#1` が付く。

## エディタ画面（/admin）で書く

Sveltia CMS を置いていて、**記事・ひとこと・ニュースのどれもここから書ける**。左の一覧が「記事」「ひとこと」「ニュース」に分かれる。

ニュースは1エントリが1カテゴリの1日ぶんで、カテゴリと収集日時を選んでから「記事」のリストに1件ずつ足す。保存先は `src/content/news/<category>/<YYYY-MM-DD>.json` になる。X トレンドは Grokbot の出力をここに手で貼る。

**普段はこっち（サーバー不要）**

```
pnpm editor            # 公開中の /admin を単独ウィンドウで開く
pnpm editor --install  # Dock から開ける .app を ~/Applications に作る（最初の1回だけ）
```

Chrome のアプリモードで開くのでタブもアドレスバーも付かない。`--install` で作った `blog エディタ.app` を Dock に入れておけば、ターミナルも dev サーバーも無しで1クリックで開く。中身は Chrome をアプリモードで起動するだけのシェルスクリプトなので、消すときは `~/Applications/blog エディタ.app` をフォルダごと削除する。

ログインは「アクセストークンを使用してログイン」。トークンは GitHub の fine-grained PAT で、対象リポは `tadokorokantoku/blog` だけ、権限は Contents の Read and write。**保存するとそのまま main に commit され、Workers Builds が公開する。**

**「GitHub にログイン」ボタンは押しても 404 になる。** Sveltia は `backend.base_url` が無いと OAuth の仲介を Netlify のサービスに投げるが、あれは廃止済みなので 404 が返る。使いたいなら `sveltia-cms-auth` のような認証サーバーを別に立てて `base_url` を設定する。立てていないので、ログインは必ずアクセストークンの方を使う。

トークンはブラウザに保存されるので毎回は要らないが、**サイトのオリジンが変わると消える**（保存先がオリジンごとに分かれるため）。ドメインを変えた直後は入れ直しになる。

**手元のファイルを直接いじりたいとき**

```
pnpm editor --local
```

dev サーバーを立てて localhost の `/admin` を開く。「ローカルリポジトリで作業」を選んで blog フォルダを指定すると、トークン無しで `src/content/` のファイルを直接書き換えられる。commit と push は自分でやる。閉じるときは起動したターミナルで Ctrl+C。

ローカルリポジトリのモードは File System Access API を使うので Chrome か Edge でしか出ない。公開中のサイトの `/admin/` には出ない（localhost 限定）。

### 挙動のメモ

- 新規は「記事」が `draft: true`、「ひとこと」が `draft: false` で始まる（ひとことは書いたら公開、が既定）
- 記事の slug は右の slug 欄に自分で入れる（`{{fields._slug}}`）。ひとことの slug は `date` から自動で作られる
- slug の日付は `date` フィールドの値から作られる。Sveltia は既定でこれを UTC で読むので、`config.yml` で `slug.timezone: local` にしてある（しないと朝に書いたひとことの slug が前日になる）
- slug が既存のものとぶつかると Sveltia が末尾に連番を付ける。同じ分に2本書いても壊れない
- ニュースの slug は `collectedAt` の日付、置き場所は `category` の値（`path: '{{category}}/{{slug}}'`）。同じカテゴリの同じ日を2回作ると連番が付くので、その日の分は1エントリにまとめて追記する
- Sveltia のバージョンは `public/admin/index.html` の URL で固定している

## コマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | 開発サーバー（draft も表示） |
| `pnpm editor` | エディタ（公開中の /admin）を単独ウィンドウで開く |
| `pnpm editor --local` | dev サーバーを立てて手元のリポジトリを直接編集する |
| `pnpm build` | `dist/` に静的ビルド |
| `pnpm preview` | ビルド結果を wrangler でローカル配信 |
| `pnpm check` | 型チェック |

## デプロイ

公開先は <https://inok.dev>。Workers Builds（Cloudflare ダッシュボードの Git 連携）で `main` への push ごとに自動デプロイする。

- Build command: `pnpm run build`
- Deploy command: `npx wrangler deploy`

ドメインは Cloudflare Registrar で取っている。`wrangler.jsonc` の `routes` に `custom_domain: true` で書いてあるので、deploy のたびに Workers のカスタムドメインとして登録される。DNS と証明書は Cloudflare 側が勝手にやるのでダッシュボードを触る必要はない。

`.dev` は TLD ごと HSTS preload なので `http://` は存在しない。サイトの URL は `astro.config.mjs` の `site` が持っていて、RSS と各ページの canonical がそこから作られる。
