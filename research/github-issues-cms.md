# GitHub Issues を CMS にするときの API・画像・イベント事情

調査日: 2026-09-23 / 対象: public リポ `tadokorokantoku/blog`、`article` ラベル付き Issue を記事として扱う
関連: [#3](https://github.com/tadokorokantoku/blog/issues/3)

## 結論（要約）

| 論点 | 答え |
|---|---|
| 一覧取得 | REST `GET /repos/{owner}/{repo}/issues?labels=article&state=open` か GraphQL `repository.issues(labels: ["article"])`。どちらも 1 ページ最大 100 件 |
| レート制限 | REST は未認証 60 回/時（IP 単位）、PAT 5,000 回/時、Actions の `GITHUB_TOKEN` 1,000 回/時/リポ。GraphQL は未認証だと使えない（403 を確認済み） |
| Markdown→HTML | `Accept: application/vnd.github.html+json` を付けると `body_html` が返ってくる。GitHub の表示とほぼ同じ HTML になる。ただし画像 URL が **5 分で切れる署名付き URL** に置き換わるので、ビルド時にそのまま埋め込むと壊れる |
| 画像 | `github.com/user-attachments/assets/<uuid>` は public リポなら未認証で読める。外部サイトの Referer 付きでも 200 を確認済み。中身は S3 の署名付き URL への 302 リダイレクト |
| トリガー | Actions の `issues` イベント（`opened` / `edited` / `labeled` / `unlabeled` / `closed` / `deleted` など）と、リポジトリ webhook の `issues` イベント |
| ラベル権限 | ラベルを付け外しできるのは Triage 以上。ただし **Issue テンプレート/フォームの `labels:` は誰が起票しても自動付与される**ので、`article` をテンプレートに入れてはいけない |

---

## 1. `article` ラベルの Issue 一覧を取る

### REST

`GET /repos/{owner}/{repo}/issues` で使えるクエリは `labels`（カンマ区切り）、`state`（open/closed/all）、`sort`、`direction`、`since`、`per_page`（最大 100）、`page` など。
出典: https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#list-repository-issues

- 注意: "GitHub's REST API considers every pull request an issue ... 'Issues' endpoints may return both issues and pull requests"。レスポンスに `pull_request` キーがある要素は PR なので除外する（同上）。
- 未認証で実際に叩いて確認した: `curl -I "https://api.github.com/repos/tadokorokantoku/blog/issues?labels=article&per_page=100"` → 200、`x-ratelimit-limit: 60`、`etag` ヘッダーあり。

### GraphQL

```graphql
query {
  repository(owner: "tadokorokantoku", name: "blog") {
    issues(first: 100, labels: ["article"], states: [OPEN],
           orderBy: {field: CREATED_AT, direction: DESC}) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes { number title createdAt updatedAt body bodyHTML labels(first: 10) { nodes { name } } }
    }
  }
}
```

- `first` / `last` は 1〜100。出典: https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api
- 実際に確認した: `wayfinder:research` ラベルで同じ形のクエリを投げると #4, #3, #2 だけが返った。`cost: 1`。`issues` コネクションは PR を含まないので、REST のような除外処理はいらない。
- **未認証では使えない**: `POST https://api.github.com/graphql` をトークンなしで叩くと 403 だった。

### ページネーション

- REST: レスポンスの `link` ヘッダー（`rel="next"` など）をたどる。`per_page` の上限を超える値を指定するとエラーにはならず、上限まで黙って下げられる。出典: https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api?apiVersion=2022-11-28
- GraphQL: `pageInfo.hasNextPage` / `endCursor` を見て `after:` に渡す。
- 個人ブログの規模なら 100 件を超えるまでは 1 リクエストで全件取れる。

### レート制限

出典: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28

| 認証 | REST の一次制限 |
|---|---|
| 未認証 | 60 回/時（送信元 IP 単位） |
| PAT（fine-grained / classic） | 5,000 回/時 |
| Actions の `GITHUB_TOKEN` | 1,000 回/時/リポ |
| GitHub App のインストールトークン | 最低 5,000 回/時 |

- GraphQL はポイント制で、ユーザーは 5,000 点/時、`GITHUB_TOKEN` は 1,000 点/時/リポ（GraphQL rate limits の出典と同じ）。
- 条件付きリクエスト: "Making a conditional request does not count against your primary rate limit if a `304` response is returned and the request was made while correctly authorized with an `Authorization` header." 出典: https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api?apiVersion=2022-11-28 （**認証ありのときだけ**レート制限を消費しない）
- 二次制限: 同時 100 リクエストまで、REST は 900 ポイント/分まで、などがある（rate limits の出典と同じ）。
- 帰結: Cloudflare Workers からリクエストのたびに**未認証**で API を叩くのは危ない。Workers の送信元 IP は他のユーザーと共有されるため、60 回/時をすぐ使い切る可能性が高い（これは推論で、検証はしていない）。ビルド時に取得するか、PAT を secret に入れてキャッシュを挟む前提で考える。

## 2. Markdown → HTML

### A. `body_html`（Issue API のメディアタイプ）

`Accept: application/vnd.github.html+json` で `body_html` が返る。`full+json` なら `body` / `body_text` / `body_html` が全部返る。出典: https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#list-repository-issues （GraphQL では `bodyHTML` フィールド）

- GitHub 上の表示と同じレンダラーを通るので、GFM の再現度はいちばん高い。
- **落とし穴（実測）**: 公開リポ `cli/cli` の #13608 と #13233 で確認した。`body` の中では `https://github.com/user-attachments/assets/<uuid>` だった画像が、`body_html` では `https://private-user-images.githubusercontent.com/...png?jwt=...` に置き換わっている。JWT の `exp - nbf` は 300 秒で、中の S3 署名も `X-Amz-Expires=300`。さらに `jwt` を外した URL は 404 になった。つまり **`body_html` を静的ビルドに埋め込むと、5 分後には画像が表示されなくなる**。
- `<img>` には GitHub 用の class やインライン style（`js-gh-image-fallback` など）が付く。見出しや段落には `dir="auto"` が付く。

### B. Markdown API（`POST /markdown`）

- パラメータは `text`（必須）、`mode`（`markdown` か `gfm`）、`context`（gfm モードで `#1` などの参照を解決するリポ）。`/markdown/raw` はプレーンテキストを受け付け、上限は 400 KB。出典: https://docs.github.com/en/rest/markdown/markdown?apiVersion=2022-11-28
- 実際に確認した: **未認証でも 200**（`x-ratelimit-limit: 60`）。`mode: gfm` + `context: tadokorokantoku/blog` で次のように変換された。
  - タスクリスト → `<input type="checkbox" disabled class="task-list-item-checkbox">`
  - テーブル → `<markdown-accessiblity-table><table>…`（GitHub 独自のラッパー要素が付く）
  - `> [!NOTE]` → `<div class="markdown-alert markdown-alert-note">` と Octicon の SVG
  - `#1` → Issue へのリンク、`@octocat` → ユーザーへのリンク
- 画像 URL がどう書き換わるかは未確認。B は `body` を自分で渡す形なので、A と違って Issue 取得とは別に 1 回 API を呼ぶことになる。

### C. 自前でレンダリング（unified / remark / rehype）

- `remark-gfm` が対応するのは autolink literal、脚注、打ち消し線、テーブル、タスクリスト。HTML への変換自体は `remark-rehype` の担当。mention・Issue 参照・コミットリンクは `remark-github`、数式は `remark-math` が必要。alerts（`[!NOTE]`）と絵文字ショートコードは remark-gfm の対象外。出典: https://github.com/remarkjs/remark-gfm
- 追加で必要になりそうなプラグイン: alert 用のプラグイン、絵文字（`remark-gemoji` など）、シンタックスハイライト（Shiki など。Astro の Markdown パイプラインにも入っている）。Mermaid はクライアント側で描画する。
- Issue の本文は、GitHub の UI 上では単独の改行も `<br>` として表示される（Issue やコメントは「コメント扱い」のレンダリングのため）。自前で描画して見た目を揃えるなら `remark-breaks` がいる可能性が高い（推論。上の Markdown API テストでは未確認）。
- 画像は `body` 内の `user-attachments` URL をそのまま使えるので、A の期限切れ問題を避けられる。

**推奨の方向性**: 本文は `body`（Markdown 原文）を取得して自前でレンダリングする（C）。これなら画像 URL が安定していて、見た目も自由に決められる。GitHub と完全に同じ見た目が必要なら B を使い、画像 URL が書き換わるかを別途確認する。

## 3. `user-attachments` 画像は外部から表示できるか

- 公式ドキュメント: "For public repositories, uploaded files can be accessed without authentication. In the case of private and internal repositories, only people with access to the repository can view the uploaded files." 画像の上限は 10MB。対応形式は PNG / GIF / JPEG / SVG / 動画。出典: https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files
- 実測（`cli/cli#13608` の画像）:
  - `curl https://github.com/user-attachments/assets/25addea2-...` → `302`（`cache-control: no-cache`）。リダイレクト先は `github-production-user-asset-6210df.s3.amazonaws.com/...?X-Amz-...` の署名付き URL。
  - リダイレクトをたどると `200 image/png`（318,769 bytes）。`Referer: https://example.com/` を付けても 200 で、**Referer によるホットリンク制限はない**。
  - S3 側のレスポンスは `Cache-Control: max-age=2592000`。
- つまり `<img src="https://github.com/user-attachments/assets/...">` をそのまま書けば、ブラウザがリダイレクトをたどって表示する。
- リスク: GitHub のホスティングに依存し続けること。Issue やリポを消したり private にしたりすると画像も見えなくなる（private の場合はドキュメントの記述からの推論）。長く残したいなら、ビルド時に R2 などへコピーしてから URL を書き換える選択肢がある。

## 4. 作成・編集・ラベル付与をトリガーにする

### GitHub Actions の `issues` イベント

- activity types: `opened`, `edited`, `deleted`, `transferred`, `pinned`, `unpinned`, `closed`, `reopened`, `assigned`, `unassigned`, `labeled`, `unlabeled`, `locked`, `unlocked`, `milestoned`, `demilestoned`, `typed`, `untyped`, `field_added`, `field_removed`
- ワークフローファイルはデフォルトブランチに置く必要がある。`GITHUB_SHA` はデフォルトブランチの最新コミット。
- 出典: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- 記事ブログで拾いたいのは `opened`, `edited`, `labeled`, `unlabeled`, `closed`, `reopened`, `deleted` あたり。`issue_comment` は本文と関係ないので不要。
- `GITHUB_TOKEN` で起こした操作は、`workflow_dispatch` と `repository_dispatch` を除いて新しいワークフローを起動しない（同上）。
- public リポでは**誰でも Issue を立てられる**ので、第三者の起票でも `issues` ワークフローは起動する。ジョブ側に `if: contains(github.event.issue.labels.*.name, 'article')` のような条件を入れて、無駄なビルドを防ぐ。

### Webhook

- `issues` イベントはリポジトリ webhook・Organization webhook・GitHub App で受け取れる。App が購読するには Issues の read 権限が必要。`edited` の payload の `changes` には変更前の title / body が入る。`labeled` / `unlabeled` の payload には `label` オブジェクトが入る。出典: https://docs.github.com/en/webhooks/webhook-events-and-payloads#issues
- Workers で直接受ける（署名 `X-Hub-Signature-256` を検証してキャッシュを purge する）構成もできる。

## 5. `article` ラベルは誰が付けられるか

- リポジトリロールの表: "Apply/dismiss labels" ができるのは Triage / Write / Maintain / Admin で、Read はできない。ラベル自体の作成・編集・削除は Write 以上。出典: https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization
- API から: "Only users with push access can set labels for new issues. Labels are silently dropped otherwise."（更新時も同様で、黙って捨てられる）。出典: https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#create-an-issue
- 個人リポのコラボレーターは書き込み権限を持つので、ラベルを付けられる。他人に Triage 権限を渡していなければ、付けられるのはオーナーとコラボレーターだけ。
- **抜け穴1: Issue テンプレート/フォームの `labels:`** — "Labels that will automatically be added to issues created with this template." 起票者の権限についての記述はない。出典: https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms 。`.github/ISSUE_TEMPLATE` に `labels: [article]` を書かないこと（現時点でリポにテンプレートはない）。
- **抜け穴2: 本文の編集権限** — 第三者が立てた Issue にオーナーが `article` を付けると、起票者は後から本文を自由に書き換えられる。さらに安全にするなら、記事として扱う条件に「作成者がオーナー（`issue.user.login == 'tadokorokantoku'` や `author_association` が `OWNER`）」を加える。

## 未検証のまま残っていること

- Markdown API（B）が `user-attachments` の画像 URL をどう書き換えるか。
- Workers の送信元 IP から未認証 API を叩いたときに、実際どれくらいの頻度でレート制限にかかるか。
