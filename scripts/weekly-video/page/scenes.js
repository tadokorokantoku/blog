// Per-scene renderers for the 16:9 frame. Content lives in the band between
// the header (y≈64) and the subtitle box (SUB_Y), split into columns.
// The topic renderers are in topics.js.

function drawTopicList(x, y, w, h, title, t0, t) {
  panel(x, y, w, h, { fill: 'rgba(8, 12, 26, 0.78)' });
  ctx.font = font(800, 34);
  ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'left';
  ctx.fillText(title, x + 44, y + 76);
  const rowH = (h - 130) / sceneData.teaser.length;
  sceneData.teaser.forEach((topic, i) => {
    const ry = y + 110 + i * rowH;
    ctx.globalAlpha = easeOutCubic(clamp01((t - t0 - i * 0.25) / 0.5));
    panel(x + 32, ry, w - 64, rowH - 20, { fill: 'rgba(255, 255, 255, 0.05)', stroke: 'rgba(255, 255, 255, 0.1)', r: 20 });
    const cy = ry + (rowH - 20) / 2;
    ctx.beginPath();
    ctx.arc(x + 100, cy, 36, 0, Math.PI * 2);
    ctx.fillStyle = STEP_COLORS[i];
    ctx.fill();
    ctx.font = font(900, 36);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), x + 100, cy + 2);
    ctx.textBaseline = 'alphabetic';
    const { size, lines } = fitText(topic, 700, [38, 34, 30], w - 220, 2);
    ctx.font = font(700, size);
    ctx.fillStyle = '#f1f5f9';
    ctx.textAlign = 'left';
    const lh = size * 1.3;
    const first = cy - (lh * (lines.length - 1)) / 2 + size * 0.35;
    lines.forEach((l, k) => ctx.fillText(l, x + 160, first + k * lh));
  });
}

// Title on the left, the week's three topics on the right.
function renderIntro(t) {
  const enter = easeOutBack(clamp01(t / 0.8));
  const colW = 820;
  const cx = M + colW / 2;
  ctx.save();
  ctx.translate(cx, 480);
  ctx.scale(0.8 + 0.2 * enter, 0.8 + 0.2 * enter);
  ctx.translate(-cx, -480);
  panel(cx - 190, 300, 380, 64, { fill: 'rgba(56, 189, 248, 0.15)', stroke: '#38bdf8', lineWidth: 2, r: 32 });
  ctx.font = font(800, 28);
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sceneData.badge, cx, 332);
  ctx.textBaseline = 'alphabetic';
  drawFitted(sceneData.title, { weight: 900, sizes: [88, 80, 72], x: cx, y: 490, maxWidth: colW, maxLines: 1, color: '#ffffff', align: 'center' });
  ctx.font = font(700, 42);
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'center';
  ctx.fillText(sceneData.subtitle, cx, 580);
  ctx.restore();

  ctx.globalAlpha = clamp01((t - 0.5) / 0.5);
  const x = M + colW + 80;
  drawTopicList(x, TOP, W - M - x, BOTTOM - TOP, '🔥 今週の注目 3大テーマ', 0.8, t);
  ctx.globalAlpha = 1;
}

function renderStats(t) {
  ctx.globalAlpha = easeOutCubic(clamp01(t / 0.5));
  ctx.font = font(900, 64);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(sceneData.title, W / 2, TOP + 70);
  ctx.font = font(600, 30);
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(sceneData.caption, W / 2, TOP + 125);
  ctx.globalAlpha = 1;

  const count = easeOutCubic(clamp01((t - 0.3) / 1.5));
  const y = TOP + 170;
  const ch = 400;
  const cw = (W - 2 * M - 3 * GAP) / 4;

  sceneData.stats.forEach((st, i) => {
    const x = M + i * (cw + GAP);
    const pop = easeOutBack(clamp01((t - 0.2 - i * 0.1) / 0.6));
    ctx.save();
    ctx.translate(x + cw / 2, y + ch / 2);
    ctx.scale(pop, pop);
    ctx.translate(-(x + cw / 2), -(y + ch / 2));
    panel(x, y, cw, ch, i === 2 ? { stroke: '#38bdf8', lineWidth: 2.5 } : {});

    ctx.textAlign = 'center';
    ctx.font = font(700, 34);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(st.label, x + cw / 2, y + 80);

    ctx.font = font(900, 120);
    const vg = ctx.createLinearGradient(x, y, x + cw, y + ch);
    vg.addColorStop(0, '#38bdf8');
    vg.addColorStop(1, '#818cf8');
    ctx.fillStyle = vg;
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.floor(count * st.value)), x + cw / 2 + 70, y + 240);
    ctx.font = font(700, 40);
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText(st.unit, x + cw / 2 + 85, y + 240);

    drawFitted(st.desc, { weight: 500, sizes: [30, 26], x: x + cw / 2, y: y + 330, maxWidth: cw - 48, maxLines: 2, color: '#e2e8f0', align: 'center' });
    ctx.restore();
  });

  ctx.globalAlpha = clamp01((t - 1.2) / 0.5);
  const ny = y + ch + 28;
  panel(M, ny, W - 2 * M, BOTTOM - ny, { fill: 'rgba(56, 189, 248, 0.1)', stroke: 'rgba(56, 189, 248, 0.35)', r: 20 });
  drawFitted(sceneData.note, { weight: 600, sizes: [32, 28], x: W / 2, y: ny + (BOTTOM - ny) / 2 + 11, maxWidth: W - 2 * M - 64, maxLines: 1, color: '#7dd3fc', align: 'center' });
  ctx.globalAlpha = 1;
}

// Blog link on the left, the topics covered on the right.
function renderOutro(t) {
  const enter = easeOutBack(clamp01(t / 0.8));
  const colW = 860;
  const cx = M + colW / 2;
  ctx.save();
  ctx.translate(cx, 480);
  ctx.scale(0.85 + 0.15 * enter, 0.85 + 0.15 * enter);
  ctx.translate(-cx, -480);

  ctx.textAlign = 'center';
  ctx.font = font(900, 80);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(sceneData.title, cx, TOP + 120);
  ctx.font = font(700, 34);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(sceneData.subtitle, cx, TOP + 190);

  const cardY = TOP + 250;
  panel(M, cardY, colW, BOTTOM - cardY, { fill: 'rgba(8, 12, 26, 0.88)', stroke: '#38bdf8', lineWidth: 3, glow: 'rgba(56, 189, 248, 0.5)', r: 28 });
  ctx.font = font(800, 30);
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('OFFICIAL BLOG', cx, cardY + 80);
  drawFitted(sceneData.site, { weight: 900, sizes: [56, 50, 44, 40], x: cx, y: cardY + 190, maxWidth: colW - 80, maxLines: 1, color: '#ffffff', align: 'center' });
  ctx.font = font(600, 30);
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('毎週のAI・エージェント動向を深掘り配信中', cx, cardY + 280);
  ctx.restore();

  ctx.globalAlpha = clamp01((t - 0.8) / 0.6);
  const x = M + colW + 60;
  drawTopicList(x, TOP, W - M - x, BOTTOM - TOP, '今週取り上げたトピック', 0.9, t);
  ctx.globalAlpha = 1;
}

const RENDERERS = {
  intro: renderIntro,
  stats: renderStats,
  topic_deepdive: renderTopicDeepdive,
  topic_chart: renderTopicChart,
  outro: renderOutro,
};
