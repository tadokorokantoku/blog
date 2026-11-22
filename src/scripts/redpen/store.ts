// 赤ペンの保存。試作なのでブラウザの localStorage だけに置く（端末をまたがない）。
// プライベートウィンドウなどで読み書きが投げても、その場では動くようにする

export interface RedPenTurn {
  question: string;
  answer?: string;
  error?: string;
  at: string;
}

export interface RedPen {
  id: string;
  // 赤ペンを引いたページ（/news/ade/ など）。一覧はページごとに出す
  page: string;
  // どの記事の中か。本文が差し替わっても、この記事の中から quote を探し直す
  article: { url: string; title: string; summary?: string };
  quote: string;
  // quote の前後の文字。同じ文字列が記事の中に何度も出るときの見分けに使う
  prefix: string;
  suffix: string;
  thread: RedPenTurn[];
  createdAt: string;
}

const KEY = 'redpen:v1';
let memory: RedPen[] | undefined;

function readAll(): RedPen[] {
  if (memory) return memory;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    memory = Array.isArray(parsed) ? parsed : [];
  } catch {
    memory = [];
  }
  return memory;
}

function writeAll(pens: RedPen[]) {
  memory = pens;
  try {
    localStorage.setItem(KEY, JSON.stringify(pens));
  } catch {
    // 保存できなくても、このページを開いている間は memory で動く
  }
}

export function pageKey() {
  return location.pathname.replace(/\/?$/, '/');
}

export function pensOnPage(): RedPen[] {
  const page = pageKey();
  return readAll().filter((pen) => pen.page === page);
}

export function getPen(id: string) {
  return readAll().find((pen) => pen.id === id);
}

export function savePen(pen: RedPen) {
  const others = readAll().filter(({ id }) => id !== pen.id);
  writeAll([...others, pen]);
}

export function removePen(id: string) {
  writeAll(readAll().filter((pen) => pen.id !== id));
}
