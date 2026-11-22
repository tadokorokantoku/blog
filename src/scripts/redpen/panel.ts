// 横のパネル。1本の赤ペンのスレッドか、このページの赤ペンの一覧を出す（狭い画面では下から出る）
import { h, mountIn } from './dom';
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

// 一覧への入口はスレッドのヘッダーにだけ置く。一覧を開いているときは見出しがその役をする
function frame(head: { title: string; list?: { count: number; open(): void } }, ...body: (Node | false)[]) {
  panel ??= h('aside', { className: 'redpen-ui redpen-panel', ariaLabel: '赤ペン' });
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
  mountIn(panel);
  panel.hidden = false;
  return panel;
}

export function closePanel() {
  if (panel) panel.hidden = true;
}

export function openedPenId() {
  return panel && !panel.hidden ? panel.dataset.pen : undefined;
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
        ? h('p', { className: 'redpen-a', textContent: turn.answer })
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

export function openList(pens: RedPen[], found: (pen: RedPen) => boolean, actions: ListActions) {
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
      : h('p', { className: 'redpen-local', textContent: '文字を選ぶと赤ペンを引ける。' }),
  );
  el.dataset.pen = '';
}
