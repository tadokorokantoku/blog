// AI の答えは Markdown で返ってくる（**太字** や箇条書き、出典の URL）。
// HTML にしたあと、許した要素と属性だけを残してから画面に入れる
import DOMPurify from 'dompurify';
import { marked } from 'marked';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'a', 'h3', 'h4', 'hr'];

// リンクは新しいタブで開き、開いた先からこのページを触らせない
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName !== 'A') return;
  node.setAttribute('target', '_blank');
  node.setAttribute('rel', 'noopener noreferrer');
});

export function answerHtml(markdown: string) {
  // gfm で「出典: https://...」の生の URL もリンクになる。breaks で1行の改行もそのまま改行にする
  const html = marked.parse(markdown, { async: false, gfm: true, breaks: true });
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: ['href', 'target', 'rel'] });
}
