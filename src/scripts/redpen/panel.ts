// 横のパネル。1本の赤ペンのスレッドか、このページの赤ペンの一覧を出す（狭い画面では下から出る）。
// 画面の端に「取っ手」を置き、閉じている間は細いつまみ、開いている間はパネルの縁に付いた「閉じる」取っ手にする
import { h, mountIn } from './dom';
import { answerHtml } from './markdown';
import type { RedPen } from './store';

export interface ThreadActions {
  ask(question: string): void;
  remove(): void;
  // ヘッダーから、このページの赤ペンの一覧に切り替える
  list(): void;
}

export interface ListActions {
  open(pen: RedPen): void;
}

let panel: HTMLElement | undefined;
let handle: { el: HTMLButtonElement; count: HTMLElement; label: HTMLElement; openList(): void } | undefined;
let closing: number | undefined;

// パネルの出入りと同じ時間。prefers-reduced-motion のときは CSS 側でアニメーションを切る
const SLIDE_MS = 180;

function isOpen() {
  return panel !== undefined && !panel.hidden && !panel.classList.contains('is-closing');
}

// 取っ手はパネルと同じ場所（開いているモーダルの中か body）に置き、開閉の状態を写す
function syncHandle() {
  if (!handle) return;
  const open = isOpen();
  handle.el.setAttribute('aria-expanded', String(open));
  handle.el.classList.toggle('is-open', open);
  handle.label.textContent = open ? '閉じる' : '赤ペン';
  handle.el.title = open ? '赤ペンのパネルを閉じる' : handle.el.dataset.title ?? '';
  if (open && panel?.parentElement) panel.parentElement.append(handle.el);
  else mountIn(handle.el);
}

const PEN_ICON =
  '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M11.5 2.5l2 2L6 12l-3 1 1-3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';

// ページを開くたびに index.ts が呼ぶ。赤ペンが0件でも出す（開くと使い方の説明が出る）
export function mountHandle(count: number, openList: () => void) {
  if (!handle) {
    const el = h('button', { type: 'button', className: 'redpen-ui redpen-handle' });
    el.setAttribute('aria-controls', 'redpen-panel');
    const icon = h('span', { className: 'redpen-handle-icon', innerHTML: PEN_ICON });
    const countEl = h('span', { className: 'redpen-handle-count' });
    const label = h('span', { className: 'redpen-handle-label' });
    el.append(icon, countEl, label);
    el.addEventListener('click', () => (isOpen() ? closePanel() : handle?.openList()));
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen()) closePanel();
    });
    handle = { el, count: countEl, label, openList };
  }
  handle.openList = openList;
  setHandleCount(count);
  syncHandle();
}

export function setHandleCount(count: number) {
  if (!handle) return;
  handle.count.textContent = String(count);
  handle.count.classList.toggle('is-empty', count === 0);
  handle.el.dataset.title = `このページの赤ペン（${count}）`;
  handle.el.setAttribute('aria-label', `このページの赤ペン（${count}件）`);
  if (!isOpen()) handle.el.title = handle.el.dataset.title;
}

// 一覧への入口はスレッドのヘッダーにだけ置く。一覧を開いているときは見出しがその役をする
function frame(head: { title: string; list?: { count: number; open(): void } }, ...body: (Node | false)[]) {
  if (!panel) {
    panel = h('aside', { className: 'redpen-ui redpen-panel', ariaLabel: '赤ペン', id: 'redpen-panel' });
    // Esc で閉じて、取っ手にフォーカスを戻す
    panel.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      closePanel();
      handle?.el.focus();
    });
  }
  const close = h('button', { type: 'button', className: 'redpen-close', ariaLabel: '閉じる', textContent: '×' });
  close.addEventListener('click', closePanel);
  const title = h('h2', { className: 'redpen-panel-title', textContent: head.title });
  // スレッドでは「← 一覧」の行の下に記事のタイトル、一覧では見出しをそのまま上の行に置く
  let top: Node[] = [h('header', { className: 'redpen-panel-head' }, title, close)];
  if (head.list) {
    const list = h('button', { type: 'button', className: 'redpen-to-list', textContent: `← このページの赤ペン（${head.list.count}）` });
    list.addEventListener('click', head.list.open);
    top = [h('header', { className: 'redpen-panel-head' }, list, close), title];
  }
  panel.replaceChildren(...top, ...body.filter((node): node is Node => node !== false));
  clearTimeout(closing);
  panel.classList.remove('is-closing');
  mountIn(panel);
  panel.hidden = false;
  syncHandle();
  return panel;
}

// 出てきたところへ引っ込めてから隠す
export function closePanel() {
  if (!panel || panel.hidden) return syncHandle();
  panel.classList.add('is-closing');
  const el = panel;
  clearTimeout(closing);
  closing = window.setTimeout(() => {
    el.hidden = true;
    el.classList.remove('is-closing');
  }, SLIDE_MS);
  syncHandle();
}

export function openedPenId() {
  return isOpen() ? panel?.dataset.pen : undefined;
}

export function openThread(
  pen: RedPen,
  { found, ai, count }: { found: boolean; ai: boolean; count: number },
  actions: ThreadActions,
) {
  const turns = pen.thread.map((turn) =>
    h(
      'li',
      { className: 'redpen-turn' },
      h('p', { className: 'redpen-q', textContent: turn.question || 'これは何？' }),
      turn.answer !== undefined
        ? h('div', { className: 'redpen-a is-md', innerHTML: answerHtml(turn.answer) })
        : turn.error
          ? h('p', { className: 'redpen-a is-error', textContent: `答えを取れなかった: ${turn.error}` })
          : h('p', { className: 'redpen-a is-pending', textContent: '調べています…（リンク先や Web も見るので、30秒〜1分ほどかかる）' }),
    ),
  );
  const pending = pen.thread.some((turn) => turn.answer === undefined && !turn.error);

  const input = h('textarea', {
    className: 'redpen-input',
    rows: 2,
    placeholder: pen.thread.length ? '続けて質問する' : '質問（空なら「これは何？」）',
    disabled: pending,
  });
  const form = h(
    'form',
    { className: 'redpen-form' },
    input,
    h('button', { type: 'submit', className: 'redpen-send', textContent: pending ? '調べています…' : '聞く', disabled: pending }),
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    actions.ask(input.value);
  });
  // Enter で送る。改行は Shift+Enter。変換中の Enter は送らない
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  const remove = h('button', { type: 'button', className: 'redpen-remove', textContent: 'この赤ペンを消す' });
  remove.addEventListener('click', actions.remove);

  const el = frame(
    { title: pen.article.title, list: { count, open: actions.list } },
    h('blockquote', { className: 'redpen-quote', textContent: pen.quote }),
    !found && h('p', { className: 'redpen-lost', textContent: '本文が変わって、この部分が見つからなくなった。' }),
    turns.length > 0 && h('ol', { className: 'redpen-thread' }, ...turns),
    ai ? form : h('p', { className: 'redpen-local', textContent: 'AI に聞くのはローカルの開発サーバー（pnpm dev）でだけ使える。' }),
    h('footer', { className: 'redpen-panel-foot' }, remove),
  );
  el.dataset.pen = pen.id;
  if (ai && !pending) input.focus({ preventScroll: true });
}

export function openList(pens: RedPen[], found: (pen: RedPen) => boolean, ai: boolean, actions: ListActions) {
  const items = [...pens]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((pen) => {
      const button = h(
        'button',
        { type: 'button', className: 'redpen-item' },
        h('span', { className: 'redpen-item-quote', textContent: pen.quote }),
        h(
          'span',
          { className: 'redpen-item-meta' },
          `${pen.article.title}・質問${pen.thread.length}件`,
          !found(pen) && h('span', { className: 'redpen-badge', textContent: '見つからない' }),
        ),
      );
      button.addEventListener('click', () => actions.open(pen));
      return h('li', {}, button);
    });
  const el = frame(
    { title: `このページの赤ペン（${pens.length}）` },
    items.length
      ? h('ul', { className: 'redpen-list' }, ...items)
      : h('p', {
          className: 'redpen-empty',
          textContent: ai
            ? '記事の文字をドラッグして選ぶと、そこに赤ペンを残して AI に聞ける。残した赤ペンはここに並ぶ。'
            : '記事の文字をドラッグして選ぶと、そこに赤ペンを残せる。残した赤ペンはここに並ぶ。',
        }),
  );
  el.dataset.pen = '';
}
