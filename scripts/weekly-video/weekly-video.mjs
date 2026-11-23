// pnpm weekly-video <YYYY-Www> [--out <dir>]
// Builds out/<week>.mp4 and its poster <week>.jpg from the script in
// weeks/<week>.json, ready to upload to R2 (see the top-level README). Without a script, writes a template there and stops.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { isWeekId, loadWeekData } from './week-data.mjs';
import { buildScript, loadOrTemplate } from './script.mjs';
import { checkNarration, durationOf, narrate } from './narrate.mjs';
import { poster, render } from './render.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const HERE = import.meta.dirname;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { week: { type: 'string' }, out: { type: 'string' } },
});
const week = values.week ?? positionals[0];
if (!week || !isWeekId(week)) {
  console.error('usage: pnpm weekly-video <YYYY-Www> [--out <dir>]   e.g. pnpm weekly-video 2026-W48');
  process.exit(2);
}

const data = loadWeekData(ROOT, week);
console.log(`${week} (${data.from} 〜 ${data.to})`, data.counts);

const scriptFile = path.join(HERE, 'weeks', `${week}.json`);
const raw = loadOrTemplate(scriptFile, data);
if (!raw) {
  console.log(`\nNo script yet. Wrote a template to ${path.relative(ROOT, scriptFile)}.`);
  console.log('Replace every TODO (narration, subtitles, cards), then run this again.');
  process.exit(1);
}
const script = buildScript(raw, data);
checkNarration(script.scenes);

const outDir = path.resolve(values.out ?? path.join(HERE, 'out'));
const workDir = path.join(HERE, '.cache', week);
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(workDir, { recursive: true });

const startedAt = Date.now();
const timings = await narrate(script, workDir);
const mp4 = path.join(outDir, `${week}.mp4`);
await render(script, timings, workDir, mp4);
poster(mp4, path.join(outDir, `${week}.jpg`));

const size = fs.statSync(mp4).size / 1048576;
console.log(`\n${path.relative(ROOT, mp4)}: ${durationOf(mp4).toFixed(2)}s, ${size.toFixed(2)} MB, took ${((Date.now() - startedAt) / 1000).toFixed(0)}s`);
