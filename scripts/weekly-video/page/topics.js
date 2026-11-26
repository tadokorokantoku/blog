// Topic scenes: three step cards (何が起きたか / なぜ大事か / 次に何を見ておくか),
// highlighted in turn as the narration reaches each one.

// Index of the card being narrated: the last cue whose start time has passed.
function activeCue(t) {
  let idx = 0;
  sceneData.cueStarts.forEach((s, i) => { if (t >= s) idx = i; });
  return idx;
}

function drawTopicHeading(t) {
  ctx.globalAlpha = easeOutCubic(clamp01(t / 0.5));
  ctx.font = font(800, 28);
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'left';
  ctx.fillText(`${sceneData.category.toUpperCase()}  |  ${sceneData.badge}`, M, TOP + 30);
  drawFitted(sceneData.title, {
    weight: 900, sizes: [64, 58, 52], x: M, y: TOP + 105, maxWidth: W - 2 * M, maxLines: 1, color: '#ffffff',
  });
  ctx.globalAlpha = 1;
}

const CARD_TOP = TOP + 160;

function drawStepCard(card, stepIdx, x, y, w, h, { enter, isActive, isPast, accent }) {
  if (enter <= 0.01) return;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  const s = enter * (isActive ? 1.02 : 1);
  ctx.scale(s, s);
  ctx.translate(-(x + w / 2), -(y + h / 2));
  ctx.globalAlpha = isActive ? 1 : (isPast ? 0.8 : 0.55);

  panel(x, y, w, h, isActive
    ? { fill: 'rgba(8, 12, 26, 0.9)', stroke: accent, lineWidth: 3.5, glow: accent }
    : { fill: 'rgba(8, 12, 26, 0.72)' });

  const px = x + 36;
  ctx.beginPath();
  ctx.roundRect(px, y + 30, 260, 46, 12);
  ctx.fillStyle = STEP_COLORS[stepIdx];
  ctx.fill();
  ctx.font = font(800, 26);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(card.step, px + 130, y + 54);
  ctx.textBaseline = 'alphabetic';

  // Tall cards (three across) get a large step numeral and bigger wrapped text;
  // short ones keep one-line headings.
  const roomy = h > 400;
  if (roomy) {
    ctx.font = font(900, 200);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.textAlign = 'right';
    ctx.fillText(String(stepIdx + 1).padStart(2, '0'), x + w - 28, y + h - 30);
  }
  const maxWidth = w - 72;
  const after = drawFitted(card.heading, {
    weight: 800, sizes: roomy ? [46, 42, 38] : [40, 36, 32], x: px, y: y + (roomy ? 150 : 140), maxWidth, maxLines: roomy ? 2 : 1, color: '#ffffff', lineGap: 1.25,
  });
  drawFitted(card.detail, {
    weight: 500, sizes: roomy ? [34, 32, 30] : [30, 28, 26], x: px, y: after + (roomy ? 34 : 14), maxWidth, maxLines: roomy ? 4 : 2, color: '#cbd5e1', lineGap: 1.5,
  });
  ctx.restore();
}

function renderTopicDeepdive(t) {
  drawTopicHeading(t);
  const active = activeCue(t);
  const w = (W - 2 * M - 2 * GAP) / 3;
  sceneData.cards.forEach((card, i) => {
    drawStepCard(card, i, M + i * (w + GAP), CARD_TOP, w, BOTTOM - CARD_TOP, {
      enter: easeOutBack(clamp01((t - 0.2 - i * 0.15) / 0.6)),
      isActive: i === active,
      isPast: i < active,
      accent: '#38bdf8',
    });
  });
}

function drawRankChart(t, x, y, w, h, highlighted) {
  panel(x, y, w, h, highlighted
    ? { fill: 'rgba(8, 12, 26, 0.9)', stroke: '#38bdf8', lineWidth: 3, glow: '#38bdf8' }
    : { fill: 'rgba(8, 12, 26, 0.75)' });

  ctx.font = font(700, 30);
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'left';
  ctx.fillText(`${sceneData.repo}（順位推移）`, x + 36, y + 60);

  const pts = sceneData.trendData;
  const left = x + 110;
  const right = x + w - 70;
  const top = y + 130;
  const bottom = y + h - 80;
  // At least 1〜4位 tall; deeper ranks get every other (or sparser) gridline.
  const maxRank = Math.max(4, ...pts.map(p => p.rank ?? 0));
  const step = maxRank <= 5 ? 1 : Math.ceil((maxRank - 1) / 4);
  const rankY = r => top + ((r - 1) / (maxRank - 1)) * (bottom - top);

  for (let r = 1; r <= maxRank; r += step) {
    ctx.beginPath();
    ctx.moveTo(left, rankY(r));
    ctx.lineTo(right, rankY(r));
    ctx.strokeStyle = r === 1 ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = font(700, 26);
    ctx.fillStyle = r === 1 ? '#38bdf8' : '#94a3b8';
    ctx.textAlign = 'right';
    ctx.fillText(`${r}位`, left - 18, rankY(r) + 9);
  }

  const segs = pts.length - 1;
  const prog = easeOutCubic(clamp01((t - 0.3) / 2.0)) * segs;
  // Days the repo was unranked have rank null: the line breaks there.
  const coords = pts.map((p, i) => ({ px: left + (i / segs) * (right - left), py: p.rank == null ? null : rankY(p.rank) }));

  ctx.beginPath();
  coords.forEach((c, i) => {
    if (c.py == null || i > Math.ceil(prog)) return;
    if (i === 0 || coords[i - 1].py == null) ctx.moveTo(c.px, c.py);
    else if (i <= Math.floor(prog)) ctx.lineTo(c.px, c.py);
    else if (i === Math.ceil(prog)) {
      const p = coords[i - 1];
      const f = prog - Math.floor(prog);
      ctx.lineTo(p.px + (c.px - p.px) * f, p.py + (c.py - p.py) * f);
    }
  });
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 5;
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;

  coords.forEach((c, i) => {
    if (i > Math.floor(prog)) return;
    ctx.font = font(600, 24);
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'center';
    ctx.fillText(pts[i].date, c.px, bottom + 48);
    if (c.py == null) return;
    ctx.beginPath();
    ctx.arc(c.px, c.py, 9, 0, Math.PI * 2);
    ctx.fillStyle = pts[i].rank === 1 ? '#fbbf24' : '#38bdf8';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (pts[i].rank === 1) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('★', c.px, c.py - 20);
    }
  });
}

// Cards on the left, the rank chart on the right.
function renderTopicChart(t) {
  drawTopicHeading(t);
  const active = activeCue(t);
  const cardW = 720;
  const h = (BOTTOM - CARD_TOP - GAP) / 2;
  [1, 2].forEach((i, j) => {
    drawStepCard(sceneData.cards[i], i, M, CARD_TOP + j * (h + GAP), cardW, h, {
      enter: easeOutBack(clamp01((t - 0.6 - j * 0.15) / 0.6)),
      isActive: i === active,
      isPast: i < active,
      accent: '#fbbf24',
    });
  });
  const chartX = M + cardW + GAP;
  drawRankChart(t, chartX, CARD_TOP, W - M - chartX, BOTTOM - CARD_TOP, active === 0);
}
