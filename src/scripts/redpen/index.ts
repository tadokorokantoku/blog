// 赤ペン。記事の文字を選ぶと吹き出しが出て、質問するか赤ペンだけ残せる。選んだところに赤い線が残る。
// 線は CSS Custom Highlight API で引く。本文の DOM を書き換えないので、カードのリンクや行数の切り詰めを壊さない
import { anchorOf, locate, ROOT } from './anchor';
import { closePanel, openedPenId, openList, openThread } from './panel';
import { hidePopover, watchSelection, type Picked } from './selection';
import { getPen, pageKey, pensOnPage, removePen, savePen, type RedPen } from './store';

// src/integrations/dev-ask-ai.ts の ASK_PATH と揃える
const ASK_PATH = '/__redpen/ask';

let enabled = false;
// AI の口は dev サーバーにしか無い。RedPen.astro がビルドの種類を data-ai に書く
let ai = false;
// 見つかった赤ペンの位置。Range は DOM の変化に合わせて勝手に動く
let ranges = new Map<string, Range>();

function rootsFor(url: string) {
  return [...document.querySelectorAll<HTMLElement>(ROOT)].filter((el) => el.dataset.redpenUrl === url);
}

function paint() {
  ranges = new Map();
  for (const pen of pensOnPage()) {
    const range = locate(rootsFor(pen.article.url), pen);
    if (range) ranges.set(pen.id, range);
  }
  if (!('highlights' in CSS)) return;
  const active = ranges.get(openedPenId() ?? '');
  CSS.highlights.set('redpen', new Highlight(...ranges.values()));
  CSS.highlights.set('redpen-active', new Highlight(...(active ? [active] : [])));
}

function showThread(id: string) {
  const pen = getPen(id);
  if (!pen) return;
  openThread(pen, { found: ranges.has(id), ai, count: pensOnPage().length }, {
    ask: (question) => ask(pen, question),
    list: openListPanel,
    remove: () => {
      removePen(id);
      closePanel();
      paint();
    },
  });
  paint();
}

async function ask(pen: RedPen, question: string) {
  const history = pen.thread.flatMap((turn) => (turn.answer ? [{ question: turn.question || 'これは何？', answer: turn.answer }] : []));
  const turn: RedPen['thread'][number] = { question: question.trim(), at: new Date().toISOString() };
  pen.thread.push(turn);
  savePen(pen);
  showThread(pen.id);

  try {
    const res = await fetch(ASK_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ selection: pen.quote, article: pen.article, question: turn.question, history }),
    });
    const body = (await res.json()) as { answer?: string; error?: string };
    if (body.answer) turn.answer = body.answer;
    else turn.error = body.error ?? `HTTP ${res.status}`;
  } catch (error) {
    turn.error = error instanceof Error ? error.message : String(error);
  }
  // 待っている間に消されていたら書き戻さない
  if (!getPen(pen.id)) return;
  savePen(pen);
  if (openedPenId() === pen.id) showThread(pen.id);
}

// 吹き出しから。question があれば赤ペンを引いてすぐ聞き、答えは横のパネルに出す
function create({ root, range }: Picked, question: string | undefined) {
  const anchor = anchorOf(root, range);
  if (!anchor) return;
  const pen: RedPen = {
    id: crypto.randomUUID(),
    page: pageKey(),
    article: { url: root.dataset.redpenUrl ?? location.href, title: root.dataset.redpenTitle ?? document.title, summary: root.dataset.redpenSummary },
    ...anchor,
    thread: [],
    createdAt: new Date().toISOString(),
  };
  savePen(pen);
  paint();
  if (question !== undefined) ask(pen, question);
}

// クリックした点に重なる赤ペン。Highlight はイベントを受けないので、線の矩形で当たりを取る
function hit(x: number, y: number) {
  for (const [id, range] of ranges) {
    for (const rect of range.getClientRects()) {
      if (x >= rect.left && x <= rect.right && y >= rect.top - 2 && y <= rect.bottom + 2) return id;
    }
  }
  return undefined;
}

function reveal(pen: RedPen) {
  const range = ranges.get(pen.id);
  const el = range?.startContainer.parentElement;
  // 詳細モーダルの中の赤ペンなら、先にモーダルを開く
  const dialog = el?.closest('dialog');
  if (dialog && !dialog.open) dialog.showModal();
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  showThread(pen.id);
}

function openListPanel() {
  openList(pensOnPage(), (pen) => ranges.has(pen.id), { open: reveal });
}

// capture で先に受けて、カードのリンクやモーダルを開く処理より前に止める
window.addEventListener(
  'click',
  (event) => {
    if (!enabled) return;
    const target = event.target as Element;
    if (target.closest?.('.redpen-ui')) return;
    const selection = getSelection();
    // ドラッグで選び終えたときの click で、カードのリンクやモーダルが開かないようにする
    if (selection && !selection.isCollapsed && target.closest?.(ROOT)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const id = hit(event.clientX, event.clientY);
    if (!id) return;
    event.preventDefault();
    event.stopPropagation();
    showThread(id);
  },
  true,
);

// モーダルを閉じると中に入れていた UI も見えなくなるので、一緒に閉じる
document.addEventListener(
  'close',
  (event) => {
    if (!(event.target instanceof HTMLDialogElement)) return;
    hidePopover();
    closePanel();
    paint();
  },
  true,
);

document.addEventListener('astro:before-swap', () => {
  hidePopover();
  closePanel();
});

document.addEventListener('astro:page-load', () => {
  const config = document.getElementById('redpen');
  enabled = config !== null;
  if (!config) {
    watchSelection(undefined);
    if ('highlights' in CSS) CSS.highlights.clear();
    return;
  }
  ai = config.dataset.ai === 'local';
  watchSelection({ ai, pick: create, count: () => pensOnPage().length, openList: openListPanel });
  paint();
});
