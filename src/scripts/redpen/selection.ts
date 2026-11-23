// 記事の中の文字が選ばれたら、選択のすぐ下に吹き出しを出す。中で質問を書いて送るか、赤ペンだけ残す。
// 質問欄にフォーカスすると本文の選択は外れるので、選んだ範囲は redpen-draft のハイライトで見せ続ける
import { ROOT } from './anchor';
import { h, mountIn } from './dom';

export interface Picked {
  root: HTMLElement;
  range: Range;
}

interface Options {
  ai: boolean;
  // question が undefined なら赤ペンだけ。空文字は「これは何？」として聞く
  pick(picked: Picked, question: string | undefined): void;
}

// ページを開くたびに index.ts が渡し直す。赤ペンを使わないページでは undefined
let options: Options | undefined;
let selected: Picked | undefined;
let bubble: { el: HTMLElement; input?: HTMLTextAreaElement } | undefined;
let pointerDown = false;
let timer: number | undefined;

const GAP = 10;
const MARGIN = 8;

export function watchSelection(next: Options | undefined) {
  options = next;
  // 中身が ai で変わるので、作り直させる
  bubble?.el.remove();
  bubble = undefined;
}

function draft(range: Range | undefined) {
  if ('highlights' in CSS) CSS.highlights.set('redpen-draft', new Highlight(...(range ? [range] : [])));
}

export function hidePopover() {
  if (bubble) bubble.el.hidden = true;
  selected = undefined;
  draft(undefined);
}

function choose(question: string | undefined) {
  const picked = selected;
  hidePopover();
  getSelection()?.removeAllRanges();
  if (picked) options?.pick(picked, question);
}

function build(ai: boolean) {
  // AI の口が無い本番では、質問欄も案内も出さず「赤ペンを残す」だけにする。
  // 本番ビルドでは import.meta.env.DEV が false になり、この先の質問欄のコードは消える
  if (!import.meta.env.DEV || !ai) {
    const only = h('button', { type: 'button', className: 'redpen-send redpen-bubble-only', textContent: '赤ペンを残す' });
    only.addEventListener('click', () => choose(undefined));
    return { el: h('div', { className: 'redpen-ui redpen-bubble is-pen-only' }, only) };
  }

  const penOnly = h('button', { type: 'button', className: 'redpen-bubble-pen', textContent: '赤ペンだけ残す' });
  penOnly.addEventListener('click', () => choose(undefined));
  // 一覧への入口は画面端の取っ手が持つので、吹き出しには置かない
  const foot = h('div', { className: 'redpen-bubble-foot' }, penOnly);
  const input = h('textarea', { className: 'redpen-input', rows: 2, placeholder: '質問（空なら「これは何？」）' });
  const send = h('button', { type: 'submit', className: 'redpen-send', textContent: '聞く' });
  const form = h('form', { className: 'redpen-bubble-form' }, input, send);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    choose(input.value);
  });
  input.addEventListener('keydown', (event) => {
    // Enter で送る。改行は Shift+Enter。変換中の Enter は送らない
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  // 質問欄にいる間は本文の選択が外れている。空の欄でコピーしたら、選んでいた文字をコピーする
  input.addEventListener('copy', (event) => {
    if (input.selectionStart !== input.selectionEnd || !selected) return;
    event.preventDefault();
    event.clipboardData?.setData('text/plain', selected.range.toString());
  });
  return { el: h('div', { className: 'redpen-ui redpen-bubble' }, form, foot), input };
}

// 選択の最後の行の下に出し、三角は選択の真ん中を指す。下に入らなければ選択の上に出す
function place() {
  if (!bubble || bubble.el.hidden || !selected) return;
  const { el } = bubble;
  const rects = selected.range.getClientRects();
  const first = rects[0] ?? selected.range.getBoundingClientRect();
  const last = rects[rects.length - 1] ?? first;
  const below = last.bottom + GAP + el.offsetHeight <= innerHeight - MARGIN;
  const anchor = below ? last : first;
  const center = anchor.left + anchor.width / 2;
  const left = Math.min(Math.max(center - el.offsetWidth / 2, MARGIN), innerWidth - el.offsetWidth - MARGIN);
  el.style.left = `${left}px`;
  el.style.top = `${below ? anchor.bottom + GAP : anchor.top - GAP - el.offsetHeight}px`;
  el.classList.toggle('is-above', !below);
  // 吹き出しを端に寄せても、三角は選択を指したままにする
  el.style.setProperty('--arrow-x', `${Math.min(Math.max(center - left, 16), el.offsetWidth - 16)}px`);
}

function show(range: Range, ai: boolean, focus: boolean) {
  bubble ??= build(ai);
  if (bubble.input) bubble.input.value = '';
  mountIn(bubble.el);
  bubble.el.hidden = false;
  draft(range);
  place();
  // マウスで選んだときはそのまま打ち始められるようにする。タッチではキーボードが選択を隠すので自動では出さない
  if (focus) bubble.input?.focus({ preventScroll: true });
}

function checkSelection(focus: boolean) {
  if (!options || pointerDown) return;
  // 吹き出しの中を触っている間は、本文の選択が外れても閉じない
  if (bubble && !bubble.el.hidden && bubble.el.contains(document.activeElement)) return;
  const selection = getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return hidePopover();
  const range = selection.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const el = node instanceof Element ? node : node.parentElement;
  if (el?.closest('.redpen-ui')) return;
  // 記事をまたいだ選択や、記事の外（見出しやタブ）の選択には出さない
  const root = el?.closest<HTMLElement>(ROOT);
  if (!root || !range.toString().trim()) return hidePopover();
  selected = { root, range: range.cloneRange() };
  show(selected.range, options.ai, focus);
}

document.addEventListener('selectionchange', () => {
  clearTimeout(timer);
  timer = window.setTimeout(() => checkSelection(false), 250);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && bubble && !bubble.el.hidden) {
    event.preventDefault();
    hidePopover();
  }
});

// 吹き出しの外を押したら閉じる（新しく選び直すときは selectionchange がまた出す）
document.addEventListener('pointerdown', (event) => {
  if (bubble && !bubble.el.hidden && !bubble.el.contains(event.target as Node)) hidePopover();
});

// 本文やモーダルの中をスクロールしても、選んだ範囲についていく
document.addEventListener('scroll', place, { capture: true, passive: true });
window.addEventListener('resize', place);

// カードはまるごと <a> で、タイトルもリンクなので、Chrome ではリンクごと掴んでしまい中の文字をドラッグで選べない。
// マウスで押している間だけ href を外してただの文字にし、離したら click より前に戻す
let unlinked: HTMLAnchorElement | undefined;

function relink() {
  if (unlinked?.dataset.redpenHref) unlinked.setAttribute('href', unlinked.dataset.redpenHref);
  unlinked = undefined;
}

// マウスではドラッグを終えてから出す。タッチの長押し選択は pointerup が来ないことがあるので selectionchange だけで見る
document.addEventListener('pointerdown', (event) => {
  if (!options || event.pointerType !== 'mouse' || (event.target as Element).closest?.('.redpen-ui')) return;
  pointerDown = true;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = (event.target as Element).closest<HTMLAnchorElement>(`${ROOT} a[href]`);
  if (!link) return;
  link.dataset.redpenHref = link.getAttribute('href') ?? '';
  link.removeAttribute('href');
  unlinked = link;
});
document.addEventListener('pointerup', () => {
  relink();
  if (!pointerDown) return;
  pointerDown = false;
  clearTimeout(timer);
  timer = window.setTimeout(() => checkSelection(true), 10);
});
// リンクや画像をドラッグで掴んだときなど、pointerup が来ずに終わることがある。押しっぱなし扱いが残ると以後ずっと出なくなる
function release() {
  relink();
  pointerDown = false;
}
document.addEventListener('pointercancel', release);
document.addEventListener('dragstart', release);
window.addEventListener('blur', release);
