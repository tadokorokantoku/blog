// Narrates every scene with AivisSpeech (voice: morioki) through the engine's
// local VOICEVOX-compatible API. Starts the engine if it is not already up and
// stops it again when done.
//
// The whole narration is synthesized in one take so the prosody stays natural.
// To know where each subtitle line's speech begins, every subtitle-sized chunk
// is also synthesized alone just to measure it; the estimated boundaries are
// then snapped to the nearest pause in the real take.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execSync } from 'node:child_process';

const ENGINE_BIN = process.env.AIVIS_ENGINE || path.join(os.homedir(), 'tts-local/aivis/macOS-arm64/run');
const ENGINE_URL = 'http://127.0.0.1:10101';
const STYLE_ID = 497929760; // morioki / ノーマル
// Slightly slower than default: at 1.0 words like 独占 and Nasdaq blur.
const SPEED = 0.92;
const SNAP_WINDOW = 0.8;

// Sentences of the narration, with the first comma-joined sentence split
// until there is one chunk per subtitle line.
function narrationUnits(narration, count) {
  const units = narration.split('。').map(u => u.trim()).filter(Boolean);
  while (units.length < count) {
    const i = units.findIndex(u => u.includes('、'));
    if (i < 0) break;
    const cut = units[i].indexOf('、');
    units.splice(i, 1, units[i].slice(0, cut), units[i].slice(cut + 1));
  }
  return units;
}

// Each subtitle line is timed to one chunk of narration, so the counts must match.
export function checkNarration(scenes) {
  for (const { id, narration, subtitles } of scenes) {
    const n = narrationUnits(narration, subtitles.length).length;
    if (n !== subtitles.length) {
      throw new Error(`${id}: narration splits into ${n} chunks (at 。 then 、) but there are ${subtitles.length} subtitles`);
    }
  }
}

// Spoken form of the text: the script's `readings` map fixes words the engine
// reads wrongly or unclearly, without touching the on-screen subtitles.
function spoken(text, readings) {
  return Object.entries(readings).reduce((t, [from, to]) => t.split(from).join(to), text);
}

async function engineUp() {
  try {
    return (await fetch(`${ENGINE_URL}/version`)).ok;
  } catch {
    return false;
  }
}

async function startEngine() {
  if (await engineUp()) return null;
  console.log('Starting AivisSpeech Engine...');
  const engine = spawn(ENGINE_BIN, ['--host', '127.0.0.1', '--port', '10101', '--disable_sentry'], { stdio: 'ignore' });
  for (let i = 0; i < 90; i++) {
    if (await engineUp()) return engine;
    await new Promise(r => setTimeout(r, 1000));
  }
  engine.kill();
  throw new Error('AivisSpeech Engine did not come up on :10101');
}

async function synthesize(text, wavPath) {
  const q = new URLSearchParams({ text, speaker: String(STYLE_ID) });
  const query = await (await fetch(`${ENGINE_URL}/audio_query?${q}`, { method: 'POST' })).json();
  query.speedScale = SPEED;
  const res = await fetch(`${ENGINE_URL}/synthesis?speaker=${STYLE_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });
  if (!res.ok) throw new Error(`synthesis failed (${res.status}) for: ${text}`);
  fs.writeFileSync(wavPath, Buffer.from(await res.arrayBuffer()));
}

// Where speech resumes after each pause in an audio file.
function pauseEnds(file) {
  const log = execSync(`ffmpeg -nostats -i "${file}" -af silencedetect=n=-40dB:d=0.1 -f null - 2>&1`).toString();
  return [...log.matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1]);
}

// Where each chunk starts in the full take: the chunks' measured lengths,
// scaled to the take, each boundary moved to where speech resumes after the
// closest pause nearby.
function chunkStarts(chunkLengths, takeFile, takeLength) {
  const k = takeLength / chunkLengths.reduce((a, b) => a + b, 0);
  const pauses = pauseEnds(takeFile);
  const starts = [0];
  let acc = 0;
  for (const len of chunkLengths.slice(0, -1)) {
    acc += len * k;
    const near = pauses.filter(p => Math.abs(p - acc) <= SNAP_WINDOW).sort((a, b) => Math.abs(a - acc) - Math.abs(b - acc))[0];
    starts.push(near ?? acc);
  }
  return starts;
}

export function durationOf(file) {
  return parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${file}"`).toString());
}

// Writes <scene id>.m4a per scene into workDir and returns each scene's timing.
export async function narrate(script, workDir) {
  const readings = script.readings || {};
  const engine = await startEngine();
  const timings = [];

  try {
    for (const [i, scene] of script.scenes.entries()) {
      console.log(`[${i + 1}/${script.scenes.length}] ${scene.id}`);
      const takeWav = path.join(workDir, `${scene.id}.wav`);
      await synthesize(spoken(scene.narration, readings), takeWav);
      const audioDuration = durationOf(takeWav);

      const units = narrationUnits(scene.narration, scene.subtitles.length);
      const unitLengths = [];
      for (const [u, unit] of units.entries()) {
        const wav = path.join(workDir, `${scene.id}_unit${u}.wav`);
        await synthesize(spoken(unit, readings), wav);
        unitLengths.push(durationOf(wav));
        fs.unlinkSync(wav);
      }
      const starts = chunkStarts(unitLengths, takeWav, audioDuration);

      const m4aPath = path.join(workDir, `${scene.id}.m4a`);
      execSync(`ffmpeg -v error -y -i "${takeWav}" -c:a aac -b:a 192k "${m4aPath}"`);
      fs.unlinkSync(takeWav);
      // 0.4s lead-in (the renderer's AUDIO_DELAY) plus a tail before the next scene.
      const visualDuration = Math.ceil((audioDuration + 1.2) * 10) / 10;
      timings.push({ id: scene.id, audioDuration, visualDuration, starts, m4aPath });
      console.log(`   -> Audio: ${audioDuration.toFixed(2)}s, Visual: ${visualDuration.toFixed(2)}s, lines at ${starts.map(s => s.toFixed(2)).join(' / ')}s`);
    }
  } finally {
    if (engine) {
      engine.kill();
      console.log('Stopped AivisSpeech Engine.');
    }
  }
  return timings;
}
