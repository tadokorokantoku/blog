// Renders each scene in headless Chrome (page/*.js draws on a canvas and
// records it), muxes the narration, and concatenates the clips.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';

const PAGE_DIR = path.join(import.meta.dirname, 'page');
const PAGE_SCRIPTS = ['common.js', 'topics.js', 'scenes.js', 'main.js'];
const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 3789;
const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
// The narration is delayed this much into each scene.
const AUDIO_DELAY = 0.4;

// Each subtitle line shows from where its chunk of narration starts. The first
// line is up from the start of the scene and the last stays until its end.
function retime(scene, timing) {
  const starts = timing.starts.map(s => +(AUDIO_DELAY + s).toFixed(2));
  const subtitles = scene.subtitles.map((text, i) => ({
    text,
    start: i === 0 ? 0 : starts[i],
    end: i === scene.subtitles.length - 1 ? timing.visualDuration : starts[i + 1],
  }));
  const cueStarts = subtitles.filter(s => s.text.startsWith('【')).map(s => s.start);
  return { subtitles, cueStarts: cueStarts.length ? cueStarts : [0] };
}

function sceneHtml(script, scene, timing, idx) {
  const sceneData = { ...scene, ...retime(scene, timing), week: script.week, teaser: script.teaser };
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>body { margin: 0; background: #080d1a; overflow: hidden; } canvas { display: block; }</style>
</head><body>
<canvas id="c" width="${WIDTH}" height="${HEIGHT}"></canvas>
<script>
  const sceneData = ${JSON.stringify(sceneData)};
  const duration = ${timing.visualDuration};
  const fps = ${FPS};
  const sceneIdx = ${idx};
  const totalScenes = ${script.scenes.length};
</script>
${PAGE_SCRIPTS.map(f => `<script src="/page/${f}"></script>`).join('\n')}
</body></html>`;
}

// Recording runs in real time, so a scene that has not uploaded well after
// its length has stalled (it happens when the Mac sleeps mid-render).
function recordScene(html, webmPath, duration) {
  return new Promise((resolve, reject) => {
    let chrome;
    const timer = setTimeout(() => {
      chrome?.kill();
      server.close();
      reject(new Error(`recording did not finish within ${duration + 60}s`));
    }, (duration + 60) * 1000);
    const server = http.createServer((req, res) => {
      const { pathname } = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
      }
      if (req.method === 'POST' && pathname === '/upload') {
        req.pipe(fs.createWriteStream(webmPath));
        req.on('end', () => {
          res.end('ok');
          clearTimeout(timer);
          // Chrome stays alive after window.close() in headless mode.
          chrome.kill();
          server.close(() => resolve());
        });
        return;
      }
      const name = pathname.startsWith('/page/') && path.basename(pathname);
      if (req.method === 'GET' && PAGE_SCRIPTS.includes(name)) {
        res.writeHead(200, { 'Content-Type': 'text/javascript' });
        fs.createReadStream(path.join(PAGE_DIR, name)).pipe(res);
        return;
      }
      res.writeHead(404);
      res.end();
    });

    server.listen(PORT, () => {
      chrome = spawn(CHROME_PATH, [
        '--headless', '--autoplay-policy=no-user-gesture-required', `--window-size=${WIDTH},${HEIGHT}`, `http://localhost:${PORT}/`,
      ], { stdio: 'ignore' });
      chrome.on('error', err => {
        clearTimeout(timer);
        server.close();
        reject(err);
      });
    });
  });
}

export async function render(script, timings, workDir, outMp4) {
  const clips = [];
  for (const [i, scene] of script.scenes.entries()) {
    const timing = timings[i];
    const webmPath = path.join(workDir, `${scene.id}.webm`);
    const clipPath = path.join(workDir, `${scene.id}.mp4`);
    console.log(`[${i + 1}/${script.scenes.length}] ${scene.id} (${timing.visualDuration}s)`);

    fs.rmSync(webmPath, { force: true });
    await recordScene(sceneHtml(script, scene, timing, i), webmPath, timing.visualDuration);

    const delayMs = AUDIO_DELAY * 1000;
    execSync(`ffmpeg -v error -y -i "${webmPath}" -i "${timing.m4aPath}" \
      -filter_complex "[0:v]fps=${FPS}[v];[1:a]adelay=${delayMs}|${delayMs},apad[a]" \
      -map "[v]" -map "[a]" -c:v libx264 -preset fast -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -t ${timing.visualDuration} "${clipPath}"`);
    clips.push(clipPath);
  }

  const listPath = path.join(workDir, 'concat_list.txt');
  fs.writeFileSync(listPath, clips.map(c => `file '${c}'`).join('\n'), 'utf-8');
  execSync(`ffmpeg -v error -y -f concat -safe 0 -i "${listPath}" -c copy -movflags +faststart "${outMp4}"`);
}

// The poster is the frame 2s in, while the intro title is up.
export function poster(mp4, jpg) {
  execSync(`ffmpeg -v error -y -ss 2 -i "${mp4}" -frames:v 1 -q:v 3 "${jpg}"`);
}
