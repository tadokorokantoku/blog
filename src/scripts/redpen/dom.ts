// 赤ペンの UI を組む小さな道具。UI の要素はどれも .redpen-ui を持ち、本文の文字としては数えない

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  // 要素の型ごとの Partial にすると入れ子の h で TypeScript が型を展開しきれないので、値は素朴に受ける
  props: Record<string, string | number | boolean | undefined> & { dataset?: Record<string, string> } = {},
  ...children: (Node | string | false | undefined)[]
) {
  const { dataset, ...rest } = props;
  const el = Object.assign(document.createElement(tag), rest);
  if (dataset) Object.assign(el.dataset, dataset);
  el.append(...children.filter((child): child is Node | string => child !== false && child !== undefined));
  return el;
}

// モーダルの <dialog> が開いている間は、その外の要素は触れない（inert になる）。
// UI は開いている <dialog> の中に入れて、モーダルの上でも操作できるようにする
export function host(): HTMLElement {
  return document.querySelector<HTMLDialogElement>('dialog[open]') ?? document.body;
}

export function mountIn(el: HTMLElement) {
  const parent = host();
  if (el.parentElement !== parent) parent.append(el);
}
