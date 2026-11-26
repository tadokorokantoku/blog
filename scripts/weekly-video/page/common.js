// Shared drawing helpers for every scene. Loaded as a classic script, so
// everything here is a global used by topics.js, scenes.js and main.js.

const W = 1920;
const H = 1080;
const M = 80;
const JP_FONT = '-apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function clamp01(v) { return Math.min(1, Math.max(0, v)); }

function font(weight, size) { return `${weight} ${size}px ${JP_FONT}`; }

// Break Japanese text into lines that fit maxWidth. ASCII words stay whole,
// and closing punctuation never starts a line.
const NO_LINE_START = '、。，．・」』）)！？!?ーぁぃぅぇぉっゃゅょァィゥェォッャュョ';
const NO_LINE_END = '「『（(【';
function wrapLines(text, maxWidth) {
  const tokens = text.match(/[A-Za-z0-9.,\-\/:_]+|\s+|./gu) || [];
  const lines = [];
  let line = '';
  for (const tok of tokens) {
    const next = line + tok;
    if (line && ctx.measureText(next).width > maxWidth && !NO_LINE_START.includes(tok[0])) {
      // An opening bracket moves down with the text it opens.
      const carry = NO_LINE_END.includes(line[line.length - 1]) ? line[line.length - 1] : '';
      lines.push(line.slice(0, line.length - carry.length).trimEnd());
      line = carry + tok.trimStart();
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Re-wrap narrower so a two-line caption does not end with a stub like "ク！".
function balance(text, lines, maxWidth) {
  if (lines.length < 2) return lines;
  const even = ctx.measureText(text).width / lines.length;
  for (let w = even * 1.02; w < maxWidth; w += 8) {
    const tried = wrapLines(text, w);
    if (tried.length === lines.length) return tried;
  }
  return lines;
}

// Fewest lines first, then the largest size from `sizes` that fits them, so a
// title shrinks a little rather than leaving one character on a second line.
function fitText(text, weight, sizes, maxWidth, maxLines) {
  for (let n = 1; n <= maxLines; n++) {
    for (const size of sizes) {
      ctx.font = font(weight, size);
      const lines = wrapLines(text, maxWidth);
      // A single unbreakable token (a URL) can still be wider than maxWidth.
      if (lines.length <= n && lines.every(l => ctx.measureText(l).width <= maxWidth)) return { size, lines: balance(text, lines, maxWidth) };
    }
  }
  const size = sizes[sizes.length - 1];
  ctx.font = font(weight, size);
  return { size, lines: wrapLines(text, maxWidth).slice(0, maxLines) };
}

// Draws fitted text with its first baseline at y; returns the y below it.
function drawFitted(text, { weight, sizes, x, y, maxWidth, maxLines, color, align = 'left', lineGap = 1.3 }) {
  const { size, lines } = fitText(text, weight, sizes, maxWidth, maxLines);
  ctx.font = font(weight, size);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * lineGap));
  return y + lines.length * size * lineGap;
}

function panel(x, y, w, h, { fill = 'rgba(10, 15, 30, 0.78)', stroke = 'rgba(255, 255, 255, 0.14)', lineWidth = 1.5, glow = null, r = 24 } = {}) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 20;
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

const particles = Array.from({ length: 40 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  radius: Math.random() * 3 + 1,
  speedY: Math.random() * 0.8 + 0.3,
  alpha: Math.random() * 0.5 + 0.2,
  phase: Math.random() * Math.PI * 2,
}));

function drawProceduralBackground(t) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#090e1d');
  grad.addColorStop(0.5, '#0f172a');
  grad.addColorStop(1, '#050811');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const orbs = [
    { x: 400 + Math.sin(t * 0.8) * 80, y: 250 + Math.cos(t * 0.7) * 60, r: 700, c: 'rgba(56, 189, 248, 0.16)' },
    { x: 1550 + Math.cos(t * 0.6) * 100, y: 800 + Math.sin(t * 0.9) * 60, r: 700, c: 'rgba(129, 140, 248, 0.14)' },
  ];
  for (const o of orbs) {
    const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
    g.addColorStop(0, o.c);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  for (const p of particles) {
    const y = (p.y - t * 40 * p.speedY) % H;
    ctx.beginPath();
    ctx.arc(p.x + Math.sin(t + p.phase) * 20, y < 0 ? y + H : y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(186, 230, 253, ${p.alpha * (0.6 + Math.sin(t * 2 + p.phase) * 0.4)})`;
    ctx.fill();
  }
}

const HEADER_Y = 64;

function drawHeader() {
  ctx.save();
  ctx.beginPath();
  ctx.arc(M + 10, HEADER_Y, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.font = font(800, 36);
  ctx.fillStyle = '#cbd5e1';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Weekly Digest', M + 32, HEADER_Y);

  const bw = 200;
  const bx = W - M - bw;
  panel(bx, HEADER_Y - 25, bw, 50, { fill: 'rgba(255, 255, 255, 0.1)', stroke: 'rgba(255, 255, 255, 0.2)', r: 25 });
  ctx.font = font(700, 24);
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'center';
  ctx.fillText(sceneData.week, bx + bw / 2, HEADER_Y);
  ctx.restore();
}

// Subtitles sit bottom-centre, narrower than the frame so lines stay readable.
const SUB_W = 1440;
const SUB_X = (W - SUB_W) / 2;
const SUB_Y = 884;
const SUB_H = 130;

function currentSubtitle(t) {
  const subs = sceneData.subtitles || [];
  if (!subs.length) return '';
  const hit = subs.find(s => t >= s.start && t < s.end);
  if (hit) return hit.text;
  return t < subs[0].start ? subs[0].text : subs[subs.length - 1].text;
}

function drawFooter(t) {
  ctx.save();
  panel(SUB_X, SUB_Y, SUB_W, SUB_H, {
    fill: 'rgba(8, 12, 26, 0.92)', stroke: '#38bdf8', lineWidth: 2.5, glow: 'rgba(56, 189, 248, 0.4)',
  });

  const { size, lines } = fitText(currentSubtitle(t), 800, [42, 40, 38], SUB_W - 64, 2);
  ctx.font = font(800, size);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lh = size * 1.3;
  const top = SUB_Y + SUB_H / 2 - (lh * (lines.length - 1)) / 2;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * lh));

  const progY = 1044;
  const trackW = W - 2 * M - 100;
  ctx.beginPath();
  ctx.roundRect(M, progY, trackW, 8, 4);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fill();
  const overall = (sceneIdx + t / duration) / totalScenes;
  ctx.beginPath();
  ctx.roundRect(M, progY, Math.max(10, trackW * overall), 8, 4);
  const pg = ctx.createLinearGradient(M, 0, M + trackW, 0);
  pg.addColorStop(0, '#38bdf8');
  pg.addColorStop(1, '#818cf8');
  ctx.fillStyle = pg;
  ctx.fill();

  ctx.font = font(700, 24);
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'right';
  ctx.fillText(`${sceneIdx + 1} / ${totalScenes}`, W - M, progY + 4);
  ctx.restore();
}

// The content band between the header and the subtitle box, shared by the
// scene renderers in topics.js and scenes.js.
const STEP_COLORS = ['#0284c7', '#d97706', '#059669'];
const TOP = 140;
const BOTTOM = SUB_Y - 40;
const GAP = 32;
