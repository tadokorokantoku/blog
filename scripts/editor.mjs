// エディタ画面（/admin）を単独ウィンドウで開く。Chrome のアプリモードを使うので
// タブもアドレスバーも付かない。
//
//   pnpm editor             公開中のサイトの /admin を開く。サーバー不要。PAT でログイン
//   pnpm editor --local     dev サーバーを立てて手元のリポジトリを直接編集する（トークン不要）
//   pnpm editor --install   Dock から開ける .app を ~/Applications に作る
import { spawn } from 'node:child_process';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_NAME = 'blog エディタ';
const PORT = Number(process.env.PORT ?? 4321);

const args = process.argv.slice(2);
const useLocal = args.includes('--local');
const install = args.includes('--install');
const noOpen = args.includes('--no-open');

/** 公開中のサイトの URL は astro.config.mjs の site から取る */
async function siteUrl() {
  const config = await readFile(new URL('../astro.config.mjs', import.meta.url), 'utf8');
  const site = config.match(/site:\s*'([^']+)'/)?.[1];
  if (!site) throw new Error('astro.config.mjs から site を読めなかった');
  return site.replace(/\/$/, '');
}

/** Chrome のアプリモードで開く。Chrome が無ければ既定のブラウザ */
function openWindow(url) {
  const child = existsSync(CHROME)
    ? spawn('open', ['-na', 'Google Chrome', '--args', `--app=${url}`, '--new-window'])
    : spawn('open', [url]);
  child.on('error', (error) => console.error('ウィンドウを開けなかった:', error.message));
}

/** Dock に置ける .app を作る。中身は Chrome をアプリモードで起動するだけ */
async function installApp(url) {
  const root = join(homedir(), 'Applications', `${APP_NAME}.app`);
  await mkdir(join(root, 'Contents', 'MacOS'), { recursive: true });
  await writeFile(
    join(root, 'Contents', 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>${APP_NAME}</string>
  <key>CFBundleIdentifier</key><string>dev.katsuki.blog-editor</string>
  <key>CFBundleExecutable</key><string>run</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
`,
  );
  const run = join(root, 'Contents', 'MacOS', 'run');
  await writeFile(run, `#!/bin/sh\nexec open -na "Google Chrome" --args --app=${url} --new-window\n`);
  await chmod(run, 0o755);
  return root;
}

/** dev サーバーを立てて、応答するまで待つ */
async function startDevServer(url) {
  const dev = spawn('node_modules/.bin/astro', ['dev', '--port', String(PORT)], { stdio: 'inherit' });
  const stop = () => {
    dev.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch {
      // まだ起動中
    }
    await sleep(500);
  }
  console.error(`dev サーバーが ${url} で応答しなかった`);
  stop();
}

const url = useLocal ? `http://localhost:${PORT}/admin/index.html` : `${await siteUrl()}/admin/`;

if (install) {
  const path = await installApp(url);
  console.log(`作った: ${path}`);
  console.log('Finder の「アプリケーション」から開ける。Dock に入れておけば1クリック');
  console.log(`消すときはこのフォルダごと削除する`);
} else {
  if (useLocal) await startDevServer(url);
  console.log(`\nエディタ: ${url}`);
  console.log(
    useLocal
      ? '「ローカルリポジトリで作業」を選んで blog フォルダを指定する（トークン不要）。閉じるときは Ctrl+C\n'
      : '「アクセストークンを使用してログイン」で入る。保存するとそのまま公開される\n',
  );
  if (!noOpen) openWindow(url);
}
