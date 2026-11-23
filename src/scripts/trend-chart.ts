// TrendChart.astro の操作。期間の切り替えと、1本だけの強調。
// 描画はビルド時に済んでいるので、ここは属性とクラスを付け外しするだけ。
// マウスは「いま触れている線・名前」だけを強調し、グラフから出たら必ず初期状態に戻す。
// タッチはタップで強調を固定し、もう一度タップするか外側をタップすると外れる

// タップで固定した強調
let pinned: { figure: Element; key: string } | undefined;

function highlight(figure: Element, key: string | undefined, reveal = false) {
  figure.classList.toggle('is-focusing', key !== undefined);
  for (const el of figure.querySelectorAll<HTMLElement | SVGElement>('[data-key]')) {
    el.classList.toggle('is-active', el.dataset.key === key);
  }
  if (key === undefined) return;
  // 強調した線を最前面に出す。SVG は z-index が効かないので末尾へ移す。
  // 移すとブラウザのホバー対象が外れ、要素の出入りのイベントが当てにならなくなるので、マウスは pointermove で追う
  const line = figure.querySelector(`.trend-line[data-key="${key}"]`);
  if (line && line !== line.parentElement?.lastElementChild) line.parentElement?.append(line);
  // 線から来たときは、右の名前の列の中だけをスクロールして名前を見せる（ページは動かさない）
  const label = figure.querySelector<HTMLElement>(`.trend-label[data-key="${key}"]`);
  const list = label?.closest<HTMLElement>('.trend-labels');
  if (!reveal || !label || !list) return;
  const top = label.offsetTop;
  if (top < list.scrollTop || top + label.offsetHeight > list.scrollTop + list.clientHeight) {
    list.scrollTo({ top: top - list.clientHeight / 2 + label.offsetHeight / 2, behavior: 'smooth' });
  }
}

// 固定が無ければ初期状態（上位8件は色付き、ほかは薄いグレー）に戻す
function restore(figure: Element) {
  highlight(figure, pinned?.figure === figure ? pinned.key : undefined);
}

function unpin() {
  const figure = pinned?.figure;
  pinned = undefined;
  if (figure) restore(figure);
}

// 線は .trend-line（当たり判定の太い透明線を含む）、名前は .trend-label の行。それ以外は強調の対象にしない
function keyOf(target: Element) {
  return target.closest<HTMLElement | SVGElement>('.trend-line, .trend-label')?.dataset.key;
}

function mount(root: HTMLElement) {
  if (root.dataset.mounted) return;
  root.dataset.mounted = 'true';
  // マウスで直前に触れていたもの。同じなら何もしない（毎回 DOM を動かさないように）
  let hovered: string | undefined;
  let touched = false;

  root.addEventListener('pointerdown', (event) => {
    touched = event.pointerType === 'touch';
  });

  root.addEventListener('click', (event) => {
    const target = event.target as Element;
    const range = target.closest<HTMLButtonElement>('.trend-range');
    if (range) {
      unpin();
      for (const button of root.querySelectorAll('.trend-range')) {
        button.setAttribute('aria-pressed', String(button === range));
      }
      for (const figure of root.querySelectorAll<HTMLElement>('.trend-figure')) {
        figure.hidden = figure.dataset.range !== range.dataset.range;
        highlight(figure, undefined);
      }
      return;
    }

    // 固定はタッチのときだけ。マウスのクリックはホバーと同じ扱いで、離れれば戻る。GitHub へのリンクは素通し
    const figure = target.closest('.trend-figure');
    if (!touched || !figure || target.closest('a')) return;
    const key = keyOf(target);
    pinned = key === undefined || (pinned?.figure === figure && pinned.key === key) ? undefined : { figure, key };
    highlight(figure, pinned?.key, target.closest('.trend-line') !== null);
  });

  root.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const target = event.target as Element;
    const figure = target.closest('.trend-figure');
    const key = keyOf(target);
    if (!figure || key === hovered) return;
    hovered = key;
    if (key === undefined) restore(figure);
    else highlight(figure, key, target.closest('.trend-line') !== null);
  });

  for (const figure of root.querySelectorAll('.trend-figure')) {
    figure.addEventListener('pointerleave', (event) => {
      if ((event as PointerEvent).pointerType === 'touch') return;
      hovered = undefined;
      restore(figure);
    });
  }
}

// グラフの外をタップしたら固定を外す
document.addEventListener('pointerdown', (event) => {
  if (pinned && event.pointerType === 'touch' && !pinned.figure.contains(event.target as Node)) unpin();
});

// astro:page-load で呼ぶ。読み込みが遅れてそれを逃したときのために、読み込み時にも呼ぶ（何度呼んでも同じ）
export function mountTrendCharts() {
  pinned = undefined;
  for (const root of document.querySelectorAll<HTMLElement>('[data-trend]')) mount(root);
}
