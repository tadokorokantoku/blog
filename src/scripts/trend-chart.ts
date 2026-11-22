// TrendChart.astro の操作。期間の切り替えと、1本だけの強調。
// 描画はビルド時に済んでいるので、ここは属性とクラスを付け外しするだけ

// タップで固定した強調。マウスが離れても、もう一度タップするまで残す
let pinned: { figure: Element; key: string } | undefined;

function highlight(figure: Element, key: string | undefined, reveal = false) {
  figure.classList.toggle('is-focusing', key !== undefined);
  for (const el of figure.querySelectorAll<HTMLElement | SVGElement>('[data-key]')) {
    el.classList.toggle('is-active', el.dataset.key === key);
  }
  if (key === undefined) return;
  // 強調した線を最前面に出す。SVG は z-index が効かないので末尾へ移す
  const line = figure.querySelector(`.trend-line[data-key="${key}"]`);
  line?.parentElement?.append(line);
  // 線から来たときは、右のラベル列の中だけをスクロールして名前を見せる（ページは動かさない）
  const label = figure.querySelector<HTMLElement>(`.trend-label[data-key="${key}"]`);
  const list = label?.closest<HTMLElement>('.trend-labels');
  if (!reveal || !label || !list) return;
  const top = label.offsetTop;
  if (top < list.scrollTop || top + label.offsetHeight > list.scrollTop + list.clientHeight) {
    list.scrollTo({ top: top - list.clientHeight / 2 + label.offsetHeight / 2, behavior: 'smooth' });
  }
}

function restore(figure: Element) {
  highlight(figure, pinned?.figure === figure ? pinned.key : undefined);
}

function keyOf(target: Element) {
  return target.closest<HTMLElement | SVGElement>('[data-key]')?.dataset.key;
}

function mount(root: HTMLElement) {
  if (root.dataset.mounted) return;
  root.dataset.mounted = 'true';

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
      return;
    }

    // 線・名前のタップで強調を固定する。同じものをもう一度押すと外れる。GitHub へのリンクは素通し
    const figure = target.closest('.trend-figure');
    if (!figure || target.closest('a')) return;
    const key = target.closest('.trend-line, .trend-name') ? keyOf(target) : undefined;
    pinned = key === undefined || (pinned?.figure === figure && pinned.key === key) ? undefined : { figure, key };
    highlight(figure, pinned?.key, target.closest('.trend-line') !== null);
  });

  root.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch') return;
    const target = event.target as Element;
    const figure = target.closest('.trend-figure');
    const key = keyOf(target);
    if (figure && key !== undefined) highlight(figure, key, target.closest('.trend-line') !== null);
  });

  root.addEventListener('pointerout', (event) => {
    if (event.pointerType === 'touch') return;
    const figure = (event.target as Element).closest('.trend-figure');
    const to = event.relatedTarget as Element | null;
    // 同じ線・同じ名前の中を移っただけなら外さない
    if (!figure || (to && keyOf(to) === keyOf(event.target as Element))) return;
    restore(figure);
  });
}

export function mountTrendCharts() {
  pinned = undefined;
  for (const root of document.querySelectorAll<HTMLElement>('[data-trend]')) mount(root);
}
