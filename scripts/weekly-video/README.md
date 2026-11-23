# 週のまとめ動画

週のまとめを横長の動画（1920x1080、30fps、H.264/AAC）にして、`scripts/weekly-video/out/<YYYY-Www>.mp4` とポスター `<YYYY-Www>.jpg`（2秒目の1コマ）に書き出す。R2 へのアップロードと一覧への追加は、リポジトリ直下の README の「週のまとめ」の手順で。

```sh
pnpm weekly-video 2026-W48
# 別の場所へ出すとき
pnpm weekly-video 2026-W47 --out /tmp/w47
```

## 流れ

1. `src/content/news` からその週（ISO 週、月曜始まり、日本時間）の件数と GitHub トレンドの順位を数える。件数は公開日（無ければ収集日時）がその週に入る記事の数。同じ URL でも見出しが違えば別の記事として数える（リリースの新機能と破壊的変更、障害の発生と解消など）。GitHub トレンドは同じリポジトリが毎日載るので、週内にランク入りしたリポジトリの数。
2. 台本 `weeks/<YYYY-Www>.json` を読む。無ければ雛形を書いて止まる。雛形は数字の場面と最初・最後の場面が埋まっていて、トピックは `TODO`。`src/content/news-weekly/<週>.json` があれば、トピックの題と `hints`（その週の要点）が入る。`TODO` が残っているあいだは動画を作らない。
3. AivisSpeech Engine（morioki / ノーマル、速度 0.92）でナレーションを作る。エンジンは `~/tts-local/aivis/macOS-arm64/run`（`AIVIS_ENGINE` で変えられる）を自動で起動し、終わったら止める。
4. `page/*.js` の Canvas をヘッドレス Chrome で実時間で録画し、ffmpeg で音声と合わせてつなぐ。途中のファイルは `.cache/<週>/` に置く（コミットしない）。

かかる時間は動画の長さとだいたい同じ（録画が実時間なので）。録画中に Mac がスリープすると止まるので、長く離れるときは `caffeinate -i pnpm weekly-video ...` で動かす。

## 台本の書き方

`weeks/2026-W47.json` が見本。文字列には次のプレースホルダーが使える。

| プレースホルダー | 中身 |
| --- | --- |
| `{week}` `{year}` `{weekNo}` | `2026-W47` / `2026` / `47` |
| `{period}` | `11/16 〜 11/22` |
| `{periodLong}` | `2026年11月16日〜22日` |
| `{coding-agent}` `{ade}` `{githubtrend}` `{xtrend}` `{hackernews}` | その週の件数 |

- 字幕1行ごとに、ナレーションの1かたまりの読み始めに合わせて切り替わる。かたまりは「。」で切り、足りなければ「、」でも切る。数が字幕の行数と合わないとエラーになる。
- `【` で始まる字幕のところで、トピックのカードの強調が次へ進む。
- `stats` の各項目は `category` で件数を引く。`topic_chart` は `repo`（`owner/name`）の日ごとの順位をデータから描く。
- 読み間違える語は `readings` に書く（字幕はそのまま、読みだけ変わる）。

## 要るもの

macOS、Google Chrome（`CHROME_PATH` で変えられる）、ffmpeg、Node.js 22 以上、AivisSpeech Engine と morioki のモデル。
