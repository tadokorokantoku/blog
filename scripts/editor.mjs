// エディタ画面を単独ウィンドウで開く。
// dev サーバーを立てて、Chrome のアプリモード（ブラウザの UI が付かないウィンドウ）で /admin を表示する。
// ローカルなのでトークンは要らず、「ローカルリポジトリで作業」でこのリポジトリを直接書き換えられる。
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = Number(process.env.PORT ?? 4321);
const URL_TO_OPEN = `http://localhost:${PORT}/admin/index.html`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const noOpen = process.argv.includes('--no-open');

const dev = spawn('node_modules/.bin/astro', ['dev', '--port', String(PORT)], { stdio: 'inherit' });

const stop = () => {
  dev.kill('SIGTERM');
  process.exit(0);
};

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

// dev サーバーが応答するまで待つ
let ready = false;
for (let i = 0; i < 60; i += 1) {
  try {
    const response = await fetch(URL_TO_OPEN, { signal: AbortSignal.timeout(1000) });
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {
    // まだ起動中
  }
  await sleep(500);
}

if (!ready) {
  console.error(`dev サーバーが ${URL_TO_OPEN} で応答しなかった`);
  stop();
}

console.log(`\nエディタ: ${URL_TO_OPEN}`);
console.log('「ローカルリポジトリで作業」を選んで blog フォルダを指定する（トークン不要）');
console.log('閉じるときは Ctrl+C\n');

if (!noOpen) {
  // Chrome のアプリモードならアドレスバーもタブも付かない単独ウィンドウになる。
  // Chrome が無ければ既定のブラウザで開く
  const { existsSync } = await import('node:fs');
  const opener = existsSync(CHROME)
    ? spawn('open', ['-na', 'Google Chrome', '--args', `--app=${URL_TO_OPEN}`, '--new-window'], { stdio: 'inherit' })
    : spawn('open', [URL_TO_OPEN], { stdio: 'inherit' });
  opener.on('error', (error) => console.error('ウィンドウを開けなかった:', error.message));
}
