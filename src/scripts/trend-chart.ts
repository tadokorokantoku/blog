// TrendChart.astro の操作。期間の切り替え、1本だけの強調、点のツールチップ。
// 描画はビルド時に済んでいるので、ここは属性とクラスを付け外しするだけ

const MD = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'UTC' });

// タップで固定した強調。マウスが離れても、もう一度タップするまで残す
let pinned: { figure: Element; key: string } | undefined;

function highlight(figure: Element, key: string | undefined) {
  figure.classList.toggle('is-focusing', key !== undefined);
  for (const el of figure.querySelectorAll<HTMLElement>('.trend-line, .trend-legend-item')) {
    el.classList.toggle('is-active', el.dataset.key === key);
  }
  // 強調した線を最前面に出す。SVG は z-index が効かないので末尾へ移す
  const line = key === undefined ? null : figure.querySelector(`.trend-line[data-key="${key}"]`);
  line?.parentElement?.append(line);
}

function restore(figure: Element) {
  highlight(figure, pinned?.figure === figure ? pinned.key : undefined);
}

function showTip(root: HTMLElement, point: SVGCircleElement) {
  const tip = root.querySelector<HTMLElement>('.trend-tip');
  const line = point.closest<SVGGElement>('.trend-line');
  if (!tip || !line) return;
  const { day = '', rank, stars, note } = point.dataset;
  const { title = '', url = '' } = line.dataset;

  tip.replaceChildren();
  const link = Object.assign(document.createElement('a'), { href: url, target: '_blank', rel: 'noopener noreferrer' });
  link.textContent = title;
  const meta = document.createElement('span');
  const starText = stars ? `・★${Number(stars).toLocaleString('ja-JP')}` : '';
  meta.textContent = `${MD.format(new Date(`${day}T00:00:00Z`))} ${rank}位${starText}`;
  tip.append(link, meta);
  if (note) tip.append(Object.assign(document.createElement('span'), { className: 'trend-tip-note', textContent: note }));

  tip.hidden = false;
  const box = root.getBoundingClientRect();
  const at = point.getBoundingClientRect();
  // はみ出す側に寄せる。上に置けないときは点の下に出す
  const left = Math.min(Math.max(at.left + at.width / 2 - box.left - tip.offsetWidth / 2, 0), box.width - tip.offsetWidth);
  const above = at.top - box.top - tip.offsetHeight - 8;
  tip.style.left = `${left}px`;
  tip.style.top = `${above >= 0 ? above : at.bottom - box.top + 8}px`;
}

function hideTip(root: HTMLElement) {
  const tip = root.querySelector<HTMLElement>('.trend-tip');
  if (tip) tip.hidden = true;
}

function mount(root: HTMLElement) {
  if (root.dataset.mounted) return;
  root.dataset.mounted = 'true';

  // 最新の日が右端にあるので、横スクロールになる狭い画面では右端から見せる
  const scrollToEnd = () => {
    for (const scroller of root.querySelectorAll<HTMLElement>('.trend-figure:not([hidden]) .trend-scroll')) {
      scroller.scrollLeft = scroller.scrollWidth;
    }
  };
  scrollToEnd();

  root.addEventListener('click', (event) => {
    const target = event.target as Element;
    const range = target.closest<HTMLButtonElement>('.trend-range');
    if (range) {
      for (const button of root.querySelectorAll('.trend-range')) {
        button.setAttribute('aria-pressed', String(button === range));
      }
      for (const figure of root.querySelectorAll<HTMLElement>('.trend-figure')) {
        figure.hidden = figure.dataset.range !== range.dataset.range;
      }
      hideTip(root);
      scrollToEnd();
      return;
    }

    // 線・凡例のタップで強調を固定する。同じものをもう一度押すと外れる
    const item = target.closest<HTMLElement>('.trend-line, .trend-legend-item button');
    const figure = target.closest('.trend-figure');
    if (!figure) return;
    const key = item?.closest<HTMLElement>('[data-key]')?.dataset.key;
    if (target.closest('a')) return;
    pinned = key === undefined || (pinned?.figure === figure && pinned.key === key) ? undefined : { figure, key };
    restore(figure);
    const point = target.closest<SVGCircleElement>('.trend-point');
    if (point) showTip(root, point);
    else hideTip(root);
  });

  root.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch') return;
    const target = event.target as Element;
    const figure = target.closest('.trend-figure');
    const key = target.closest<HTMLElement>('.trend-line, .trend-legend-item')?.dataset.key;
    if (figure && key !== undefined) highlight(figure, key);
    const point = target.closest<SVGCircleElement>('.trend-point');
    if (point) showTip(root, point);
  });

  root.addEventListener('pointerout', (event) => {
    if (event.pointerType === 'touch') return;
    const target = event.target as Element;
    const figure = target.closest('.trend-figure');
    // ツールチップのリンクへ移る間に消えないよう、行き先がツールチップなら残す
    const to = event.relatedTarget as Element | null;
    if (to?.closest('.trend-tip')) return;
    if (target.closest('.trend-point, .trend-tip')) hideTip(root);
    if (figure && target.closest('.trend-line, .trend-legend-item')) restore(figure);
  });

  root.addEventListener('focusin', (event) => {
    const point = (event.target as Element).closest<SVGCircleElement>('.trend-point');
    const figure = point?.closest('.trend-figure');
    const key = point?.closest<HTMLElement>('.trend-line')?.dataset.key;
    if (!point || !figure) return;
    highlight(figure, key);
    showTip(root, point);
  });

  root.addEventListener('focusout', (event) => {
    const figure = (event.target as Element).closest('.trend-figure');
    if (figure) restore(figure);
    hideTip(root);
  });
}

export function mountTrendCharts() {
  pinned = undefined;
  for (const root of document.querySelectorAll<HTMLElement>('[data-trend]')) mount(root);
}
