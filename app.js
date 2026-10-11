/* 아이디어 노트 — 노션식 블록 편집기 + 아이디어 보드 */
'use strict';

// ---------- 상수 ----------
const STATUSES = [
  { key: 'spark', label: '발산', icon: '💡', color: 'yellow' },
  { key: 'grow', label: '키우는 중', icon: '🌱', color: 'green' },
  { key: 'pick', label: '채택', icon: '✅', color: 'blue' },
  { key: 'park', label: '보류', icon: '💤', color: 'gray' },
];
const statusOf = (k) => STATUSES.find((s) => s.key === k) || STATUSES[0];
const TAG_COLORS = ['blue', 'green', 'purple', 'orange', 'pink', 'yellow', 'red', 'brown', 'gray'];
const tagColor = (t) => {
  let h = 0;
  for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TAG_COLORS[h % TAG_COLORS.length];
};

const BLOCK_TYPES = [
  { type: 'p', label: '텍스트', sub: '그냥 글을 써요', icon: 'Aa', keys: 'text 텍스트 본문 p' },
  { type: 'h1', label: '제목 1', sub: '큰 섹션 제목', icon: 'H1', keys: 'h1 heading 제목 큰' },
  { type: 'h2', label: '제목 2', sub: '중간 섹션 제목', icon: 'H2', keys: 'h2 heading 제목 중간' },
  { type: 'h3', label: '제목 3', sub: '작은 섹션 제목', icon: 'H3', keys: 'h3 heading 제목 작은' },
  { type: 'ul', label: '글머리 기호 목록', sub: '간단한 목록', icon: '•', keys: 'ul bullet list 목록 글머리' },
  { type: 'ol', label: '번호 매기기 목록', sub: '순서가 있는 목록', icon: '1.', keys: 'ol number list 번호 목록' },
  { type: 'todo', label: '할 일 목록', sub: '체크박스로 할 일 관리', icon: '☑', keys: 'todo check 할일 체크 투두' },
  { type: 'toggle', label: '토글 목록', sub: '접었다 펼 수 있어요', icon: '▸', keys: 'toggle 토글 접기' },
  { type: 'callout', label: '콜아웃', sub: '눈에 띄는 메모', icon: '💡', keys: 'callout 콜아웃 강조 메모' },
  { type: 'quote', label: '인용', sub: '인용문', icon: '❝', keys: 'quote 인용' },
  { type: 'divider', label: '구분선', sub: '블록을 나눠요', icon: '—', keys: 'divider hr 구분선 선' },
  { type: 'code', label: '코드', sub: '코드 조각', icon: '</>', keys: 'code 코드' },
];
const PLACEHOLDER = { p: "글을 쓰거나 '/'로 블록을 골라요", h1: '제목 1', h2: '제목 2', h3: '제목 3', ul: '목록', ol: '목록', todo: '할 일', toggle: '토글', quote: '인용', callout: '메모', code: '' };
const LIST_TYPES = new Set(['ul', 'ol', 'todo']);
const TOUCH = matchMedia('(hover: none)').matches;

const EMOJIS = '💡 🌱 ✅ 💤 🔥 ✨ 🚀 🎯 🧠 📌 📝 📋 🗂️ 🧩 🎨 🎮 📱 💬 💰 ⭐ 🎁 📈 🧪 🔍 ⚡ 🌈 🍀 🐣 🤔 ❓ ❗ 🗺️ 🏁 🛠️ 🪄 🎬 📣 🧲 🌙 ☕'.split(' ');

const PROMPTS = [
  { tag: '결합', text: '두 아이디어를 하나로 합치면 어떤 기능이 될까?' },
  { tag: '대체', text: 'A의 대상(누구를 위한 건지)을 B의 사용자로 바꾸면?' },
  { tag: '응용', text: 'B가 쓰는 방식을 A에 그대로 가져오면?' },
  { tag: '확대·축소', text: '둘 중 하나를 10배 크게, 혹은 10분의 1로 줄이면?' },
  { tag: '용도 변경', text: '이 조합을 전혀 다른 화면이나 시점에 쓰면?' },
  { tag: '제거', text: '두 아이디어에서 하나씩 빼야 한다면 무엇을 남길까?' },
  { tag: '뒤집기', text: '순서·주체·보상을 거꾸로 하면?' },
  { tag: '극단', text: '돈이 하나도 안 든다면? 반대로 무제한이라면?' },
];

// ---------- 유틸 ----------
const $ = (s, r = document) => r.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
};
const uid = () => Math.random().toString(36).slice(2, 9);
const newPageId = () => {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${ymd}-${Math.random().toString(36).slice(2, 6)}`;
};
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const ago = (ms) => {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return '방금 전';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
};
const debounce = (fn, ms) => {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = () => { clearTimeout(t); fn(); };
  return d;
};
const store = {
  get(k, f) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ---------- API ----------
// 내 컴퓨터(localhost)에서는 server.js 가 파일을 쓰고,
// 웹(GitHub Pages)에서는 브라우저가 GitHub 저장소에 바로 커밋한다.
const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const GH = { repo: 'jamie-pd/idea-note', branch: 'main', dir: 'data/pages' };

const localApi = {
  async list() { return (await fetch('/api/pages')).json(); },
  async get(id) { const r = await fetch(`/api/pages/${id}`); return r.ok ? r.json() : null; },
  async save(id, meta, body) {
    const r = await fetch(`/api/pages/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meta, body }), keepalive: true,
    });
    return r.json();
  },
  async remove(id) { await fetch(`/api/pages/${id}`, { method: 'DELETE' }); },
  async git() { try { return await (await fetch('/api/git')).json(); } catch { return { repo: false }; } },
  async commit(message) {
    const r = await fetch('/api/git/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
    return r.json();
  },
};

// front matter — server.js 와 같은 형식
const META_KEYS = ['title', 'icon', 'kind', 'period', 'key', 'score', 'view', 'status', 'tags', 'parent', 'order', 'created', 'updated'];
function parseFile(text) {
  const meta = {};
  let body = text;
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (m) {
    body = text.slice(m[0].length);
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const raw = line.slice(i + 1).trim();
      try { meta[line.slice(0, i).trim()] = JSON.parse(raw); } catch { meta[line.slice(0, i).trim()] = raw; }
    }
  }
  return { meta, body: body.replace(/^\n/, '') };
}
function serializeFile(meta, body) {
  const lines = META_KEYS.filter((k) => meta[k] !== undefined && meta[k] !== null && meta[k] !== '').map((k) => `${k}: ${JSON.stringify(meta[k])}`);
  return `---\n${lines.join('\n')}\n---\n\n${(body || '').trimEnd()}\n`;
}
const makePreview = (body) => (body || '').replace(/<[^>]+>/g, ' ').replace(/\]\([^)]*\)/g, '').replace(/[#>*`~\[\]]|^- |\n- /g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
const b64decode = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), (c) => c.charCodeAt(0)));

const ghApi = (() => {
  const remote = {};             // id -> { meta, body } (GitHub 에 있는 것)
  let pending = store.get('gh-pending', {}); // id -> { meta, body } | { deleted: true } (아직 안 올린 것)
  let lastCommit = store.get('gh-last', null);
  let committing = null;
  const keepPending = () => store.set('gh-pending', pending);
  const token = () => store.get('gh-token', '');

  async function req(path, opts = {}) {
    const r = await fetch(`https://api.github.com${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token()}`, Accept: 'application/vnd.github+json', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    if (!r.ok) { const e = new Error(`GitHub ${r.status}`); e.status = r.status; throw e; }
    return r.status === 204 ? null : r.json();
  }
  const current = (id) => {
    const p = pending[id];
    if (p) return p.deleted ? null : p;
    return remote[id] || null;
  };
  const ids = () => [...new Set([...Object.keys(remote), ...Object.keys(pending)])].filter((id) => current(id));

  async function list() {
    const tree = await req(`/repos/${GH.repo}/git/trees/${GH.branch}?recursive=1`);
    const files = tree.tree.filter((t) => t.type === 'blob' && t.path.startsWith(GH.dir + '/') && t.path.endsWith('.md'));
    // 내용이 같은 파일(sha)은 브라우저에 캐시해 둔 걸 쓴다
    const cache = store.get('gh-blobs', {});
    const fresh = {};
    await Promise.all(files.map(async (f) => {
      let text = cache[f.sha];
      if (text == null) text = b64decode((await req(`/repos/${GH.repo}/git/blobs/${f.sha}`)).content);
      fresh[f.sha] = text;
      remote[f.path.slice(GH.dir.length + 1, -3)] = parseFile(text);
    }));
    store.set('gh-blobs', fresh);
    return ids().map((id) => { const c = current(id); return { id, ...c.meta, preview: makePreview(c.body) }; });
  }

  const autoCommit = debounce(() => { if (Object.keys(pending).length) commit(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (document.hidden && Object.keys(pending).length) commit(); });

  async function commit(message) {
    if (committing) return committing;
    committing = (async () => {
      const snap = JSON.parse(JSON.stringify(pending));
      const entries = Object.entries(snap)
        .filter(([id, p]) => !(p.deleted && !remote[id]))
        .map(([id, p]) => ({ path: `${GH.dir}/${id}.md`, mode: '100644', type: 'blob', ...(p.deleted ? { sha: null } : { content: serializeFile(p.meta, p.body) }) }));
      const done = () => {
        for (const [id, p] of Object.entries(snap)) {
          if (JSON.stringify(pending[id]) !== JSON.stringify(p)) continue; // 올리는 사이 또 고친 건 남긴다
          delete pending[id];
          if (p.deleted) delete remote[id]; else remote[id] = p;
        }
        keepPending();
      };
      if (!entries.length) { done(); return { ok: true, nothing: true }; }
      const n = entries.length;
      const msg = (message || '').trim() || `웹에서 아이디어 노트 업데이트 (${n}개 파일)`;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const ref = await req(`/repos/${GH.repo}/git/ref/heads/${GH.branch}`);
          const base = await req(`/repos/${GH.repo}/git/commits/${ref.object.sha}`);
          const tree = await req(`/repos/${GH.repo}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: base.tree.sha, tree: entries }) });
          const c = await req(`/repos/${GH.repo}/git/commits`, { method: 'POST', body: JSON.stringify({ message: msg, tree: tree.sha, parents: [ref.object.sha] }) });
          await req(`/repos/${GH.repo}/git/refs/heads/${GH.branch}`, { method: 'PATCH', body: JSON.stringify({ sha: c.sha }) });
          done();
          lastCommit = Date.now();
          store.set('gh-last', lastCommit);
          return { ok: true, pushed: true };
        } catch (e) {
          if (e.status === 401) return { ok: false, error: '토큰이 만료됐거나 잘못됐어요' };
          if (attempt === 2) return { ok: false, error: e.message };
        }
      }
    })();
    try { return await committing; } finally { committing = null; refreshGit(); }
  }

  return {
    hasToken: () => !!token(),
    async check(t) {
      const r = await fetch(`https://api.github.com/repos/${GH.repo}`, { headers: { Authorization: `Bearer ${t}`, Accept: 'application/vnd.github+json' } });
      if (!r.ok) return false;
      const j = await r.json();
      return !!j.permissions?.push;
    },
    setToken(t) { store.set('gh-token', t); },
    logout() { try { localStorage.removeItem('gh-token'); } catch {} },
    list,
    async get(id) { const c = current(id); return c ? { id, meta: c.meta, body: c.body } : null; },
    async save(id, meta, body) {
      const prev = current(id) || { meta: {}, body: '' };
      const next = { ...prev.meta, ...meta, updated: new Date().toISOString() };
      for (const k of Object.keys(next)) if (next[k] === null) delete next[k];
      if (!next.created) next.created = next.updated;
      pending[id] = { meta: next, body: body ?? prev.body };
      keepPending();
      autoCommit();
      return { id, meta: next };
    },
    async remove(id) { pending[id] = { deleted: true }; keepPending(); autoCommit(); },
    async git() { return { repo: true, web: true, remote: true, changes: Object.keys(pending).length, last: lastCommit }; },
    commit,
  };
})();

const api = LOCAL ? localApi : ghApi;

// ---------- 인라인 마크다운 <-> HTML ----------
function mdToHtml(md) {
  if (!md) return '';
  const codes = [];
  let s = md.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = escapeHtml(s)
    .replace(/&lt;br&gt;/g, '<br>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*]+?)\*/g, '$1<i>$2</i>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codes[i])}</code>`);
}

function htmlToMd(root) {
  let out = '';
  const walk = (node) => {
    if (node.nodeType === 3) { out += node.nodeValue.replace(/ /g, ' '); return; }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    const st = node.style || {};
    const wrap = (l, r = l) => { out += l; node.childNodes.forEach(walk); out += r; };
    if (tag === 'br') { out += '<br>'; return; }
    if (tag === 'code') { out += '`' + node.textContent + '`'; return; }
    if (tag === 'b' || tag === 'strong' || (tag === 'span' && /bold|[6-9]00/.test(st.fontWeight))) return wrap('**');
    if (tag === 'i' || tag === 'em' || (tag === 'span' && st.fontStyle === 'italic')) return wrap('*');
    if (tag === 's' || tag === 'strike' || tag === 'del') return wrap('~~');
    if (tag === 'a') { out += '['; node.childNodes.forEach(walk); out += `](${node.getAttribute('href') || ''})`; return; }
    if ((tag === 'div' || tag === 'p') && out && !out.endsWith('<br>')) out += '<br>';
    node.childNodes.forEach(walk);
  };
  root.childNodes.forEach(walk);
  return out.replace(/(<br>)+$/, '').replace(/\*\*\*\*|~~~~/g, '').replace(/\n/g, '<br>');
}

const plainLen = (md) => { const d = document.createElement('div'); d.innerHTML = mdToHtml(md); return d.textContent.length; };

// ---------- 블록 <-> 마크다운 파일 ----------
// 같은 깊이에서 이어지는 번호 목록 번호 매기기 — [깊이별 번호]
function listNumbers(blocks) {
  const last = [], count = [];
  return blocks.map((b) => {
    const L = b.indent || 0;
    last.length = L + 1; count.length = L + 1;
    const n = b.type === 'ol' ? (last[L] === 'ol' ? count[L] + 1 : 1) : 0;
    last[L] = b.type; count[L] = n;
    return n;
  });
}
const INDENT = '    ';
function blocksToMd(blocks) {
  const parts = [];
  const nums = listNumbers(blocks);
  blocks.forEach((b, i) => {
    const prev = blocks[i - 1];
    const pad = INDENT.repeat(b.indent || 0);
    let s;
    switch (b.type) {
      case 'h1': s = `# ${b.text}`; break;
      case 'h2': s = `## ${b.text}`; break;
      case 'h3': s = `### ${b.text}`; break;
      case 'ul': s = `- ${b.text}`; break;
      case 'ol': s = `${nums[i]}. ${b.text}`; break;
      case 'todo': s = `- [${b.checked ? 'x' : ' '}] ${b.text}`; break;
      case 'quote': s = `> ${b.text}`; break;
      case 'callout': s = `<aside>${b.icon || '💡'} ${b.text}</aside>`; break;
      case 'toggle': s = `<details><summary>${b.text}</summary>${b.body || ''}</details>`; break;
      case 'divider': s = '---'; break;
      case 'code': s = ['```' + (b.lang || ''), ...b.text.split('\n'), '```'].join('\n' + pad); break;
      default: s = b.text ? b.text : '<br>';
    }
    // 목록끼리, 그리고 하위 블록은 붙여 쓴다
    const tight = prev && ((LIST_TYPES.has(b.type) && LIST_TYPES.has(prev.type)) || (b.indent || 0) > 0);
    parts.push((parts.length ? (tight ? '\n' : '\n\n') : '') + pad + s);
  });
  // 끝의 빈 문단은 저장하지 않는다
  return parts.join('').replace(/(\n\n<br>)+$/, '');
}

function mdToBlocks(md) {
  const lines = (md || '').replace(/\r/g, '').replace(/\t/g, INDENT).split('\n');
  const blocks = [];
  // 들여쓰기 폭이 2칸이든 4칸이든 앞 줄보다 깊으면 한 단계 안쪽으로 본다
  const widths = [0];
  let indent = 0, base = -1;
  const mk = (type, text = '', extra = {}) => blocks.push({ id: uid(), type, text, indent, ...extra });
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const spaces = raw.match(/^ */)[0].length;
    if (base < 0) base = spaces; // 붙여넣은 조각이 통째로 들여써져 있어도 첫 줄을 0단계로
    const w = Math.max(0, spaces - base);
    while (widths.length > 1 && widths[widths.length - 1] > w) widths.pop();
    if (w > widths[widths.length - 1]) widths.push(w);
    const prevInd = blocks.length ? blocks[blocks.length - 1].indent : -1;
    indent = Math.min(widths.length - 1, prevInd + 1);
    if (indent < widths.length - 1) { widths.length = indent + 1; if (indent > 0) widths[indent] = w; }
    const line = raw.slice(spaces);
    let m;
    if ((m = line.match(/^```(.*)$/))) {
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) buf.push(lines[i++].replace(new RegExp(`^ {0,${spaces}}`), ''));
      mk('code', buf.join('\n'), { lang: m[1].trim() });
      continue;
    }
    if ((m = line.match(/^<details><summary>(.*?)<\/summary>(.*)<\/details>$/))) { mk('toggle', m[1], { body: m[2] }); continue; }
    if ((m = line.match(/^<aside>(\S+)\s?(.*)<\/aside>$/u))) { mk('callout', m[2], { icon: m[1] }); continue; }
    if ((m = line.match(/^(#{1,3}) (.*)$/))) { mk('h' + m[1].length, m[2]); continue; }
    if ((m = line.match(/^[-*] \[( |x|X)\] ?(.*)$/))) { mk('todo', m[2], { checked: m[1] !== ' ' }); continue; }
    if ((m = line.match(/^[-*+] (.*)$/))) { mk('ul', m[1]); continue; }
    if ((m = line.match(/^\d+[.)] (.*)$/))) { mk('ol', m[1]); continue; }
    if ((m = line.match(/^> ?(.*)$/))) { mk('quote', m[1]); continue; }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { mk('divider'); continue; }
    mk('p', line === '<br>' ? '' : line);
  }
  return blocks;
}

// 깊이별 표시 — 노션처럼 • ◦ ▪ / 1. a. i.
const BULLETS = ['•', '◦', '▪'];
const toAlpha = (n) => { let s = ''; while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } return s; };
const toRoman = (n) => [[10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']].reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
const numLabel = (n, depth) => (depth % 3 === 1 ? toAlpha(n) : depth % 3 === 2 ? toRoman(n) : String(n)) + '.';

// ---------- 캐럿 ----------
function caretOffset(el) {
  const sel = getSelection();
  if (!sel.rangeCount || !el.contains(sel.anchorNode)) return -1;
  const r = sel.getRangeAt(0).cloneRange();
  r.selectNodeContents(el);
  r.setEnd(sel.focusNode, sel.focusOffset);
  return r.toString().length;
}
function rangeAt(el, start, end = start) {
  const r = document.createRange();
  let pos = 0, sSet = false;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const len = n.nodeValue.length;
    if (!sSet && start <= pos + len) { r.setStart(n, start - pos); sSet = true; }
    if (sSet && end <= pos + len) { r.setEnd(n, end - pos); return r; }
    pos += len;
  }
  r.selectNodeContents(el);
  r.collapse(false);
  if (sSet) { /* end 가 범위를 넘으면 끝까지 */ }
  return r;
}
function setCaret(el, pos) {
  el.focus();
  const sel = getSelection();
  const len = el.textContent.length;
  const r = pos === 'end' || pos >= len ? (() => { const x = document.createRange(); x.selectNodeContents(el); x.collapse(false); return x; })()
    : rangeAt(el, Math.max(0, pos));
  sel.removeAllRanges();
  sel.addRange(r);
}
function atFirstLine(el) {
  const sel = getSelection();
  if (!sel.rangeCount) return true;
  const rr = sel.getRangeAt(0).getClientRects()[0];
  if (!rr) return caretOffset(el) === 0;
  return rr.top - el.getBoundingClientRect().top < 18;
}
function atLastLine(el) {
  const sel = getSelection();
  if (!sel.rangeCount) return true;
  const rr = sel.getRangeAt(0).getClientRects()[0];
  if (!rr) return caretOffset(el) >= el.textContent.length;
  return el.getBoundingClientRect().bottom - rr.bottom < 18;
}

// ---------- 상태 ----------
const state = {
  pages: [],
  page: null, // { id, meta, blocks }
  tagFilter: null,
  expanded: store.get('expanded', {}),
};
const byId = (id) => state.pages.find((p) => p.id === id);
const isRetro = (p) => p && p.kind === 'retro';
const isFolder = (p) => p && p.kind === 'folder';
// 폴더 안(몇 단계 아래든)에 있는 문서인지
const inFolder = (p) => {
  const seen = new Set();
  let cur = p;
  while (cur && cur.parent && !seen.has(cur.id)) { seen.add(cur.id); cur = byId(cur.parent); if (isFolder(cur)) return true; }
  return false;
};
const folderOf = (p) => {
  const seen = new Set();
  let cur = p;
  while (cur && cur.parent && !seen.has(cur.id)) { seen.add(cur.id); cur = byId(cur.parent); if (isFolder(cur)) return cur; }
  return null;
};
// 지금 화면(보드·폴더)을 다시 그리는 함수 — 카드 상태를 바꾸면 이걸 부른다
let refreshView = () => {};
const childrenOf = (id) => state.pages
  .filter((p) => (p.parent || null) === (id || null) && !(id == null && isRetro(p)))
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.created).localeCompare(String(b.created)));

// ---------- 저장 ----------
const saveState = $('#save-state');
let saving = 0;
function setSaveText(t) { saveState.textContent = t; }

const savePage = debounce(async () => {
  const pg = state.page;
  if (!pg) return;
  saving++;
  setSaveText('저장 중…');
  const body = blocksToMd(pg.blocks);
  const res = await api.save(pg.id, pg.meta, body);
  // 화면이 같은 객체를 들고 있으니 바꿔치기하지 말고 내용만 갱신
  Object.assign(pg.meta, res.meta);
  const preview = body.replace(/<[^>]+>/g, ' ').replace(/\]\([^)]*\)/g, '').replace(/[#>*`~\[\]]|^- |\n- /g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
  upsertListEntry({ id: pg.id, ...res.meta, preview });
  saving--;
  if (!saving) setSaveText('저장됨');
  refreshGit();
}, 500);

function upsertListEntry(entry) {
  const i = state.pages.findIndex((p) => p.id === entry.id);
  if (i >= 0) state.pages[i] = { ...state.pages[i], ...entry };
  else state.pages.push(entry);
}

async function saveMeta(id, patch) {
  const res = await api.save(id, patch);
  upsertListEntry({ id, ...res.meta });
  refreshGit();
  return res;
}

window.addEventListener('beforeunload', () => savePage.flush());

// ---------- 라우팅 ----------
async function route() {
  savePage.flush();
  closePop();
  document.body.classList.remove('side-open');
  const hash = location.hash || '#/board';
  const m = hash.match(/^#\/p\/([a-z0-9-]+)/);
  const r = hash.match(/^#\/retro(?:\/(week|month))?/);
  if (m) await openPage(m[1]);
  else if (r) renderRetro(r[1] || 'week');
  else renderBoard();
  renderTree();
}
window.addEventListener('hashchange', route);

// ---------- 사이드바 ----------
function renderTree() {
  const tree = $('#tree');
  const q = $('#search').value.trim().toLowerCase();
  tree.innerHTML = '';
  const activeId = state.page && location.hash.startsWith('#/p/') ? state.page.id : null;
  const navRoute = activeId ? (isRetro(state.page.meta) ? 'retro' : null) : location.hash.startsWith('#/retro') ? 'retro' : 'board';
  document.querySelectorAll('.side-nav .side-item').forEach((a) => a.classList.toggle('active', a.dataset.route === navRoute));

  if (q) {
    const hits = state.pages.filter((p) => [p.title, p.preview, ...(p.tags || [])].join(' ').toLowerCase().includes(q));
    if (!hits.length) tree.append(h('div', { class: 'pop-empty' }, '결과가 없어요'));
    hits.forEach((p) => tree.append(treeItem(p, 0, activeId, true)));
    return;
  }
  const build = (parentId, depth) => {
    const wrap = h('div', { class: depth ? 'si-children' : '' });
    for (const p of childrenOf(parentId)) {
      wrap.append(treeItem(p, depth, activeId));
      if (state.expanded[p.id] && childrenOf(p.id).length) wrap.append(build(p.id, depth + 1));
    }
    return wrap;
  };
  const roots = build(null, 0);
  if (!roots.children.length) tree.append(h('div', { class: 'pop-empty' }, '아직 페이지가 없어요'));
  tree.append(roots);
}

function treeItem(p, depth, activeId, flat) {
  const hasKids = !flat && childrenOf(p.id).length > 0;
  const caret = h('span', {
    class: `si-caret ${hasKids ? '' : 'empty'} ${state.expanded[p.id] ? 'open' : ''}`,
    onclick: (e) => { e.preventDefault(); e.stopPropagation(); state.expanded[p.id] = !state.expanded[p.id]; store.set('expanded', state.expanded); renderTree(); },
  }, '▶');
  return h('a', { class: `side-item ${p.id === activeId ? 'active' : ''}`, href: `#/p/${p.id}` },
    flat ? null : caret,
    h('span', { class: 'si-icon' }, p.icon || '📄'),
    h('span', { class: 'si-title' }, p.title || '제목 없음'),
    h('span', { class: 'si-actions' },
      h('button', { class: 'icon-btn sm', title: '하위 페이지 추가', onclick: (e) => { e.preventDefault(); e.stopPropagation(); createPage({ parent: p.id }); } }, '＋'),
    ),
  );
}

$('#search').addEventListener('input', renderTree);
$('#add-root').addEventListener('click', () => createPage());
const createFolder = (parent = null) => createPage({ parent, extra: { kind: 'folder', icon: '📁', view: 'board' } });
$('#add-folder').addEventListener('click', () => createFolder());
$('#add-folder-2').addEventListener('click', () => createFolder());
$('#add-root-2').addEventListener('click', () => createPage());
$('#side-open').addEventListener('click', () => document.body.classList.add('side-open'));
$('#side-close').addEventListener('click', () => document.body.classList.remove('side-open'));
$('#scrim').addEventListener('click', () => document.body.classList.remove('side-open'));

// ---------- git ----------
let gitInfo = { repo: false };
const refreshGit = debounce(async () => { gitInfo = await api.git(); renderGit(); }, 800);
function renderGit() {
  const bar = $('#gitbar');
  bar.innerHTML = '';
  if (!gitInfo.repo) {
    bar.append(h('div', { class: 'git-row' }, h('span', { class: 'git-dot off' }), h('span', { class: 'git-text' }, 'git 저장소가 아니에요', h('div', { class: 'git-sub' }, '폴더에서 git init 을 해주세요'))));
    return;
  }
  const dirty = gitInfo.changes > 0;
  if (gitInfo.web) {
    bar.append(h('div', { class: 'git-row' },
      h('span', { class: `git-dot ${dirty ? 'dirty' : ''}` }),
      h('span', { class: 'git-text' },
        dirty ? `GitHub 에 올릴 변경 ${gitInfo.changes}개` : 'GitHub 에 다 올라감',
        h('div', { class: 'git-sub' }, dirty ? '잠시 뒤 자동으로 올라가요' : gitInfo.last ? `마지막 저장 ${ago(gitInfo.last)}` : GH.repo)),
      h('button', { class: 'btn', disabled: !dirty, onclick: async () => {
        savePage.flush();
        const r = await api.commit();
        toast(r.ok ? (r.nothing ? '올릴 변경이 없어요' : 'GitHub 에 올렸어요') : '올리기 실패: ' + (r.error || ''));
      } }, '지금 올리기'),
      h('button', { class: 'icon-btn sm', title: '토큰 지우기(로그아웃)', onclick: () => {
        if (dirty && !confirm('아직 안 올린 변경이 있어요. 그래도 로그아웃할까요? (변경은 이 브라우저에 남아요)')) return;
        ghApi.logout(); location.reload();
      } }, '⏏')));
    return;
  }
  const btn = h('button', { class: 'btn', disabled: !dirty, onclick: (e) => openCommitPop(e.currentTarget) }, '커밋');
  bar.append(h('div', { class: 'git-row' },
    h('span', { class: `git-dot ${dirty ? 'dirty' : ''}` }),
    h('span', { class: 'git-text' },
      dirty ? `커밋 안 한 변경 ${gitInfo.changes}개` : '모두 커밋됨',
      h('div', { class: 'git-sub' }, (gitInfo.last ? `마지막 커밋 ${ago(gitInfo.last)}` : '아직 커밋 없음') + (gitInfo.remote ? ' · 원격 연결됨' : ' · 원격 없음'))),
    btn));
}
function openCommitPop(anchor) {
  const input = h('input', { class: 'pop-input', placeholder: '커밋 메시지 (비우면 자동)' });
  const go = async () => {
    savePage.flush();
    const r = await api.commit(input.value);
    closePop();
    toast(!r.ok ? '커밋 실패: ' + (r.out || r.error || '') : r.nothing ? '커밋할 변경이 없어요'
      : r.pushed === true ? '커밋하고 원격에 올렸어요' : r.pushed === false ? '커밋은 했지만 push 는 실패했어요' : '커밋했어요 (이 컴퓨터에만 있어요)');
    refreshGit.flush();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) go(); if (e.key === 'Escape') closePop(); });
  const pop = openPop(anchor, [h('div', { class: 'pop-label' }, 'data/ 폴더를 커밋해요'), input,
    h('div', { style: 'display:flex;justify-content:flex-end;margin-top:6px' }, h('button', { class: 'btn', onclick: go }, '커밋하기'))], { above: true });
  pop.style.width = '260px';
  input.focus();
}

function toast(msg) {
  const t = h('div', { style: 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--text);color:var(--bg);padding:8px 14px;border-radius:8px;font-size:14px;z-index:90;max-width:90vw' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 2200);
}

// ---------- 팝오버 ----------
let popState = null;
function openPop(anchor, content, opts = {}) {
  closePop();
  const layer = $('#popover-layer');
  const pop = h('div', { class: 'pop' }, content);
  layer.append(pop);
  const rect = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let x = Math.min(rect.left, innerWidth - pw - 8);
  let y = opts.above ? rect.top - ph - 6 : rect.bottom + 6;
  if (!opts.above && y + ph > innerHeight - 8) y = Math.max(8, rect.top - ph - 6);
  pop.style.left = Math.max(8, x) + 'px';
  pop.style.top = Math.max(8, y) + 'px';
  popState = { pop, onClose: opts.onClose };
  return pop;
}
function closePop() {
  if (!popState) return;
  const { pop, onClose } = popState;
  popState = null;
  pop.remove();
  onClose && onClose();
}
document.addEventListener('mousedown', (e) => {
  if (popState && !popState.pop.contains(e.target)) closePop();
});

function menuItem({ icon, label, sub, danger, compact, onclick }) {
  return h('button', { class: `pop-item ${danger ? 'danger' : ''} ${compact ? 'compact' : ''}`, onmousedown: (e) => e.preventDefault(), onclick },
    icon != null ? h('span', { class: 'pi-icon' }, icon) : null,
    h('span', { class: 'pi-text' }, label, sub ? h('span', { class: 'pi-sub' }, sub) : null));
}

function emojiPicker(anchor, onPick, allowRemove) {
  const grid = h('div', { class: 'emoji-grid' }, EMOJIS.map((e) => h('button', { onclick: () => { closePop(); onPick(e); } }, e)));
  const pop = openPop(anchor, [grid, allowRemove ? menuItem({ label: '아이콘 지우기', compact: true, onclick: () => { closePop(); onPick(''); } }) : null]);
  pop.style.minWidth = '0';
}

// ---------- 페이지 생성/삭제 ----------
async function createPage({ parent = null, title = '', status = 'spark', body = '', tags = [], go = true, top = false, extra = {} } = {}) {
  const id = newPageId();
  const orders = state.pages.map((s) => s.order ?? 0);
  // 보드에서 바로 적은 카드는 맨 위로, 나머지는 맨 아래로
  const order = !orders.length ? 1 : top ? Math.min(...orders) - 1 : Math.max(...orders) + 1;
  const meta = { title, status, parent, order, tags, ...extra };
  upsertListEntry({ id, ...meta, created: new Date().toISOString(), preview: '' });
  const res = await api.save(id, meta, body);
  upsertListEntry({ id, ...res.meta });
  if (parent) { state.expanded[parent] = true; store.set('expanded', state.expanded); }
  if (go) location.hash = `#/p/${id}`;
  else renderTree();
  refreshGit();
  return id;
}

async function deletePage(id) {
  const p = byId(id);
  if (!confirm(`「${p?.title || '제목 없음'}」 페이지를 지울까요?\n(git 에 커밋돼 있었다면 기록에서 되살릴 수 있어요)`)) return;
  for (const c of childrenOf(id)) await saveMeta(c.id, { parent: p.parent || null });
  await api.remove(id);
  state.pages = state.pages.filter((x) => x.id !== id);
  if (state.page?.id === id) state.page = null;
  location.hash = p.parent ? `#/p/${p.parent}` : isRetro(p) ? `#/retro/${p.period}` : '#/board';
  renderTree();
  refreshGit();
}

// ---------- 페이지 화면 ----------
let editor = null;

async function openPage(id) {
  const data = await api.get(id);
  const view = $('#view');
  if (!data) {
    state.page = null;
    view.innerHTML = '';
    view.append(h('div', { class: 'empty-state' }, '페이지를 찾을 수 없어요'));
    return;
  }
  const blocks = mdToBlocks(data.body);
  state.page = { id, meta: data.meta, blocks };
  setSaveText('');
  renderCrumbs();
  const moreBtn = $('#page-more');
  moreBtn.hidden = false;
  moreBtn.onclick = () => openPop(moreBtn, [
    menuItem({ icon: '＋', label: '하위 페이지 추가', compact: true, onclick: () => { closePop(); createPage({ parent: id }); } }),
    menuItem({ icon: '↪', label: '폴더로 옮기기', compact: true, onclick: () => { closePop(); moveToFolderMenu(moreBtn, id); } }),
    isRetro(data.meta) ? null : menuItem({ icon: isFolder(data.meta) ? '📄' : '📁', label: isFolder(data.meta) ? '일반 페이지로 바꾸기' : '폴더로 바꾸기', compact: true, onclick: () => {
      closePop();
      const m = state.page.meta;
      if (isFolder(m)) delete m.kind; else { m.kind = 'folder'; m.view = m.view || 'board'; if (!m.icon) m.icon = '📁'; }
      upsertListEntry({ id, kind: m.kind || null, icon: m.icon });
      savePage.flush();
      setTimeout(route, 300);
    } }),
    menuItem({ icon: '📄', label: `data/pages/${id}.md`, compact: true, onclick: () => { navigator.clipboard?.writeText(`data/pages/${id}.md`); closePop(); toast('파일 경로를 복사했어요'); } }),
    h('div', { class: 'pop-sep' }),
    menuItem({ icon: '🗑', label: '페이지 삭제', danger: true, compact: true, onclick: () => { closePop(); deletePage(id); } }),
  ]);

  const meta = state.page.meta;
  view.innerHTML = '';
  view.scrollTop = 0;
  const page = h('div', { class: 'page' });

  // 아이콘
  const iconWrap = h('div');
  const drawIcon = () => {
    iconWrap.innerHTML = '';
    const set = (e) => { meta.icon = e; drawIcon(); savePage(); renderTree(); renderCrumbs(); };
    if (meta.icon) iconWrap.append(h('button', { class: 'page-icon', onclick: (ev) => emojiPicker(ev.currentTarget, set, true) }, meta.icon));
    else iconWrap.append(h('button', { class: 'page-add-icon', onclick: (ev) => emojiPicker(ev.currentTarget, set) }, '☺ 아이콘 추가'));
  };
  drawIcon();

  // 제목
  const title = h('div', { class: 'page-title', contenteditable: 'true', 'data-ph': '제목 없음', spellcheck: 'false' });
  title.textContent = meta.title || '';
  title.addEventListener('input', () => {
    meta.title = title.textContent.replace(/\n/g, ' ');
    if (!title.textContent) title.innerHTML = '';
    savePage();
    renderTree();
    renderCrumbs();
  });
  const toFirstBlock = () => {
    if (!state.page.blocks.length) state.page.blocks.push({ id: uid(), type: 'p', text: '' });
    editor.render();
    editor.focus(state.page.blocks[0].id, 'start');
  };
  title.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' || (e.key === 'ArrowDown' && atLastLine(title))) { e.preventDefault(); toFirstBlock(); }
  });
  title.addEventListener('beforeinput', (e) => { if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') { e.preventDefault(); toFirstBlock(); } });
  title.addEventListener('paste', (e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\n/g, ' ')); });

  page.append(iconWrap, title, renderProps(meta));

  if (isFolder(meta)) {
    page.classList.add('folder-page');
    page.append(folderCollection({ id, meta }));
  }
  const kids = isFolder(meta) ? [] : childrenOf(id);
  if (kids.length) {
    page.append(h('div', { class: 'subpages' }, kids.map((k) =>
      h('a', { class: 'subpage', href: `#/p/${k.id}` }, h('span', {}, k.icon || '📄'), h('span', {}, k.title || '제목 없음')))));
  }

  const edWrap = h('div', { class: 'editor' });
  page.append(edWrap);
  if (!isFolder(meta) || blocks.length) page.append(h('div', { class: isFolder(meta) ? 'editor-tail short' : 'editor-tail', onclick: () => {
    const last = state.page.blocks[state.page.blocks.length - 1];
    if (last && last.type === 'p' && !last.text) return editor.focus(last.id, 'end');
    const b = { id: uid(), type: 'p', text: '' };
    state.page.blocks.push(b);
    editor.render();
    editor.focus(b.id, 'start');
  } }));
  view.append(page);

  editor = createEditor(edWrap, state.page, () => savePage());
  editor.render();
  if (!meta.title) title.focus();
}

function renderCrumbs() {
  const c = $('#crumbs');
  c.innerHTML = '';
  if (!state.page || !location.hash.startsWith('#/p/')) {
    c.append(h('span', { class: 'crumb' }, location.hash.startsWith('#/retro') ? '🗓️ 주별 · 월별 회고' : '📋 아이디어 보드'));
    return;
  }
  const chain = [];
  let cur = byId(state.page.id) || { id: state.page.id, ...state.page.meta };
  const seen = new Set();
  while (cur && !seen.has(cur.id)) { seen.add(cur.id); chain.unshift(cur); cur = cur.parent ? byId(cur.parent) : null; }
  const root = chain[0]?.id === state.page.id ? state.page.meta : chain[0];
  if (isRetro(root)) {
    c.append(h('a', { class: 'crumb', href: `#/retro/${root.period}` }, `🗓️ ${root.period === 'month' ? '월별' : '주별'} 회고`));
    c.append(h('span', { class: 'crumb-sep' }, '/'));
  }
  chain.forEach((p, i) => {
    if (i) c.append(h('span', { class: 'crumb-sep' }, '/'));
    const meta = p.id === state.page.id ? state.page.meta : p;
    c.append(h('a', { class: 'crumb', href: `#/p/${p.id}` }, `${meta.icon || '📄'} ${meta.title || '제목 없음'}`));
  });
}

function statusPill(key) {
  const s = statusOf(key);
  return h('span', { class: 'status-pill', style: `background:var(--c-${s.color});color:var(--c-${s.color}-t)` }, `${s.icon} ${s.label}`);
}

function renderProps(meta) {
  if (isRetro(meta)) return renderRetroProps(meta);
  if (isFolder(meta)) return h('div', { class: 'folder-desc prop-muted' }, `📁 폴더 · 만든 날 ${fmtDate(meta.created)}`);
  const props = h('div', { class: 'props' });
  // 상태
  const statusV = h('div', { class: 'prop-v click' }, statusPill(meta.status));
  statusV.addEventListener('click', () => openPop(statusV, STATUSES.map((s) => menuItem({
    compact: true, icon: s.icon, label: s.label,
    onclick: () => { meta.status = s.key; statusV.innerHTML = ''; statusV.append(statusPill(s.key)); closePop(); savePage(); },
  }))));
  // 태그
  const tagsV = h('div', { class: 'prop-v' });
  const drawTags = () => {
    tagsV.innerHTML = '';
    (meta.tags || []).forEach((t) => {
      const c = tagColor(t);
      tagsV.append(h('span', { class: 'tag', style: `background:var(--c-${c});color:var(--c-${c}-t)` }, t,
        h('span', { class: 'x', onclick: () => { meta.tags = meta.tags.filter((x) => x !== t); drawTags(); savePage(); } }, '✕')));
    });
    const inp = h('input', { class: 'tag-input', placeholder: meta.tags?.length ? '＋' : '태그 추가 (Enter)', enterkeyhint: 'done' });
    const addTag = (e) => {
      e?.preventDefault();
      const v = inp.value.trim().replace(/,/g, '');
      if (!v) return;
      meta.tags = [...new Set([...(meta.tags || []), v])];
      drawTags();
      savePage();
      $('.tag-input', tagsV).focus();
    };
    inp.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      const v = inp.value.trim().replace(/,/g, '');
      if (e.key === ',' && v) {
        e.preventDefault();
        meta.tags = [...new Set([...(meta.tags || []), v])];
        drawTags();
        savePage();
        $('.tag-input', tagsV).focus();
      } else if (e.key === 'Backspace' && !inp.value && meta.tags?.length) {
        meta.tags = meta.tags.slice(0, -1);
        drawTags();
        savePage();
        $('.tag-input', tagsV).focus();
      }
    });
    const all = [...new Set(state.pages.flatMap((p) => p.tags || []))].filter((t) => !(meta.tags || []).includes(t));
    if (all.length) {
      inp.setAttribute('list', 'tag-suggest');
      let dl = document.getElementById('tag-suggest');
      if (!dl) { dl = h('datalist', { id: 'tag-suggest' }); document.body.append(dl); }
      dl.innerHTML = '';
      all.forEach((t) => dl.append(h('option', { value: t })));
    }
    tagsV.append(h('form', { style: 'display:contents', onsubmit: addTag }, inp));
  };
  drawTags();

  props.append(
    h('div', { class: 'prop-k' }, '◎ 상태'), statusV,
    h('div', { class: 'prop-k' }, '# 태그'), tagsV,
    h('div', { class: 'prop-k' }, '◷ 만든 날'), h('div', { class: 'prop-v prop-muted' }, fmtDate(meta.created)),
  );
  return props;
}

// ---------- 블록 편집기 ----------
function createEditor(root, doc, onChange) {
  const blocks = doc.blocks;
  const idx = (id) => blocks.findIndex((b) => b.id === id);
  const rowEl = (id) => root.querySelector(`.blk[data-id="${id}"]`);
  const textEl = (id) => rowEl(id)?.querySelector('.blk-text');
  let slash = null; // { id, start, hl, items }

  // ---- 되돌리기 기록 (화면을 다시 그리면 브라우저 기본 기록이 사라져서 직접 관리) ----
  const undoStack = [], redoStack = [];
  const caretNow = () => {
    const t = document.activeElement?.closest?.('.blk-text');
    const row = t && root.contains(t) ? t.closest('.blk') : null;
    return row ? { id: row.dataset.id, off: caretOffset(t) } : null;
  };
  const snap = () => ({ blocks: JSON.parse(JSON.stringify(blocks)), sel: caretNow() });
  let last = snap();
  let lastJson = JSON.stringify(last.blocks);
  let typingTimer = null;
  function commit() {
    clearTimeout(typingTimer);
    typingTimer = null;
    const cur = JSON.stringify(blocks);
    if (cur === lastJson) return;
    undoStack.push(last);
    if (undoStack.length > 200) undoStack.shift();
    redoStack.length = 0;
    last = snap();
    lastJson = cur;
  }
  function restore(from, to) {
    commit();
    if (!from.length) return;
    to.push(snap());
    const s = from.pop();
    blocks.splice(0, blocks.length, ...JSON.parse(JSON.stringify(s.blocks)));
    last = s;
    lastJson = JSON.stringify(blocks);
    closeSlash();
    render();
    const target = s.sel && blocks.find((b) => b.id === s.sel.id) ? s.sel : blocks[0] && { id: blocks[0].id, off: 'end' };
    if (target) focus(target.id, target.off < 0 ? 'end' : target.off);
    onChange();
  }
  const undo = () => restore(undoStack, redoStack);
  const redo = () => restore(redoStack, undoStack);

  // 구조가 바뀌면 바로 한 단계, 타이핑은 잠깐 멈출 때마다 한 단계
  const change = () => { onChange(); commit(); };
  const typed = () => { onChange(); clearTimeout(typingTimer); typingTimer = setTimeout(commit, 700); };
  // 버튼·메뉴·끌기 전에 치던 글을 먼저 한 단계로 끊는다
  root.addEventListener('mousedown', () => { if (typingTimer) commit(); }, true);

  const ind = (b) => b.indent || 0;
  // i 번째 블록과 그 하위 블록들의 끝(다음 형제 위치)
  const subtreeEnd = (i) => { let j = i + 1; while (j < blocks.length && ind(blocks[j]) > ind(blocks[i])) j++; return j; };
  const hasChildren = (i) => i + 1 < blocks.length && ind(blocks[i + 1]) > ind(blocks[i]);
  let hidden = new Set();
  const visIdx = (i, dir) => { let j = i + dir; while (j >= 0 && j < blocks.length && hidden.has(blocks[j].id)) j += dir; return blocks[j] ? j : -1; };

  function render() {
    root.innerHTML = '';
    hidden = new Set();
    const nums = listNumbers(blocks);
    let hideBelow = Infinity; // 접힌 토글 아래 깊이
    blocks.forEach((b, i) => {
      if (ind(b) > hideBelow) { hidden.add(b.id); return; }
      hideBelow = Infinity;
      if (b.type === 'toggle') {
        if (b.open === undefined) b.open = !b.body && !hasChildren(i);
        if (!b.open) hideBelow = ind(b);
      }
      root.append(renderBlock(b, nums[i], i));
    });
  }

  // Tab / Shift+Tab — 하위 블록도 같이 움직인다
  function indentBlock(id, d) {
    const i = idx(id);
    const b = blocks[i];
    if (!b) return false;
    const end = subtreeEnd(i);
    if (d > 0) {
      const p = visIdx(i, -1);
      if (p < 0 || ind(b) + 1 > ind(blocks[p]) + 1) return false;
      if (blocks[p].type === 'toggle') blocks[p].open = true;
    } else if (!ind(b)) return false;
    for (let k = i; k < end; k++) blocks[k].indent = Math.max(0, ind(blocks[k]) + d);
    return true;
  }
  function indentAndKeepCaret(b, el, d) {
    syncFromDom(b);
    const off = caretOffset(el);
    if (!indentBlock(b.id, d)) return;
    render();
    focus(b.id, off < 0 ? 'end' : off);
    change();
  }
  // ⌘⇧↑↓ — 같은 깊이의 앞뒤 형제와 자리 바꾸기
  function moveBlock(b, el, dir) {
    syncFromDom(b);
    const off = caretOffset(el);
    const i = idx(b.id), end = subtreeEnd(i), L = ind(b);
    if (dir < 0) {
      let j = i - 1;
      while (j >= 0 && ind(blocks[j]) > L) j--;
      if (j < 0 || ind(blocks[j]) < L) return;
      const mine = blocks.splice(i, end - i);
      blocks.splice(j, 0, ...mine);
    } else {
      if (end >= blocks.length || ind(blocks[end]) !== L) return;
      const nextEnd = subtreeEnd(end);
      const theirs = blocks.splice(end, nextEnd - end);
      blocks.splice(i, 0, ...theirs);
    }
    render(); focus(b.id, off < 0 ? 'end' : off); change();
  }
  function duplicateBlock(b) {
    syncFromDom(b);
    const i = idx(b.id), end = subtreeEnd(i);
    const copy = blocks.slice(i, end).map((x) => ({ ...x, id: uid() }));
    blocks.splice(end, 0, ...copy);
    render(); focus(copy[0].id); change();
  }
  function deleteBlock(b) {
    const i = idx(b.id);
    blocks.splice(i, subtreeEnd(i) - i);
    render();
    const n = blocks[Math.min(i, blocks.length) - 1] || blocks[i];
    if (n) focus(n.id, 'end');
    change();
  }

  function focus(id, pos = 'end') {
    const el = textEl(id);
    if (el) setCaret(el, pos);
    else rowEl(id)?.querySelector('.blk-body')?.focus();
  }

  function insertAfter(id, block) {
    const i = id ? idx(id) : blocks.length - 1;
    if (block.indent === undefined) block.indent = blocks[i] ? ind(blocks[i]) : 0;
    blocks.splice(i + 1, 0, block);
    return block;
  }

  function syncFromDom(b) {
    const el = textEl(b.id);
    if (!el) return;
    b.text = b.type === 'code' ? el.textContent : htmlToMd(el);
  }

  function renderBlock(b, num, i) {
    const row = h('div', { class: `blk ${b.type === 'todo' && b.checked ? 'done' : ''}`, 'data-id': b.id, 'data-type': b.type, style: `--ind:${ind(b)}` });
    // 핸들
    const addBtn = h('button', { class: 'add', title: '아래에 블록 추가', onclick: () => {
      const nb = insertAfter(b.id, { id: uid(), type: 'p', text: '/' });
      render();
      focus(nb.id, 'end');
      openSlash(nb.id, 0);
    } }, '＋');
    const dragBtn = h('button', { class: 'drag', title: '드래그해서 옮기기 · 클릭해서 메뉴', onclick: (e) => blockMenu(b, e.currentTarget, row) }, '⋮⋮');
    dragBtn.addEventListener('mousedown', () => { row.draggable = true; });
    row.append(h('div', { class: 'blk-handle' }, addBtn, dragBtn));

    const body = h('div', { class: 'blk-body' });
    row.append(body);

    if (b.type === 'divider') {
      body.tabIndex = 0;
      body.append(h('hr'));
      body.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          const i = idx(b.id);
          blocks.splice(i, 1);
          render();
          const n = blocks[i - 1] || blocks[i];
          if (n) focus(n.id, 'end');
          change();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const nb = insertAfter(b.id, { id: uid(), type: 'p', text: '' });
          render();
          focus(nb.id);
          change();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const n = blocks[visIdx(idx(b.id), e.key === 'ArrowUp' ? -1 : 1)];
          if (n) focus(n.id, e.key === 'ArrowUp' ? 'end' : 'start');
        }
      });
      return row;
    }

    // 앞 표시
    if (b.type === 'ul') body.append(h('span', { class: 'mk mk-bullet' }, BULLETS[ind(b) % 3]));
    if (b.type === 'ol') body.append(h('span', { class: 'mk mk-num' }, numLabel(num, ind(b))));
    if (b.type === 'todo') {
      body.append(h('span', { class: `mk-check ${b.checked ? 'on' : ''}`, role: 'checkbox', 'aria-checked': String(!!b.checked), onclick: () => {
        b.checked = !b.checked;
        row.classList.toggle('done', b.checked);
        row.querySelector('.mk-check').classList.toggle('on', b.checked);
        change();
      } }));
    }
    if (b.type === 'callout') {
      body.append(h('button', { class: 'callout-icon', onclick: (e) => emojiPicker(e.currentTarget, (em) => { b.icon = em || '💡'; render(); change(); }) }, b.icon || '💡'));
    }
    if (b.type === 'code') {
      const lang = h('div', { class: 'code-lang', contenteditable: 'plaintext-only', spellcheck: 'false' });
      lang.textContent = b.lang || '';
      lang.addEventListener('input', () => { b.lang = lang.textContent.trim(); typed(); });
      lang.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); focus(b.id, 'start'); } });
      body.append(lang);
    }

    const text = h('div', {
      class: 'blk-text', contenteditable: b.type === 'code' ? 'plaintext-only' : 'true', spellcheck: 'false', 'data-ph': PLACEHOLDER[b.type] ?? '',
    });
    if (b.type === 'code') text.textContent = b.text;
    else text.innerHTML = mdToHtml(b.text);
    bindText(text, b);

    if (b.type === 'toggle') {
      const arrow = h('span', { class: `mk-toggle ${b.open ? 'open' : ''}`, onclick: () => { b.open = !b.open; render(); } }, '▶');
      const wrap = h('div', { class: 'toggle-wrap' }, text);
      if (b.open && b.body) {
        const tb = h('div', { class: 'blk-text', contenteditable: 'true', spellcheck: 'false', 'data-ph': '빈 토글이에요. 내용을 적어보세요' });
        tb.innerHTML = mdToHtml(b.body || '');
        tb.addEventListener('input', () => { if (tb.innerHTML === '<br>') tb.innerHTML = ''; b.body = htmlToMd(tb); typed(); });
        tb.addEventListener('keydown', (e) => {
          if (e.isComposing || e.keyCode === 229) return;
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.execCommand('insertLineBreak'); }
          if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
            e.preventDefault();
            const nb = insertAfter(b.id, { id: uid(), type: 'p', text: '' }); render(); focus(nb.id); change();
          }
          if (e.key === 'ArrowUp' && atFirstLine(tb)) { e.preventDefault(); focus(b.id, 'end'); }
          if (e.key === 'ArrowDown' && atLastLine(tb)) { const n = blocks[idx(b.id) + 1]; if (n) { e.preventDefault(); focus(n.id, 'start'); } }
        });
        tb.addEventListener('paste', pastePlain);
        wrap.append(h('div', { class: 'toggle-body' }, tb));
      } else if (b.open && !hasChildren(i)) {
        wrap.append(h('button', { class: 'toggle-empty', onclick: () => {
          const nb = insertAfter(b.id, { id: uid(), type: 'p', text: '', indent: ind(b) + 1 });
          render(); focus(nb.id); change();
        } }, '빈 토글이에요. 눌러서 안에 블록을 추가하세요'));
      }
      body.append(arrow, wrap);
    } else {
      body.append(text);
    }

    // 드래그
    row.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-block', b.id); e.dataTransfer.effectAllowed = 'move'; });
    row.addEventListener('dragend', () => { row.draggable = false; root.querySelectorAll('.drop-before,.drop-after').forEach((x) => x.classList.remove('drop-before', 'drop-after')); });
    row.addEventListener('dragover', (e) => {
      if (!e.dataTransfer.types.includes('text/x-block')) return;
      e.preventDefault();
      const r = row.getBoundingClientRect();
      const before = e.clientY < r.top + r.height / 2;
      root.querySelectorAll('.drop-before,.drop-after').forEach((x) => x.classList.remove('drop-before', 'drop-after'));
      row.classList.add(before ? 'drop-before' : 'drop-after');
    });
    row.addEventListener('drop', (e) => {
      const from = e.dataTransfer.getData('text/x-block');
      if (!from) return;
      e.preventDefault();
      const before = row.classList.contains('drop-before');
      const fi = idx(from);
      const fend = subtreeEnd(fi);
      const ti = idx(b.id);
      if (ti >= fi && ti < fend) return; // 자기 안으로는 못 옮긴다
      const moved = blocks.splice(fi, fend - fi);
      const delta = ind(b) - ind(moved[0]);
      moved.forEach((x) => { x.indent = Math.max(0, ind(x) + delta); });
      const t = idx(b.id);
      blocks.splice(before ? t : subtreeEnd(t), 0, ...moved);
      render();
      change();
    });
    return row;
  }

  function bindText(el, b) {
    el.addEventListener('input', (e) => {
      if (el.innerHTML === '<br>') el.innerHTML = '';
      syncFromDom(b);
      if (b.type !== 'code' && !e.isComposing) {
        if (markdownShortcut(el, b, e)) return;
        if (e.inputType === 'insertText' && e.data && e.data.includes('/')) {
          const start = caretOffset(el) - e.data.length + e.data.lastIndexOf('/');
          const before = el.textContent[start - 1];
          if (!before || /\s/.test(before)) openSlash(b.id, start);
        }
      }
      if (slash && slash.id === b.id) updateSlash(el);
      typed();
    });
    el.addEventListener('keydown', (e) => onKey(e, el, b));
    el.addEventListener('beforeinput', (e) => {
      if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') { e.preventDefault(); (e.inputType === 'historyUndo' ? undo : redo)(); return; }
      const fake = (key) => ({ key, shiftKey: false, metaKey: false, ctrlKey: false, isComposing: false, keyCode: 0, preventDefault() {} });
      if (e.inputType === 'insertParagraph' && b.type !== 'code') { e.preventDefault(); onKey(fake('Enter'), el, b); }
      else if (e.inputType === 'deleteContentBackward' && getSelection().isCollapsed && caretOffset(el) === 0) { e.preventDefault(); onKey(fake('Backspace'), el, b); }
    });
    el.addEventListener('paste', (e) => onPaste(e, el, b));
    el.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (href.startsWith('#/')) { e.preventDefault(); location.hash = href; }
      else if (e.metaKey || e.ctrlKey) { e.preventDefault(); window.open(href, '_blank', 'noopener'); }
    });
    el.addEventListener('blur', () => { if (slash && slash.id === b.id) setTimeout(() => { if (document.activeElement !== el) closeSlash(); }, 120); });
  }

  // "# ", "- ", "[] " 같은 단축 입력
  function markdownShortcut(el, b, e) {
    const plain = el.textContent;
    if (plain === '---' && b.type === 'p') {
      b.type = 'divider'; b.text = '';
      const nb = insertAfter(b.id, { id: uid(), type: 'p', text: '' });
      render(); focus(nb.id); change();
      return true;
    }
    if (e.inputType !== 'insertText' || !e.data || !e.data.includes(' ') || b.type === 'code') return false;
    const off = caretOffset(el);
    const insertedFrom = off - e.data.length;
    const head = plain.replace(/ /g, ' ');
    const map = { '### ': 'h3', '## ': 'h2', '# ': 'h1', '- ': 'ul', '* ': 'ul', '+ ': 'ul', '1. ': 'ol', '[] ': 'todo', '[ ] ': 'todo', '>> ': 'toggle', '> ': 'quote', '" ': 'quote', '``` ': 'code', '! ': 'callout' };
    // 방금 입력한 글자가 접두어 끝의 스페이스를 만든 경우만 바꾼다
    const prefix = Object.keys(map).find((k) => head.startsWith(k) && insertedFrom < k.length && off >= k.length);
    const type = prefix && map[prefix];
    if (!type || b.type === type) return false;
    if (b.type !== 'p' && !(b.type === 'quote' && type === 'toggle')) return false;
    const r = rangeAt(el, 0, prefix.length);
    r.deleteContents();
    syncFromDom(b);
    b.type = type;
    if (type === 'code') b.text = el.textContent;
    render();
    focus(b.id, 'start');
    change();
    return true;
  }

  function onKey(e, el, b) {
    if (e.isComposing || e.keyCode === 229) return;
    const modZ = (e.metaKey || e.ctrlKey) && !e.altKey;
    if (modZ && (e.key.toLowerCase() === 'z' || (e.key.toLowerCase() === 'y' && !e.shiftKey))) {
      e.preventDefault();
      (e.key.toLowerCase() === 'y' || e.shiftKey ? redo : undo)();
      return;
    }
    // 글자 말고 다른 키(Enter·지우기·Tab·화살표·단축키)를 누르기 전에 치던 글을 한 단계로 끊는다
    if (typingTimer && (e.key.length > 1 || e.metaKey || e.ctrlKey)) commit();
    if (slash && slash.id === b.id) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!slash.items.length) return;
        slash.hl = (slash.hl + (e.key === 'ArrowDown' ? 1 : -1) + slash.items.length) % slash.items.length;
        drawSlash();
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (slash.items.length) { e.preventDefault(); applySlash(slash.items[slash.hl].type); return; }
      }
      if (e.key === 'Escape') { e.preventDefault(); closeSlash(); return; }
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); formatCode(); return; }
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); formatLink(); return; }
    if (mod && e.key === 'Enter' && b.type === 'todo') { e.preventDefault(); $('.mk-check', rowEl(b.id)).click(); return; }
    if (mod && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); moveBlock(b, el, e.key === 'ArrowUp' ? -1 : 1); return; }
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateBlock(b); return; }
    if (mod && e.altKey && /^Digit[0-8]$/.test(e.code || '')) {
      e.preventDefault();
      const type = ['p', 'h1', 'h2', 'h3', 'todo', 'ul', 'ol', 'toggle', 'code'][Number(e.code.slice(5))];
      syncFromDom(b); b.type = type; render(); focus(b.id); change();
      return;
    }
    if (e.key === 'Tab' && b.type !== 'code') { e.preventDefault(); indentAndKeepCaret(b, el, e.shiftKey ? -1 : 1); return; }

    if (b.type === 'code') {
      if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); }
      if (e.key === 'Escape' || (e.key === 'Enter' && mod)) {
        e.preventDefault();
        const nb = insertAfter(b.id, { id: uid(), type: 'p', text: '' }); render(); focus(nb.id); change();
      }
      if (e.key === 'Backspace' && !el.textContent && !b.lang) { e.preventDefault(); b.type = 'p'; render(); focus(b.id); change(); }
      return;
    }

    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); document.execCommand('insertLineBreak'); return; }

    if (e.key === 'Enter') {
      e.preventDefault();
      // 빈 목록에서 Enter → 텍스트로
      if (!el.textContent && ind(b) > 0 && b.type !== 'toggle') { indentAndKeepCaret(b, el, -1); return; }
      if ((LIST_TYPES.has(b.type) || b.type === 'quote' || b.type === 'toggle' || b.type === 'callout') && !el.textContent) {
        b.type = 'p'; render(); focus(b.id); change(); return;
      }
      const sel = getSelection();
      const r = sel.getRangeAt(0);
      r.deleteContents();
      const after = document.createRange();
      after.setStart(r.endContainer, r.endOffset);
      after.setEnd(el, el.childNodes.length);
      const tail = h('div');
      tail.append(after.extractContents());
      syncFromDom(b);
      const tailMd = htmlToMd(tail);
      const keepType = LIST_TYPES.has(b.type) ? b.type : 'p';
      const atStart = !el.textContent && tailMd;
      let nb;
      if (atStart && b.type !== 'p') {
        // 제목 맨 앞에서 Enter → 위에 빈 줄 넣기
        nb = { id: uid(), type: 'p', text: '' };
        blocks.splice(idx(b.id), 0, nb);
        b.text = tailMd;
        render(); focus(b.id, 'start'); change(); return;
      }
      const i0 = idx(b.id);
      const intoChild = (b.type === 'toggle' && b.open) || (b.type !== 'toggle' && hasChildren(i0));
      nb = { id: uid(), type: keepType, text: tailMd, indent: ind(b) + (intoChild ? 1 : 0), ...(keepType === 'todo' ? { checked: false } : {}) };
      // 닫힌 토글이면 접힌 내용 뒤에 넣는다
      blocks.splice(intoChild ? i0 + 1 : b.type === 'toggle' ? subtreeEnd(i0) : i0 + 1, 0, nb);
      render();
      focus(nb.id, 'start');
      change();
      return;
    }

    if (e.key === 'Backspace') {
      const sel = getSelection();
      if (!sel.isCollapsed || caretOffset(el) !== 0) return;
      e.preventDefault();
      if (b.type !== 'p') { b.type = 'p'; render(); focus(b.id, 'start'); change(); return; }
      if (ind(b) > 0) { indentAndKeepCaret(b, el, -1); return; }
      const i = idx(b.id);
      const pi = visIdx(i, -1);
      const prev = pi >= 0 ? blocks[pi] : null;
      if (!prev) {
        if (!b.text && blocks.length > 1) { blocks.splice(i, 1); render(); focus(blocks[0].id, 'start'); change(); }
        return;
      }
      if (prev.type === 'divider') { blocks.splice(pi, 1); render(); focus(b.id, 'start'); change(); return; }
      if (prev.type === 'code') { if (!b.text) { blocks.splice(i, 1); render(); focus(prev.id, 'end'); change(); } return; }
      const at = plainLen(prev.text);
      prev.text = (prev.text || '') + (b.text || '');
      blocks.splice(i, 1);
      render();
      focus(prev.id, at);
      change();
      return;
    }

    if (e.key === 'Delete') {
      if (caretOffset(el) !== el.textContent.length) return;
      const i = idx(b.id);
      const next = blocks[i + 1];
      if (!next || next.type === 'divider' || next.type === 'code') { if (next) { e.preventDefault(); blocks.splice(i + 1, 1); render(); focus(b.id, 'end'); change(); } return; }
      e.preventDefault();
      const at = plainLen(b.text);
      b.text += next.text || '';
      blocks.splice(i + 1, 1);
      render(); focus(b.id, at); change();
      return;
    }

    if (e.key === 'ArrowUp' && atFirstLine(el)) {
      const prev = blocks[visIdx(idx(b.id), -1)];
      if (prev) { e.preventDefault(); focus(prev.id, 'end'); }
      else { e.preventDefault(); const t = $('.page-title'); if (t) setCaret(t, 'end'); }
    }
    if (e.key === 'ArrowDown' && atLastLine(el)) {
      const next = blocks[visIdx(idx(b.id), 1)];
      if (next) { e.preventDefault(); focus(next.id, 'start'); }
    }
  }

  // 여러 줄 붙여넣기 → 마크다운으로 해석해서 블록으로
  function onPaste(e, el, b) {
    const t = e.clipboardData.getData('text/plain');
    e.preventDefault();
    if (b.type === 'code' || !t.includes('\n')) { document.execCommand('insertText', false, t); return; }
    const parsed = mdToBlocks(t);
    if (!parsed.length) return;
    parsed.forEach((x) => { x.indent = ind(x) + ind(b); });
    const i = idx(b.id);
    if (!b.text && b.type === 'p') blocks.splice(i, 1, ...parsed);
    else blocks.splice(i + 1, 0, ...parsed);
    render();
    focus(parsed[parsed.length - 1].id, 'end');
    change();
  }
  function pastePlain(e) { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }

  // 블록 메뉴
  function blockMenu(b, anchor, row) {
    row.classList.add('menu-open', 'selected');
    const turn = BLOCK_TYPES.filter((t) => t.type !== 'divider').map((t) => menuItem({
      compact: true, icon: t.icon, label: t.label,
      onclick: () => { closePop(); syncFromDom(b); b.type = t.type; render(); focus(b.id); change(); },
    }));
    openPop(anchor, [
      menuItem({ compact: true, icon: '⧉', label: '복제  ⌘D', onclick: () => { closePop(); duplicateBlock(b); } }),
      menuItem({ compact: true, icon: '⇥', label: '들여쓰기  Tab', onclick: () => { closePop(); syncFromDom(b); if (indentBlock(b.id, 1)) { render(); focus(b.id); change(); } } }),
      menuItem({ compact: true, icon: '⇤', label: '내어쓰기  ⇧Tab', onclick: () => { closePop(); syncFromDom(b); if (indentBlock(b.id, -1)) { render(); focus(b.id); change(); } } }),
      menuItem({ compact: true, icon: '🗑', label: '삭제', danger: true, onclick: () => { closePop(); deleteBlock(b); } }),
      h('div', { class: 'pop-sep' }),
      h('div', { class: 'pop-label' }, '전환'),
      ...turn,
    ], { onClose: () => row.classList.remove('menu-open', 'selected') });
  }

  // 슬래시 메뉴
  function openSlash(id, start) {
    slash = { id, start, hl: 0, items: BLOCK_TYPES };
    drawSlash();
  }
  function updateSlash(el) {
    const off = caretOffset(el);
    const plain = el.textContent;
    if (off <= slash.start || plain[slash.start] !== '/') return closeSlash();
    const q = plain.slice(slash.start + 1, off).trim().toLowerCase();
    if (q.length > 12) return closeSlash();
    slash.items = BLOCK_TYPES.filter((t) => !q || (t.label + ' ' + t.keys).toLowerCase().includes(q));
    slash.hl = Math.min(slash.hl, Math.max(0, slash.items.length - 1));
    drawSlash();
  }
  function drawSlash() {
    const el = textEl(slash.id);
    if (!el) return;
    const sel = getSelection();
    let rect = sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
    if (!rect || (!rect.width && !rect.height && !rect.top)) rect = el.getBoundingClientRect();
    const s = slash;
    const content = s.items.length
      ? [h('div', { class: 'pop-label' }, '기본 블록'), ...s.items.map((t, i) => {
        const it = menuItem({ icon: t.icon, label: t.label, sub: t.sub, onclick: () => applySlash(t.type) });
        if (i === s.hl) it.classList.add('hl');
        return it;
      })]
      : [h('div', { class: 'pop-empty' }, '맞는 블록이 없어요')];
    // closePop 이 slash 를 지우지 않게 잠깐 빼둔다
    slash = null;
    const pop = openPop({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, content, { onClose: () => { if (slash === s) slash = null; } });
    slash = s;
    pop.style.width = '300px';
    pop.querySelector('.hl')?.scrollIntoView({ block: 'nearest' });
  }
  function closeSlash() {
    slash = null;
    closePop();
  }
  function applySlash(type) {
    const s = slash;
    const b = blocks[idx(s.id)];
    const el = textEl(s.id);
    const off = caretOffset(el) >= 0 ? caretOffset(el) : el.textContent.length;
    const r = rangeAt(el, s.start, Math.max(off, s.start + 1));
    r.deleteContents();
    syncFromDom(b);
    closeSlash();
    const empty = !el.textContent;
    if (type === 'divider') {
      if (empty) { b.type = 'divider'; b.text = ''; }
      else insertAfter(b.id, { id: uid(), type: 'divider', text: '' });
      const after = blocks[idx(b.id) + (empty ? 1 : 2)];
      const nb = after && after.type === 'p' && !after.text ? after : insertAfter(empty ? b.id : blocks[idx(b.id) + 1].id, { id: uid(), type: 'p', text: '' });
      render(); focus(nb.id); change();
      return;
    }
    let target = b;
    if (empty) { b.type = type; if (type === 'code') b.text = ''; }
    else target = insertAfter(b.id, { id: uid(), type, text: '' });
    render();
    focus(target.id, 'start');
    change();
  }

  // 모바일 툴바에서 쓰는 들여쓰기
  function indentById(id, d) {
    const b = blocks[idx(id)];
    const el = textEl(id);
    if (b && el) indentAndKeepCaret(b, el, d);
  }

  return { render, focus, indentById, undo, redo };
}

document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || !editor || !state.page || !location.hash.startsWith('#/p/')) return;
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k !== 'z' && k !== 'y') return;
  const t = e.target;
  // 제목·태그 같은 입력칸은 브라우저 기본 되돌리기를 쓴다
  if (t.closest?.('input, textarea, .page-title, .code-lang')) return;
  e.preventDefault();
  (k === 'y' || e.shiftKey ? editor.redo : editor.undo)();
});

// ---------- 모바일 편집 툴바 (Tab 키가 없어서) ----------
if (TOUCH) {
  const bar = h('div', { id: 'mobile-bar', hidden: true },
    h('button', { 'data-act': 'out', 'aria-label': '내어쓰기' }, '⇤'),
    h('button', { 'data-act': 'in', 'aria-label': '들여쓰기' }, '⇥'),
    h('button', { 'data-act': 'slash', 'aria-label': '블록 고르기' }, '/'),
    h('span', { style: 'flex:1' }),
    h('button', { 'data-act': 'done', 'aria-label': '키보드 닫기' }, '완료'));
  document.body.append(bar);
  const place = () => {
    const vv = window.visualViewport;
    if (vv) bar.style.top = `${vv.offsetTop + vv.height - bar.offsetHeight}px`;
  };
  window.visualViewport?.addEventListener('resize', place);
  window.visualViewport?.addEventListener('scroll', place);
  const currentText = () => document.activeElement?.closest?.('.blk-text');
  document.addEventListener('focusin', () => { bar.hidden = !currentText(); place(); });
  document.addEventListener('focusout', () => setTimeout(() => { bar.hidden = !currentText(); }, 50));
  bar.addEventListener('mousedown', (e) => e.preventDefault());
  bar.addEventListener('touchstart', (e) => { if (e.target.closest('button')) e.preventDefault(); }, { passive: false });
  const act = (btn) => {
    const el = currentText();
    if (!el || !editor) return;
    const id = el.closest('.blk')?.dataset.id;
    const a = btn.dataset.act;
    if (a === 'in' || a === 'out') editor.indentById(id, a === 'in' ? 1 : -1);
    if (a === 'slash') document.execCommand('insertText', false, '/');
    if (a === 'done') el.blur();
  };
  bar.addEventListener('click', (e) => { const btn = e.target.closest('button'); if (btn) act(btn); });
  bar.addEventListener('touchend', (e) => { const btn = e.target.closest('button'); if (btn) { e.preventDefault(); act(btn); } });
}

// ---------- 서식 툴바 ----------
const fmtBar = $('#fmt-bar');
function editableFromSelection() {
  const sel = getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return null;
  const node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
  const el = node?.closest('.blk-text');
  if (!el || el.getAttribute('contenteditable') !== 'true') return null;
  return el;
}
document.addEventListener('selectionchange', () => {
  const el = editableFromSelection();
  if (!el) { fmtBar.hidden = true; return; }
  const r = getSelection().getRangeAt(0).getBoundingClientRect();
  fmtBar.hidden = false;
  fmtBar.style.left = Math.max(8, Math.min(innerWidth - fmtBar.offsetWidth - 8, r.left + r.width / 2 - fmtBar.offsetWidth / 2)) + 'px';
  fmtBar.style.top = Math.max(8, r.top - fmtBar.offsetHeight - 8) + 'px';
});
const fireInput = (el) => el && el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'format' }));
function formatCode() {
  const el = editableFromSelection();
  if (!el) return;
  const r = getSelection().getRangeAt(0);
  const txt = r.toString();
  const parentCode = r.commonAncestorContainer.parentElement?.closest('code');
  if (parentCode) { parentCode.replaceWith(document.createTextNode(parentCode.textContent)); }
  else { r.deleteContents(); const c = h('code', {}, txt); r.insertNode(c); }
  fireInput(el);
}
function formatLink() {
  const el = editableFromSelection();
  if (!el) return;
  const url = prompt('링크 주소 (다른 페이지는 #/p/페이지ID)');
  if (url) { document.execCommand('createLink', false, url); fireInput(el); }
}
fmtBar.addEventListener('mousedown', (e) => e.preventDefault());
fmtBar.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const f = btn.dataset.fmt;
  const el = editableFromSelection();
  if (f === 'code') return formatCode();
  if (f === 'link') return formatLink();
  document.execCommand(f);
  fireInput(el);
});

// ---------- 주별 · 월별 회고 ----------
const pad2 = (n) => String(n).padStart(2, '0');
const DAY = 864e5;
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = t.getUTCFullYear();
  return { y, w: Math.ceil(((t - Date.UTC(y, 0, 1)) / DAY + 1) / 7) };
}
function weekMonday(y, w) {
  const jan4 = new Date(y, 0, 4);
  return new Date(y, 0, 4 - (jan4.getDay() || 7) + 1 + (w - 1) * 7);
}
const periodKey = (period, d) => {
  if (period === 'month') return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  const { y, w } = isoWeek(d);
  return `${y}-w${pad2(w)}`;
};
// 기간 정보: 시작·끝(끝은 포함 안 함)·이름
function periodInfo(period, key) {
  if (period === 'month') {
    const [y, m] = key.split('-').map(Number);
    const start = new Date(y, m - 1, 1), end = new Date(y, m, 1);
    return { start, end, label: `${y}년 ${m}월`, range: `${m}월 1일 – ${m}월 ${new Date(y, m, 0).getDate()}일` };
  }
  const [y, w] = key.split('-w').map(Number);
  const start = weekMonday(y, w), end = new Date(start.getTime() + 7 * DAY);
  const thu = new Date(start.getTime() + 3 * DAY);
  const last = new Date(end.getTime() - DAY);
  return {
    start, end,
    label: `${thu.getMonth() + 1}월 ${Math.ceil(thu.getDate() / 7)}주차`,
    range: `${start.getMonth() + 1}월 ${start.getDate()}일 – ${last.getMonth() + 1}월 ${last.getDate()}일`,
  };
}
const shiftKey = (period, key, delta) => {
  const { start } = periodInfo(period, key);
  const d = period === 'month' ? new Date(start.getFullYear(), start.getMonth() + delta, 1) : new Date(start.getTime() + delta * 7 * DAY + DAY);
  return periodKey(period, d);
};
const retroId = (period, key) => `retro-${key}`;
const ideasIn = (period, key) => {
  const { start, end } = periodInfo(period, key);
  return state.pages.filter((p) => !isRetro(p) && p.created && new Date(p.created) >= start && new Date(p.created) < end);
};

const RETRO_TEMPLATES = {
  week: [
    '<aside>🗓️ 이번 주를 5분만 돌아봐요. 다음 주에 가져갈 것 하나면 충분해요.</aside>',
    '## 👍 좋았던 것 (Keep)', '- ',
    '## 🤔 아쉬웠던 것 (Problem)', '- ',
    '## 🧪 다음 주에 해볼 것 (Try)', '- [ ] ',
    '## 한 줄 메모', '',
  ],
  month: [
    '<aside>📅 한 달을 돌아보고, 다음 달에 가져갈 것 하나만 정해요.</aside>',
    '## 🌟 이번 달 잘한 것', '- ',
    '## 🌧️ 아쉬웠던 것', '- ',
    '## 💡 배운 것', '- ',
    '## 🙌 고마운 사람', '- ',
    '## 🎯 다음 달 목표', '- [ ] ',
    '## 한 줄 평', '',
  ],
};

async function startRetro(period, key) {
  const id = retroId(period, key);
  if (!byId(id)) {
    const info = periodInfo(period, key);
    const meta = { kind: 'retro', period, key, icon: period === 'month' ? '📅' : '🗓️', title: `${info.label} 회고`, tags: [] };
    const res = await api.save(id, meta, RETRO_TEMPLATES[period].join('\n\n'));
    upsertListEntry({ id, ...res.meta, preview: '' });
    refreshGit();
  }
  location.hash = `#/p/${id}`;
}

function scoreStars(meta, onSet) {
  const wrap = h('span', { class: 'stars', title: onSet ? '이 기간 점수' : null });
  for (let i = 1; i <= 5; i++) {
    wrap.append(h(onSet ? 'button' : 'span', { class: `star ${i <= (meta.score || 0) ? 'on' : ''}`, onclick: onSet ? () => onSet(meta.score === i ? 0 : i) : null }, '★'));
  }
  return wrap;
}

function ideaChips(list) {
  if (!list.length) return h('span', { class: 'prop-muted' }, '이 기간에 만든 아이디어가 없어요');
  return list.map((p) => h('a', { class: 'idea-chip', href: `#/p/${p.id}` }, `${p.icon || statusOf(p.status).icon} ${p.title || '제목 없음'}`));
}

function renderRetroProps(meta) {
  const info = periodInfo(meta.period, meta.key);
  const scoreV = h('div', { class: 'prop-v' });
  const drawScore = () => { scoreV.innerHTML = ''; scoreV.append(scoreStars(meta, (n) => { meta.score = n || null; drawScore(); savePage(); })); };
  drawScore();
  const ideas = ideasIn(meta.period, meta.key);
  const props = h('div', { class: 'props' },
    h('div', { class: 'prop-k' }, '◷ 기간'), h('div', { class: 'prop-v' }, `${info.label}`, h('span', { class: 'prop-muted' }, info.range)),
    h('div', { class: 'prop-k' }, '★ 점수'), scoreV,
    h('div', { class: 'prop-k' }, `💡 아이디어 ${ideas.length}`), h('div', { class: 'prop-v' }, ideaChips(ideas)),
  );
  if (meta.period === 'month') {
    const weeks = state.pages.filter((p) => isRetro(p) && p.period === 'week' && (() => {
      const wi = periodInfo('week', p.key); const mi = periodInfo('month', meta.key);
      const thu = new Date(wi.start.getTime() + 3 * DAY);
      return thu >= mi.start && thu < mi.end;
    })()).sort((a, b) => a.key.localeCompare(b.key));
    props.append(h('div', { class: 'prop-k' }, '🗓️ 주간 회고'),
      h('div', { class: 'prop-v' }, weeks.length ? weeks.map((w) => h('a', { class: 'idea-chip', href: `#/p/${w.id}` }, periodInfo('week', w.key).label, w.score ? ` · ${'★'.repeat(w.score)}` : '')) : h('span', { class: 'prop-muted' }, '이 달에 쓴 주간 회고가 없어요')));
  }
  return props;
}

const retroCursor = { week: periodKey('week', new Date()), month: periodKey('month', new Date()) };

function renderRetro(period) {
  state.page = null;
  $('#page-more').hidden = true;
  setSaveText('');
  renderCrumbs();
  const view = $('#view');
  view.innerHTML = '';
  const key = retroCursor[period];
  const info = periodInfo(period, key);
  const nowKey = periodKey(period, new Date());
  const existing = byId(retroId(period, key));
  const ideas = ideasIn(period, key);
  const go = (d) => { retroCursor[period] = shiftKey(period, key, d); renderRetro(period); };

  const counts = STATUSES.map((s) => ({ s, n: ideas.filter((p) => (p.status || 'spark') === s.key).length }));
  const current = h('div', { class: 'retro-current' },
    h('div', { class: 'retro-nav' },
      h('button', { class: 'icon-btn', title: period === 'month' ? '지난달' : '지난주', onclick: () => go(-1) }, '‹'),
      h('div', { class: 'retro-period' }, h('div', { class: 'rp-label' }, info.label, key === nowKey ? h('span', { class: 'now-badge' }, period === 'month' ? '이번 달' : '이번 주') : null), h('div', { class: 'rp-range' }, info.range)),
      h('button', { class: 'icon-btn', title: period === 'month' ? '다음 달' : '다음 주', onclick: () => go(1) }, '›'),
      key !== nowKey ? h('button', { class: 'chip', onclick: () => { retroCursor[period] = nowKey; renderRetro(period); } }, period === 'month' ? '이번 달로' : '이번 주로') : null,
    ),
    h('div', { class: 'retro-stats' },
      h('div', { class: 'stat' }, h('div', { class: 'stat-n' }, String(ideas.length)), h('div', { class: 'stat-k' }, '새 아이디어')),
      counts.map(({ s, n }) => h('div', { class: 'stat' }, h('div', { class: 'stat-n' }, String(n)), h('div', { class: 'stat-k' }, `${s.icon} ${s.label}`))),
    ),
    ideas.length ? h('div', { class: 'retro-ideas' }, ideaChips(ideas)) : null,
    existing
      ? h('a', { class: 'retro-open', href: `#/p/${existing.id}` },
        h('div', {}, h('div', { class: 'card-title' }, h('span', {}, existing.icon || '🗓️'), h('span', {}, existing.title)), existing.preview ? h('div', { class: 'card-prev' }, existing.preview) : null),
        h('div', { class: 'retro-open-right' }, existing.score ? scoreStars(existing) : null, h('span', { class: 'btn' }, '이어 쓰기')))
      : h('button', { class: 'retro-start', onclick: () => startRetro(period, key) },
        h('span', { style: 'font-size:22px' }, period === 'month' ? '📅' : '🗓️'),
        h('span', {}, h('b', {}, `${info.label} 회고 쓰기`), h('div', { class: 'pi-sub' }, period === 'month' ? '잘한 것 · 아쉬운 것 · 배운 것 · 다음 달 목표' : 'Keep · Problem · Try 로 5분 정리'))),
  );

  const past = state.pages.filter((p) => isRetro(p) && p.period === period).sort((a, b) => b.key.localeCompare(a.key));
  const list = h('div', { class: 'retro-list' },
    past.length ? past.map((p) => {
      const pi = periodInfo(period, p.key);
      return h('a', { class: 'card retro-card', href: `#/p/${p.id}` },
        h('div', { class: 'retro-card-head' }, h('b', {}, pi.label), h('span', { class: 'prop-muted' }, pi.range), h('span', { style: 'flex:1' }), p.score ? scoreStars(p) : null),
        p.preview ? h('div', { class: 'card-prev' }, p.preview) : null);
    }) : h('div', { class: 'col-empty' }, '아직 쓴 회고가 없어요'));

  view.append(h('div', { class: 'board-page retro-page' },
    h('div', { style: 'font-size:48px;line-height:1' }, '🗓️'),
    h('h1', { class: 'board-title' }, '회고'),
    h('p', { class: 'board-desc' }, '한 주, 한 달을 짧게 돌아보고 다음에 해볼 것 하나를 정해요.'),
    h('div', { class: 'tabs' },
      h('a', { class: `tab ${period === 'week' ? 'on' : ''}`, href: '#/retro/week' }, '주별'),
      h('a', { class: `tab ${period === 'month' ? 'on' : ''}`, href: '#/retro/month' }, '월별')),
    current,
    h('h3', { class: 'section-title' }, `지난 ${period === 'month' ? '월별' : '주별'} 회고`),
    list,
  ));
}

// ---------- 보드 칸 (메인 보드·폴더 공용) ----------
function boardColumns(pages, { parent = null, group } = {}) {
  const cols = h('div', { class: 'columns' });
  for (const s of STATUSES) {
    const items = pages.filter((p) => (p.status || 'spark') === s.key)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(b.created).localeCompare(String(a.created)));
    const col = h('div', { class: 'col', 'data-status': s.key },
      h('div', { class: 'col-head' }, statusPill(s.key), h('span', { class: 'count' }, String(items.length)),
        h('button', { class: 'icon-btn sm add', title: '새 카드', onclick: () => createPage({ status: s.key, parent }) }, '＋')));
    if (!items.length) col.append(h('div', { class: 'col-empty' }, s.key === 'spark' && group === undefined ? '위 입력칸에 아무거나 적어보세요' : TOUCH ? '아직 없어요' : '카드를 여기로 끌어오세요'));
    items.forEach((p) => col.append(boardCard(p)));
    bindColumnDrop(col, s.key, group);
    cols.append(col);
  }
  return cols;
}

// 메인 보드를 「폴더 밖」 + 폴더별 줄로 나눈다 (노션 하위 그룹처럼). 접힘 상태는 이 브라우저에 기억
const collapsed = store.get('board-collapsed', {});
const groupKey = (fid) => fid || 'root';
function boardGroupList(pages) {
  const groups = new Map([[null, []]]);
  for (const p of pages) {
    const f = folderOf(p)?.id || null;
    if (!groups.has(f)) groups.set(f, []);
    groups.get(f).push(p);
  }
  const folders = [...groups.keys()].filter(Boolean).map(byId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.created).localeCompare(String(b.created)));
  return [{ folder: null, pages: groups.get(null) }, ...folders.map((f) => ({ folder: f, pages: groups.get(f.id) }))];
}
function folderGroupsToggle(pages) {
  const groups = boardGroupList(pages);
  if (groups.length < 2) return null;
  const allClosed = groups.every((g) => collapsed[groupKey(g.folder?.id)]);
  return h('button', { class: 'btn ghost', onclick: () => {
    groups.forEach((g) => { collapsed[groupKey(g.folder?.id)] = !allClosed; });
    store.set('board-collapsed', collapsed);
    renderBoard();
  } }, allClosed ? '⊞ 모두 펼치기' : '⊟ 모두 접기');
}
function boardGroups(pages) {
  const groups = boardGroupList(pages);
  // 폴더가 하나도 없으면 예전처럼 칸만
  if (groups.length < 2) return boardColumns(pages, {});
  const wrap = h('div', { class: 'board-groups' });
  for (const { folder, pages: list } of groups) {
    const key = groupKey(folder?.id);
    const closed = !!collapsed[key];
    const counts = STATUSES.map((s) => list.filter((p) => (p.status || 'spark') === s.key).length);
    const head = h('div', { class: 'group-head' },
      h('button', { class: `group-toggle ${closed ? '' : 'open'}`, 'aria-expanded': String(!closed), onclick: () => {
        collapsed[key] = !closed;
        store.set('board-collapsed', collapsed);
        renderBoard();
      } },
        h('span', { class: 'caret' }, '▶'),
        h('span', {}, folder ? (folder.icon || '📁') : '📄'),
        h('span', { class: 'group-name' }, folder ? (folder.title || '제목 없는 폴더') : '폴더 밖'),
        h('span', { class: 'count' }, String(list.length))),
      closed ? h('span', { class: 'group-mini' }, STATUSES.map((s, i) => counts[i] ? h('span', {}, `${s.icon} ${counts[i]}`) : null)) : null,
      h('span', { style: 'flex:1' }),
      folder ? h('a', { class: 'group-open', href: `#/p/${folder.id}` }, '폴더 열기 →') : null);
    wrap.append(h('section', { class: `group ${closed ? 'closed' : ''}` }, head,
      closed ? null : boardColumns(list, { parent: folder?.id || null, group: folder?.id || null })));
  }
  return wrap;
}

// ---------- 폴더 (노션 데이터베이스처럼 하위 문서를 보드·갤러리·목록으로) ----------
const FOLDER_VIEWS = [
  { key: 'board', label: '보드', icon: '▥' },
  { key: 'gallery', label: '갤러리', icon: '▦' },
  { key: 'list', label: '목록', icon: '☰' },
];
function folderCollection(folder) {
  const wrap = h('div', { class: 'folder-coll' });
  const draw = () => {
    refreshView = draw;
    const meta = state.page && state.page.id === folder.id ? state.page.meta : folder.meta;
    const view = meta.view || 'board';
    const kids = childrenOf(folder.id).filter((p) => !isRetro(p));
    const docs = kids.filter((p) => !isFolder(p));
    const subFolders = kids.filter(isFolder);
    wrap.innerHTML = '';

    const input = h('input', { placeholder: '이 폴더에 바로 적고 Enter', autocomplete: 'off', enterkeyhint: 'done' });
    const add = async (e) => {
      e.preventDefault();
      const title = input.value.trim();
      if (!title) return;
      input.value = '';
      const p = createPage({ title, parent: folder.id, go: false, top: true });
      draw();
      $('.folder-coll .capture input')?.focus();
      await p;
    };
    wrap.append(
      h('div', { class: 'folder-bar' },
        h('div', { class: 'tabs view-tabs' }, FOLDER_VIEWS.map((v) => h('button', { class: `tab ${view === v.key ? 'on' : ''}`, onclick: () => { meta.view = v.key; savePage(); draw(); } }, `${v.icon} ${v.label}`))),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn ghost', onclick: () => createFolder(folder.id) }, '📁 하위 폴더'),
        h('button', { class: 'btn', onclick: () => createPage({ parent: folder.id }) }, '＋ 새 문서')),
      h('form', { class: 'capture', onsubmit: add }, h('span', {}, '💡'), input, h('span', { class: 'hint' }, 'Enter로 추가')),
    );
    if (subFolders.length) {
      wrap.append(h('div', { class: 'folder-subs' }, subFolders.map((f) => h('a', { class: 'folder-chip', href: `#/p/${f.id}` },
        h('span', {}, f.icon || '📁'), h('span', {}, f.title || '제목 없는 폴더'), h('span', { class: 'count' }, String(childrenOf(f.id).length))))));
    }
    if (view === 'board') wrap.append(boardColumns(docs, { parent: folder.id }));
    else if (!docs.length) wrap.append(h('div', { class: 'col-empty' }, '아직 문서가 없어요. 위 입력칸에 적거나 「＋ 새 문서」를 눌러보세요'));
    else if (view === 'gallery') {
      const sorted = [...docs].sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));
      wrap.append(h('div', { class: 'gallery' }, sorted.map((p) => {
        const c = boardCard(p);
        c.classList.add('gallery-card');
        c.insertBefore(h('div', { class: 'gallery-meta' }, statusPill(p.status)), c.firstChild.nextSibling);
        return c;
      })));
    } else {
      const sorted = [...docs].sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));
      wrap.append(h('div', { class: 'doc-list' },
        h('div', { class: 'doc-row head' }, h('span', {}, '이름'), h('span', {}, '상태'), h('span', { class: 'hide-sm' }, '태그'), h('span', { class: 'hide-sm' }, '고친 날')),
        sorted.map((p) => h('a', { class: 'doc-row', href: `#/p/${p.id}` },
          h('span', { class: 'doc-name' }, h('span', {}, p.icon || '📄'), h('span', {}, p.title || '제목 없음')),
          h('span', {}, statusPill(p.status)),
          h('span', { class: 'hide-sm doc-tags' }, (p.tags || []).map((t) => { const c = tagColor(t); return h('span', { class: 'tag', style: `background:var(--c-${c});color:var(--c-${c}-t)` }, t); })),
          h('span', { class: 'hide-sm prop-muted' }, p.updated ? fmtDate(p.updated).replace(/^\d+년 /, '') : '')))));
    }
  };
  draw();
  return wrap;
}

// 폴더로 옮기기
function moveToFolderMenu(anchor, id) {
  const me = byId(id) || { id };
  const isDesc = (f) => { let cur = f; const seen = new Set(); while (cur && !seen.has(cur.id)) { if (cur.id === id) return true; seen.add(cur.id); cur = cur.parent ? byId(cur.parent) : null; } return false; };
  const targets = state.pages.filter((p) => isFolder(p) && !isDesc(p));
  const go = async (parent) => {
    closePop();
    const order = Math.min(0, ...state.pages.map((x) => x.order ?? 0)) - 1;
    if (state.page?.id === id) { state.page.meta.parent = parent; state.page.meta.order = order; savePage.flush(); }
    else await saveMeta(id, { parent, order });
    upsertListEntry({ id, parent, order });
    if (parent) { state.expanded[parent] = true; store.set('expanded', state.expanded); }
    renderTree(); renderCrumbs();
    toast(parent ? `「${byId(parent).title || '폴더'}」로 옮겼어요` : '맨 위로 옮겼어요');
  };
  openPop(anchor, [
    h('div', { class: 'pop-label' }, '어디로 옮길까요?'),
    me.parent ? menuItem({ compact: true, icon: '⤒', label: '맨 위 (폴더 밖)', onclick: () => go(null) }) : null,
    ...targets.map((f) => menuItem({ compact: true, icon: f.icon || '📁', label: f.title || '제목 없는 폴더', onclick: () => go(f.id) })),
    targets.length ? null : h('div', { class: 'pop-empty' }, '폴더가 없어요. 사이드바에서 「📁 새 폴더」로 만들어요'),
  ]);
}

// ---------- 아이디어 보드 ----------
function renderBoard() {
  state.page = null;
  $('#page-more').hidden = true;
  setSaveText('');
  renderCrumbs();
  const view = $('#view');
  view.innerHTML = '';

  refreshView = renderBoard;
  const boardPages = state.pages.filter((p) => !isRetro(p) && !isFolder(p));
  const allTags = [...new Set(boardPages.flatMap((p) => p.tags || []))].sort();
  const visible = boardPages.filter((p) => !state.tagFilter || (p.tags || []).includes(state.tagFilter));

  const input = h('input', { placeholder: '떠오르는 걸 적고 Enter', autocomplete: 'off', enterkeyhint: 'done' });
  const addIdea = async (e) => {
    e.preventDefault();
    if (!input.value.trim()) return;
    const title = input.value.trim();
    input.value = '';
    const p = createPage({ title, status: 'spark', tags: state.tagFilter ? [state.tagFilter] : [], go: false, top: true });
    renderBoard();
    $('.capture input').focus();
    await p;
  };

  const page = h('div', { class: 'board-page' },
    h('div', { class: 'board-head' },
      h('div', {},
        h('div', { style: 'font-size:48px;line-height:1' }, '📋'),
        h('h1', { class: 'board-title' }, '아이디어 보드'),
        h('p', { class: 'board-desc' }, TOUCH ? '일단 많이 꺼내고, 나중에 고르기. 카드 오른쪽 위 버튼으로 상태를 옮겨요.' : '일단 많이 꺼내고, 나중에 고르기. 카드를 끌어서 상태를 옮겨요.')),
    ),
    h('form', { class: 'capture', onsubmit: addIdea }, h('span', {}, '💡'), input, h('span', { class: 'hint' }, 'Enter로 추가')),
    h('div', { class: 'toolbar' },
      h('button', { class: `chip ${!state.tagFilter ? 'on' : ''}`, onclick: () => { state.tagFilter = null; renderBoard(); } }, '전체'),
      allTags.map((t) => h('button', { class: `chip ${state.tagFilter === t ? 'on' : ''}`, onclick: () => { state.tagFilter = state.tagFilter === t ? null : t; renderBoard(); } }, `# ${t}`)),
      h('span', { class: 'spacer' }),
      folderGroupsToggle(visible),
      h('button', { class: 'btn ghost', onclick: openShuffle }, '🎲 섞어보기'),
    ),
  );

  page.append(boardGroups(visible));
  view.append(page);
}

function boardCard(p, opts = {}) {
  const card = h(opts.static ? 'div' : 'a', { class: 'card', href: opts.static ? null : `#/p/${p.id}`, draggable: opts.static ? null : 'true', 'data-id': p.id },
    h('div', { class: 'card-title' }, h('span', {}, p.icon || '📄'), h('span', {}, p.title || '제목 없음')),
    p.preview ? h('div', { class: 'card-prev' }, p.preview) : null,
    p.tags?.length ? h('div', { class: 'card-tags' }, p.tags.map((t) => { const c = tagColor(t); return h('span', { class: 'tag', style: `background:var(--c-${c});color:var(--c-${c}-t)` }, t); })) : null,
  );
  if (!opts.static) {
    const sb = h('button', { class: 'card-status', title: '상태 바꾸기', 'aria-label': '상태 바꾸기', onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPop(sb, STATUSES.map((s) => menuItem({
        compact: true, icon: s.icon, label: s.label,
        onclick: async () => {
          closePop();
          if ((p.status || 'spark') === s.key) return;
          const order = Math.min(0, ...state.pages.map((x) => x.order ?? 0)) - 1;
          Object.assign(byId(p.id), { status: s.key, order });
          refreshView();
          await saveMeta(p.id, { status: s.key, order });
        },
      })));
    } }, '⇄');
    card.append(sb);
    card.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-card', p.id); card.classList.add('dragging'); });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  }
  return card;
}

// group: 메인 보드의 폴더 줄 (undefined 면 폴더 구분 없음, null 이면 「폴더 밖」)
function bindColumnDrop(col, statusKey, group) {
  col.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/x-card')) { e.preventDefault(); col.classList.add('over'); } });
  col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('over'); });
  col.addEventListener('drop', async (e) => {
    const id = e.dataTransfer.getData('text/x-card');
    col.classList.remove('over');
    if (!id) return;
    e.preventDefault();
    const cards = [...col.querySelectorAll('.card')].filter((c) => c.dataset.id !== id);
    const after = cards.find((c) => e.clientY < c.getBoundingClientRect().top + c.offsetHeight / 2);
    const orderOf = (c) => byId(c.dataset.id)?.order ?? 0;
    let order;
    if (!cards.length) order = 1;
    else if (!after) order = orderOf(cards[cards.length - 1]) + 1;
    else {
      const i = cards.indexOf(after);
      order = i === 0 ? orderOf(after) - 1 : (orderOf(cards[i - 1]) + orderOf(after)) / 2;
    }
    const p = byId(id);
    const patch = { status: statusKey, order };
    if (group !== undefined && (folderOf(p)?.id || null) !== group) patch.parent = group;
    Object.assign(p, patch);
    if (patch.parent) { state.expanded[patch.parent] = true; store.set('expanded', state.expanded); }
    refreshView();
    if (patch.parent !== undefined) renderTree();
    await saveMeta(id, patch);
  });
}

// 🎲 섞어보기 — 무작위 두 아이디어 + 발상 질문
function openShuffle() {
  const pool = state.pages.filter((p) => p.title && !isRetro(p) && !isFolder(p));
  if (pool.length < 2) { toast('아이디어가 두 개 이상 있어야 섞을 수 있어요'); return; }
  const scrim = h('div', { class: 'modal-scrim', onclick: (e) => { if (e.target === scrim) scrim.remove(); } });
  const modal = h('div', { class: 'modal' });
  scrim.append(modal);
  const esc = (e) => { if (e.key === 'Escape') { scrim.remove(); document.removeEventListener('keydown', esc); } };
  document.addEventListener('keydown', esc);

  const draw = () => {
    const a = pool[Math.floor(Math.random() * pool.length)];
    let b;
    do { b = pool[Math.floor(Math.random() * pool.length)]; } while (b.id === a.id);
    const pr = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    modal.innerHTML = '';
    modal.append(
      h('h3', {}, '🎲 섞어보기'),
      h('p', { class: 'sub' }, '상관없어 보이는 두 아이디어를 붙여서 새 생각을 꺼내요.'),
      h('div', { class: 'mix' }, boardCard(a, { static: true }), h('span', { class: 'x' }, '×'), boardCard(b, { static: true })),
      h('div', { class: 'prompt-box' }, h('span', {}, '🤔'), h('span', {}, h('b', {}, `[${pr.tag}] `), pr.text)),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn ghost', onclick: draw }, '다시 섞기'),
        h('button', { class: 'btn', onclick: async () => {
          scrim.remove();
          document.removeEventListener('keydown', esc);
          const body = [
            `<aside>🤔 [${pr.tag}] ${pr.text}</aside>`,
            '',
            `- 🔗 [${a.icon || '📄'} ${a.title}](#/p/${a.id})`,
            `- 🔗 [${b.icon || '📄'} ${b.title}](#/p/${b.id})`,
            '',
            '## 떠오른 생각',
            '',
            '- ',
          ].join('\n');
          await createPage({ title: `${a.title} × ${b.title}`, status: 'spark', body });
        } }, '이 조합으로 새 아이디어'),
      ),
    );
  };
  draw();
  document.body.append(scrim);
}

// ---------- 시작 ----------
function renderConnect(error) {
  $('#page-more').hidden = true;
  $('#crumbs').innerHTML = '';
  const view = $('#view');
  view.innerHTML = '';
  const input = h('input', { class: 'pop-input', type: 'password', placeholder: 'github_pat_… 또는 ghp_…', autocomplete: 'off', style: 'font-size:15px;padding:10px 12px' });
  const msg = h('div', { class: 'pi-sub', style: 'color:var(--danger);min-height:18px' }, error || '');
  const go = async () => {
    const t = input.value.trim();
    if (!t) return;
    msg.textContent = '확인하는 중…';
    if (await ghApi.check(t)) { ghApi.setToken(t); location.reload(); }
    else msg.textContent = `이 토큰으로는 ${GH.repo} 에 쓸 수 없어요. 저장소 권한(Contents: Read and write)을 확인해 주세요.`;
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  view.append(h('div', { class: 'page', style: 'max-width:560px' },
    h('div', { style: 'font-size:56px;line-height:1' }, '💡'),
    h('h1', { class: 'page-title' }, 'GitHub 연결'),
    h('p', { style: 'color:var(--text-2);margin:0 0 20px' }, `아이디어와 회고는 GitHub 비공개 저장소 ${GH.repo} 에 저장돼요. 이 브라우저에서 처음 한 번만 토큰을 넣어주세요.`),
    h('ol', { style: 'color:var(--text-2);font-size:14.5px;padding-left:20px;margin:0 0 20px;line-height:1.8' },
      h('li', {}, h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, 'jamie-pd 계정에서 새 토큰 만들기'), ' (Fine-grained)'),
      h('li', {}, 'Repository access → Only select repositories → idea-note'),
      h('li', {}, 'Permissions → Contents → Read and write'),
      h('li', {}, '만든 토큰을 아래에 붙여넣기')),
    input, msg,
    h('div', { style: 'margin-top:12px' }, h('button', { class: 'btn', style: 'padding:8px 16px;font-size:14.5px', onclick: go }, '연결하기')),
    h('p', { class: 'pi-sub', style: 'margin-top:20px' }, '토큰은 이 브라우저에만 저장되고 GitHub 말고 다른 곳으로 보내지 않아요.'),
  ));
}

(async function init() {
  if (!LOCAL && !ghApi.hasToken()) { renderConnect(); return; }
  try { state.pages = await api.list(); }
  catch (e) {
    if (!LOCAL && (e.status === 401 || e.status === 404)) { ghApi.logout(); renderConnect('토큰이 만료됐거나 저장소에 접근할 수 없어요. 다시 넣어주세요.'); return; }
    throw e;
  }
  await route();
  refreshGit.flush();
  setInterval(() => refreshGit(), 15000);
})();
