// 記事の中の文字が選ばれたら、選択のすぐ下に「AIに聞く」「赤ペンだけ残す」を出す
import { ROOT } from './anchor';
import { h, mountIn } from './dom';

export interface Picked {
  root: HTMLElement;
  range: Range;
}

interface Options {
  ai: boolean;
  pick(picked: Picked, withQuestion: boolean): void;
}

// ページを開くたびに index.ts が渡し直す。赤ペンを使わないページでは undefined
let options: Options | undefined;
let selected: Picked | undefined;
let popover: HTMLElement | undefined;
let pointerDown = false;
let timer: number | undefined;

export function watchSelection(next: Options | undefined) {
  options = next;
  // ボタンの文言が ai で変わるので、作り直させる
  popover?.remove();
  popover = undefined;
}

export function hidePopover() {
  if (popover) popover.hidden = true;
  selected = undefined;
}

function choose(withQuestion: boolean) {
  const picked = selected;
  hidePopover();
  getSelection()?.removeAllRanges();
  if (picked) options?.pick(picked, withQuestion);
}

function showPopover(range: Range, ai: boolean) {
  if (!popover) {
    const askButton = h('button', { type: 'button', textContent: ai ? 'AIに聞く' : 'AIに聞く（ローカルのみ）', disabled: !ai });
    const penButton = h('button', { type: 'button', textContent: '赤ペンだけ残す' });
    askButton.addEventListener('click', () => choose(true));
    penButton.addEventListener('click', () => choose(false));
    popover = h('div', { className: 'redpen-ui redpen-pop', role: 'toolbar', ariaLabel: '選んだ文字に' }, askButton, penButton);
    // 押した瞬間に選択が外れないよう、フォーカスを奪わせない
    popover.addEventListener('mousedown', (event) => event.preventDefault());
  }
  mountIn(popover);
  popover.hidden = false;
  // スマホでは OS のメニューが選択の上に出るので、こちらは下に出す
  const rects = range.getClientRects();
  const rect = rects[rects.length - 1] ?? range.getBoundingClientRect();
  const left = Math.min(Math.max(rect.left + rect.width / 2 - popover.offsetWidth / 2, 8), innerWidth - popover.offsetWidth - 8);
  const top = rect.bottom + 8 + popover.offsetHeight > innerHeight ? rect.top - popover.offsetHeight - 8 : rect.bottom + 8;
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function checkSelection() {
  if (!options || pointerDown) return;
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
  showPopover(range, options.ai);
}

document.addEventListener('selectionchange', () => {
  clearTimeout(timer);
  timer = window.setTimeout(checkSelection, 250);
});

// カードはまるごと <a> なので、Chrome ではリンクごと掴んでしまい中の文字をドラッグで選べない。
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
  const link = (event.target as Element).closest<HTMLAnchorElement>(`${ROOT} a.news-card[href]`);
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
  timer = window.setTimeout(checkSelection, 10);
});
document.addEventListener('pointercancel', relink);
