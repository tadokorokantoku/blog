// 赤ペンの位置を「記事の中の文字列」として持ち、ページを開くたびに Range に戻す。
// DOM の位置（何番目の要素か）では持たない。収集のたびに一覧が並び替わっても見つけ直せるように

const CONTEXT = 32;

export const ROOT = '[data-redpen-url]';

// 記事の文字を、テキストノードを順につないだ1本の文字列として扱う
function textNodes(root: Element) {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest('script, style, .redpen-ui') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);
  return nodes;
}

// Range の境界（要素の中の位置のこともある）を、つないだ文字列の何文字目かにする
function indexOf(nodes: Text[], container: Node, offset: number) {
  const boundary = document.createRange();
  boundary.setStart(container, offset);
  let index = 0;
  for (const node of nodes) {
    if (node === container) return index + offset;
    if (boundary.comparePoint(node, 0) >= 0) break;
    index += node.length;
  }
  return index;
}

export interface Anchor {
  quote: string;
  prefix: string;
  suffix: string;
}

export function anchorOf(root: Element, range: Range): Anchor | undefined {
  const nodes = textNodes(root);
  const text = nodes.map(({ data }) => data).join('');
  const start = indexOf(nodes, range.startContainer, range.startOffset);
  const end = indexOf(nodes, range.endContainer, range.endOffset);
  const quote = text.slice(start, end);
  if (!quote.trim()) return undefined;
  return { quote, prefix: text.slice(Math.max(0, start - CONTEXT), start), suffix: text.slice(end, end + CONTEXT) };
}

// quote が出てくる場所のうち、前後の文字が一番よく合うものを選ぶ
export function locate(roots: Element[], { quote, prefix, suffix }: Anchor): Range | undefined {
  let best: { score: number; root: Element; nodes: Text[]; at: number } | undefined;
  for (const root of roots) {
    const nodes = textNodes(root);
    const text = nodes.map(({ data }) => data).join('');
    for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + 1)) {
      const score =
        commonSuffix(text.slice(Math.max(0, at - prefix.length), at), prefix) +
        commonPrefix(text.slice(at + quote.length, at + quote.length + suffix.length), suffix);
      if (!best || score > best.score) best = { score, root, nodes, at };
    }
  }
  if (!best) return undefined;
  return rangeAt(best.nodes, best.at, best.at + quote.length);
}

function rangeAt(nodes: Text[], start: number, end: number) {
  const range = document.createRange();
  let index = 0;
  let started = false;
  for (const node of nodes) {
    const next = index + node.length;
    if (!started && start <= next) {
      range.setStart(node, start - index);
      started = true;
    }
    if (started && end <= next) {
      range.setEnd(node, end - index);
      break;
    }
    index = next;
  }
  return range;
}

function commonPrefix(a: string, b: string) {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

function commonSuffix(a: string, b: string) {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}
