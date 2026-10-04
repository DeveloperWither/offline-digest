/* Offline Digest & Search — zero-dependency offline reader */
'use strict';

const CATEGORIES = ['All', 'World News', 'AI News', 'History & Conflicts', 'Tech'];
const CATEGORY_KEYS = { 'World News': 'world', 'AI News': 'ai', 'History & Conflicts': 'history', 'Tech': 'tech' };
const CATEGORY_HINTS = [
  ['AI News', /\b(ai|a\.i\.|artificial intelligence|machine learning|deep learning|llms?|neural|gpt|chatbots?|openai|anthropic|deepmind|transformers?|language models?)\b/i],
  ['World News', /\b(ceasefire|truce|missiles?|air ?strikes?|drones?|sanctions|troops|president|prime minister|election|nato|united nations)\b/i],
  ['History & Conflicts', /\b(history|historical|historians?|wars?|battles?|empires?|conflicts?|treaty|revolution|siege|dynasty|ancient|medieval|military|invasion)\b/i],
];
const DB_NAME = 'offline-digest';
const STORE = 'articles';
const SEED_URL = 'articles.json';
const WORDS_PER_MINUTE = 230;
const FONT = { min: 14, max: 28, step: 2, def: 18 };

const $ = (sel) => document.querySelector(sel);
const els = {
  listView: $('#list-view'),
  readerView: $('#reader-view'),
  search: $('#search'),
  clearSearch: $('#clear-search'),
  tabs: $('#tabs'),
  list: $('#article-list'),
  info: $('#result-info'),
  empty: $('#empty'),
  reader: $('#reader'),
  back: $('#back-btn'),
  fontDown: $('#font-down'),
  fontUp: $('#font-up'),
  progress: $('#progress-bar'),
  net: $('#net-status'),
  importBtn: $('#import-btn'),
  dialog: $('#import-dialog'),
  fileInput: $('#file-input'),
  syncUrl: $('#sync-url'),
  syncBtn: $('#sync-btn'),
  syncDefault: $('#sync-default'),
  paste: $('#paste-input'),
  pasteBtn: $('#paste-btn'),
  resetBtn: $('#reset-btn'),
  libStats: $('#lib-stats'),
  status: $('#import-status'),
  toast: $('#toast'),
  toastMsg: $('#toast-msg'),
  toastAction: $('#toast-action'),
};

const state = {
  articles: [],
  byId: new Map(),
  index: null,
  category: 'All',
  query: '',
  fontSize: FONT.def,
  listScroll: 0,
  openedFromList: false,
};

/* ---------- Small utilities ---------- */

const prefs = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('od:' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('od:' + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clean = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/\s+/g, ' ').trim() : '');
const countWords = (s) => (s.match(/\S+/g) || []).length;
const readMinutes = (a) => Math.max(1, Math.round(a.words / WORDS_PER_MINUTE));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function safeUrl(v) {
  const s = clean(v);
  if (!s) return '';
  try {
    const u = new URL(s, location.href);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch { return ''; }
}

function toISODate(v) {
  const s = clean(v);
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d) ? '' : d.toISOString();
}

const dateFmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const formatDate = (iso) => (iso ? dateFmt.format(new Date(iso)) : '');

/* ---------- IndexedDB (with in-memory fallback) ---------- */

const store = {
  db: null,
  ok: true,
  memory: new Map(),

  async open() {
    if (!('indexedDB' in window)) { this.ok = false; return; }
    try {
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('IndexedDB blocked'));
      });
    } catch (err) {
      console.warn('IndexedDB unavailable, using memory only:', err);
      this.ok = false;
    }
  },

  run(mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  },

  async all() {
    if (!this.ok) return [...this.memory.values()];
    return this.run('readonly', (s) => s.getAll());
  },

  async putMany(items) {
    if (!this.ok) { items.forEach((a) => this.memory.set(a.id, a)); return; }
    await this.run('readwrite', (s) => { items.forEach((a) => s.put(a)); });
  },

  async clear() {
    if (!this.ok) { this.memory.clear(); return; }
    await this.run('readwrite', (s) => { s.clear(); });
  },
};

/* ---------- Import parsing (JSON, JSON Feed, RSS, Atom) ---------- */

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, noscript, iframe, svg').forEach((n) => n.remove());
  doc.querySelectorAll('br').forEach((n) => n.replaceWith('\n'));
  doc.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, blockquote, pre, tr, section, article, figure')
    .forEach((n) => n.append('\n\n'));
  return (doc.body.textContent || '')
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function guessCategory(text) {
  for (const [cat, re] of CATEGORY_HINTS) if (re.test(text)) return cat;
  return 'Tech';
}

function normalize(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const title = clean(raw.title);
  let body = raw.body ?? raw.content_text ?? raw.content ?? raw.content_html ?? raw.description ?? raw.summary ?? '';
  if (Array.isArray(body)) body = body.join('\n\n');
  body = typeof body === 'string' ? body : '';
  if (/<[a-z][\s\S]*>/i.test(body)) body = htmlToText(body);
  body = body.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!title && !body) return null;

  let tags = raw.tags ?? raw.categories ?? raw.keywords ?? [];
  if (typeof tags === 'string') tags = tags.split(',');
  tags = Array.isArray(tags) ? tags.map(clean).filter(Boolean) : [];
  const rawCat = clean(raw.category);
  if (rawCat && !CATEGORY_KEYS[rawCat]) tags.push(rawCat);
  tags = [...new Set(tags)].slice(0, 12);

  const url = safeUrl(raw.url ?? raw.link ?? raw.external_url);
  const date = toISODate(raw.date ?? raw.published ?? raw.date_published ?? raw.pubDate ?? raw.updated);
  const category = CATEGORY_KEYS[rawCat]
    ? rawCat
    : guessCategory(`${title} ${tags.join(' ')} ${body.slice(0, 500)}`);
  const id = clean(raw.id ?? raw.guid) || url || 'a-' + hash(`${title}|${date}|${body.slice(0, 300)}`);

  return {
    id,
    title: title || body.slice(0, 80) + '…',
    category,
    tags,
    author: clean(raw.author?.name ?? raw.author),
    source: clean(raw.source),
    date,
    url,
    body,
    words: countWords(body),
    importedAt: Number(raw.importedAt) || Date.now(),
  };
}

function xmlChild(el, name) {
  for (const c of el.children) if (c.localName === name) return c.textContent.trim();
  return '';
}

function xmlLink(el) {
  for (const c of el.children) {
    if (c.localName !== 'link') continue;
    const href = c.getAttribute('href');
    const rel = c.getAttribute('rel');
    if (href && (!rel || rel === 'alternate')) return href;
    if (!href && c.textContent.trim()) return c.textContent.trim();
  }
  return '';
}

function parseFeed(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Could not parse that XML feed.');
  const channel = doc.querySelector('channel, feed');
  const feedTitle = channel ? xmlChild(channel, 'title') : '';

  return [...doc.querySelectorAll('item, entry')].map((el) => normalize({
    title: xmlChild(el, 'title'),
    id: xmlChild(el, 'guid') || xmlChild(el, 'id'),
    url: xmlLink(el),
    date: xmlChild(el, 'pubDate') || xmlChild(el, 'published') || xmlChild(el, 'updated') || xmlChild(el, 'date'),
    author: xmlChild(el, 'creator') || xmlChild(el, 'author'),
    body: xmlChild(el, 'encoded') || xmlChild(el, 'content') || xmlChild(el, 'description') || xmlChild(el, 'summary'),
    tags: [...el.children].filter((c) => c.localName === 'category').map((c) => c.getAttribute('term') || c.textContent),
    source: feedTitle,
  })).filter(Boolean);
}

function parsePayload(text) {
  const t = String(text).replace(/^﻿/, '').trim();
  if (!t) throw new Error('Nothing to import.');

  let items;
  if (t.startsWith('<')) {
    items = parseFeed(t);
  } else {
    let data;
    try { data = JSON.parse(t); } catch { throw new Error('That is not valid JSON or RSS/Atom XML.'); }
    const list = Array.isArray(data) ? data
      : Array.isArray(data?.articles) ? data.articles
      : Array.isArray(data?.items) ? data.items
      : [data];
    items = list.map((raw) => normalize(raw)).filter(Boolean);
  }
  if (!items.length) throw new Error('No articles found in that data.');
  return items;
}

/* ---------- Search index ---------- */

function tokenize(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]+/g) || [];
}

// Inverted index: token -> Map(articleIndex -> weighted score).
// Keys are kept sorted so prefix lookups ("trans" -> "transformer") are a binary search.
function buildIndex(articles) {
  const map = new Map();
  articles.forEach((a, i) => {
    const add = (text, weight) => {
      for (const tok of tokenize(text)) {
        let postings = map.get(tok);
        if (!postings) map.set(tok, (postings = new Map()));
        postings.set(i, (postings.get(i) || 0) + weight);
      }
    };
    add(a.title, 10);
    add(a.tags.join(' '), 6);
    add(a.category, 4);
    add(`${a.author} ${a.source}`, 2);
    add(a.body, 1);
  });
  return { map, keys: [...map.keys()].sort() };
}

function lowerBound(arr, target) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < target) lo = mid + 1; else hi = mid;
  }
  return lo;
}

function matchTerm(term) {
  const { map, keys } = state.index;
  const scores = new Map();
  for (let k = lowerBound(keys, term); k < keys.length && keys[k].startsWith(term); k++) {
    const factor = keys[k] === term ? 1 : 0.6;
    for (const [i, s] of map.get(keys[k])) scores.set(i, Math.max(scores.get(i) || 0, s * factor));
  }
  return scores;
}

// All query terms must match (AND); results ranked by summed field-weighted score.
function search(query) {
  const terms = [...new Set(tokenize(query))];
  if (!terms.length || !state.index) return null;
  let combined = null;
  for (const term of terms) {
    const scores = matchTerm(term);
    if (!combined) { combined = scores; continue; }
    const next = new Map();
    for (const [i, s] of combined) if (scores.has(i)) next.set(i, s + scores.get(i));
    combined = next;
    if (!combined.size) break;
  }
  return [...combined]
    .sort((a, b) => b[1] - a[1])
    .map(([i]) => state.articles[i]);
}

function highlightRegex(query) {
  const terms = [...new Set(tokenize(query))].sort((a, b) => b.length - a.length);
  return terms.length ? new RegExp(`\\b(?:${terms.map(escRe).join('|')})[a-z0-9]*`, 'gi') : null;
}

// Escapes text and wraps matches in <mark>, working on raw text so entities are never split.
function highlight(text, re) {
  if (!re) return esc(text);
  let out = '';
  let last = 0;
  text.replace(re, (m, offset) => {
    out += esc(text.slice(last, offset)) + '<mark>' + esc(m) + '</mark>';
    last = offset + m.length;
    return m;
  });
  return out + esc(text.slice(last));
}

function wordEnd(text, pos) {
  if (pos >= text.length) return text.length;
  const cut = text.lastIndexOf(' ', pos);
  return cut > pos - 30 ? cut : pos;
}

function snippet(body, re) {
  const flat = body.replace(/^(## |[-*] |\d+\. )/gm, '').replace(/\*\*/g, '').replace(/\s+/g, ' ');
  const m = re ? new RegExp(re.source, 'i').exec(flat) : null;
  let start = m ? Math.max(0, m.index - 60) : 0;
  if (start > 0) start = flat.indexOf(' ', start) + 1 || start;
  const end = wordEnd(flat, start + 190);
  return (start > 0 ? '…' : '') + highlight(flat.slice(start, end), re) + (end < flat.length ? '…' : '');
}

/* ---------- Rendering ---------- */

function setArticles(list) {
  state.articles = list.slice().sort((a, b) =>
    (b.date || '').localeCompare(a.date || '') || (b.importedAt || 0) - (a.importedAt || 0));
  state.byId = new Map(state.articles.map((a) => [a.id, a]));
  state.index = buildIndex(state.articles);
  els.libStats.textContent =
    `${plural(state.articles.length, 'article')} stored on this device` +
    (store.ok ? '.' : ' (temporary — storage is unavailable in this browser mode).');
}

function renderTabs(counts) {
  els.tabs.innerHTML = CATEGORIES.map((cat) => {
    const selected = cat === state.category;
    const count = counts ? counts[cat] || 0 : '';
    return `<button class="tab" type="button" role="tab" data-cat="${esc(cat)}" aria-selected="${selected}">
      ${esc(cat)}<span class="count">${count}</span></button>`;
  }).join('');
}

function renderList() {
  const q = state.query.trim();
  const matched = q ? search(q) || [] : state.articles;
  const re = q ? highlightRegex(q) : null;

  const counts = { All: matched.length };
  for (const a of matched) counts[a.category] = (counts[a.category] || 0) + 1;
  renderTabs(counts);

  const shown = state.category === 'All' ? matched : matched.filter((a) => a.category === state.category);

  els.list.innerHTML = shown.map((a) => {
    const meta = [a.source, formatDate(a.date)].filter(Boolean).map(esc).join(' · ');
    const tags = a.tags.slice(0, 3).map((t) => `<span class="tag">${highlight(t, re)}</span>`).join('');
    return `<li><a class="card" href="#/a/${encodeURIComponent(a.id)}">
      <div class="card-meta"><span class="chip" data-cat="${CATEGORY_KEYS[a.category]}">${esc(a.category)}</span>
        <span>${readMinutes(a)} min read</span></div>
      <h2 class="card-title">${highlight(a.title, re)}</h2>
      <p class="card-excerpt">${snippet(a.body, re)}</p>
      <div class="card-foot">${meta ? `<span>${meta}</span>` : ''}${tags}</div>
    </a></li>`;
  }).join('');

  els.info.textContent = q
    ? `${plural(shown.length, 'result')} for “${q}”${state.category !== 'All' ? ` in ${state.category}` : ''}`
    : `${plural(shown.length, 'article')}`;

  els.empty.hidden = shown.length > 0;
  if (!shown.length) {
    els.empty.innerHTML = state.articles.length === 0
      ? '<strong>Your library is empty</strong>Tap the import button to add articles.'
      : q
        ? `<strong>No matches</strong>Try fewer or shorter words${state.category !== 'All' ? ', or switch to “All”' : ''}.`
        : `<strong>Nothing in ${esc(state.category)} yet</strong>Import articles to fill this category.`;
  }
}

function renderReader(id) {
  const a = state.byId.get(id);
  if (!a) {
    els.reader.innerHTML = '<div class="empty"><strong>Article not found</strong>It may have been removed from this device.</div>';
    document.title = 'Offline Digest';
    return;
  }
  const re = state.query.trim() ? highlightRegex(state.query) : null;
  // Light markdown: "## " headings, "- " / "1. " lists and **bold** (applied after escaping, so it stays safe).
  const inline = (text) => highlight(text, re).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const body = a.body.split(/\n{2,}/).map((block) => {
    if (block.startsWith('## ')) return `<h2>${inline(block.slice(3))}</h2>`;
    const lines = block.split('\n');
    if (lines.every((l) => /^[-*] /.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`;
    if (lines.every((l) => /^\d+\. /.test(l))) return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\. /, ''))}</li>`).join('')}</ol>`;
    return `<p>${inline(block).replace(/\n/g, '<br>')}</p>`;
  }).join('');
  const byline = [a.author, a.source].filter(Boolean).map(esc).join(' · ');
  const when = [formatDate(a.date), `${readMinutes(a)} min read`, `${a.words.toLocaleString()} words`]
    .filter(Boolean).join(' · ');

  els.reader.innerHTML = `
    <span class="chip" data-cat="${CATEGORY_KEYS[a.category]}">${esc(a.category)}</span>
    <h1>${esc(a.title)}</h1>
    <div class="reader-meta">
      ${byline ? `<div>${byline}</div>` : ''}
      <div>${when}</div>
      ${a.tags.length ? `<div class="tags">${a.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
    </div>
    <div class="reader-body">${body}</div>
    ${a.url ? `<div class="reader-foot"><a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">Open original ↗</a></div>` : ''}`;
  document.title = a.title;
}

function applyFontSize() {
  els.reader.style.setProperty('--reader-size', state.fontSize + 'px');
  els.fontDown.disabled = state.fontSize <= FONT.min;
  els.fontUp.disabled = state.fontSize >= FONT.max;
}

function changeFont(delta) {
  state.fontSize = Math.min(FONT.max, Math.max(FONT.min, state.fontSize + delta));
  prefs.set('font', state.fontSize);
  applyFontSize();
  updateProgress();
}

function updateProgress() {
  if (els.readerView.hidden) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  els.progress.style.width = (max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 100) + '%';
}

/* ---------- Routing (#/a/<id> opens the reader) ---------- */

function route() {
  const m = location.hash.match(/^#\/a\/(.+)$/);
  if (m) {
    if (!els.listView.hidden) state.listScroll = window.scrollY;
    let id;
    try { id = decodeURIComponent(m[1]); } catch { id = m[1]; }
    renderReader(id);
    els.listView.hidden = true;
    els.readerView.hidden = false;
    window.scrollTo(0, 0);
    updateProgress();
  } else {
    const wasReading = !els.readerView.hidden;
    els.readerView.hidden = true;
    els.listView.hidden = false;
    document.title = 'Offline Digest';
    state.openedFromList = false;
    if (wasReading) requestAnimationFrame(() => window.scrollTo(0, state.listScroll));
  }
}

function goBack() {
  if (state.openedFromList) {
    history.back();
  } else {
    history.replaceState(null, '', location.pathname + location.search);
    route();
  }
}

/* ---------- Import / sync ---------- */

function setStatus(msg, kind = '') {
  els.status.textContent = msg;
  els.status.className = 'status' + (kind ? ' ' + kind : '');
}

let toastTimer;
function toast(msg, actionLabel, onAction) {
  clearTimeout(toastTimer);
  els.toastMsg.textContent = msg;
  els.toastAction.hidden = !actionLabel;
  els.toastAction.textContent = actionLabel || '';
  els.toastAction.onclick = onAction || null;
  els.toast.hidden = false;
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, actionLabel ? 10000 : 3200);
}

async function importText(text, label, fromUser = true) {
  setStatus('Importing…');
  try {
    const items = parsePayload(text);
    // User imports are never overwritten by updates to the bundled articles.json.
    items.forEach((a) => { a.userImported = fromUser; });
    const fresh = items.filter((a) => !state.byId.has(a.id)).length;
    await store.putMany(items);
    setArticles(await store.all());
    renderList();
    const msg = `Imported ${plural(items.length, 'article')} from ${label} (${fresh} new).`;
    setStatus(msg, 'ok');
    toast(msg);
    return true;
  } catch (err) {
    setStatus(err.message || 'Import failed.', 'error');
    return false;
  }
}

async function syncFromUrl(url, label, fromUser = true) {
  if (!navigator.onLine) { setStatus('You are offline. Connect to sync.', 'error'); return; }
  setStatus('Downloading…');
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Server responded ${res.status}.`);
    await importText(await res.text(), label, fromUser);
  } catch (err) {
    const msg = err instanceof TypeError
      ? 'Download failed — check the URL, your connection, or the server’s CORS settings.'
      : err.message;
    setStatus(msg, 'error');
  }
}

async function fetchSeed(options) {
  try {
    const res = await fetch(SEED_URL, options);
    if (!res.ok) return [];
    return parsePayload(await res.text());
  } catch { return []; }
}

// Adds new articles from the bundled articles.json and refreshes bundled ones whose text changed.
// Articles the user imported themselves are left alone.
async function mergeNewSeedArticles() {
  const seed = await fetchSeed({ cache: 'no-store' });
  const changed = seed.filter((a) => {
    const old = state.byId.get(a.id);
    return !old || (!old.userImported && (old.title !== a.title || old.body !== a.body || old.category !== a.category));
  });
  if (!changed.length) return;
  changed.forEach((a) => { a.importedAt = state.byId.get(a.id)?.importedAt || a.importedAt; });
  await store.putMany(changed);
  setArticles(await store.all());
  renderList();
  toast(`${plural(changed.length, 'article')} added or updated.`);
}

async function resetLibrary() {
  if (!confirm('Remove all imported articles and restore the bundled sample set?')) return;
  await store.clear();
  const seed = await fetchSeed();
  if (seed.length) await store.putMany(seed);
  setArticles(await store.all());
  renderList();
  setStatus(`Library reset — ${plural(state.articles.length, 'article')} restored.`, 'ok');
}

function updateNetStatus() {
  const online = navigator.onLine;
  els.net.hidden = online;
  els.syncBtn.disabled = !online;
  els.syncDefault.disabled = !online;
}

/* ---------- Events ---------- */

function bindEvents() {
  let searchTimer;
  els.search.addEventListener('input', () => {
    els.clearSearch.hidden = !els.search.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = els.search.value;
      renderList();
      window.scrollTo(0, 0);
    }, 60);
  });
  els.search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') els.search.blur(); // dismiss iOS keyboard
    if (e.key === 'Escape') els.clearSearch.click();
  });
  els.clearSearch.addEventListener('click', () => {
    els.search.value = '';
    els.clearSearch.hidden = true;
    state.query = '';
    renderList();
    els.search.focus();
  });

  els.tabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    state.category = tab.dataset.cat;
    prefs.set('category', state.category);
    renderList();
    tab.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  });

  els.list.addEventListener('click', (e) => {
    if (e.target.closest('.card')) state.openedFromList = true;
  });

  window.addEventListener('hashchange', route);
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });

  els.back.addEventListener('click', goBack);
  els.fontDown.addEventListener('click', () => changeFont(-FONT.step));
  els.fontUp.addEventListener('click', () => changeFont(FONT.step));

  els.importBtn.addEventListener('click', () => {
    setStatus('');
    updateNetStatus();
    els.dialog.showModal();
  });
  els.dialog.addEventListener('click', (e) => {
    if (e.target === els.dialog || e.target.closest('[data-close]')) els.dialog.close();
  });

  els.fileInput.addEventListener('change', async () => {
    const file = els.fileInput.files[0];
    if (file) await importText(await file.text(), `“${file.name}”`);
    els.fileInput.value = '';
  });

  els.syncBtn.addEventListener('click', () => {
    const url = safeUrl(els.syncUrl.value);
    if (!url) { setStatus('Enter a valid http(s) URL.', 'error'); return; }
    prefs.set('syncUrl', url);
    syncFromUrl(url, new URL(url).hostname || 'URL');
  });
  els.syncUrl.addEventListener('keydown', (e) => { if (e.key === 'Enter') els.syncBtn.click(); });
  els.syncDefault.addEventListener('click', () => syncFromUrl(SEED_URL, 'articles.json', false));

  els.pasteBtn.addEventListener('click', async () => {
    if (await importText(els.paste.value, 'pasted text')) els.paste.value = '';
  });

  els.resetBtn.addEventListener('click', resetLibrary);

  window.addEventListener('online', updateNetStatus);
  window.addEventListener('offline', updateNetStatus);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker failed:', err));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) toast('A new version is ready.', 'Reload', () => location.reload());
  });
}

/* ---------- Boot ---------- */

async function init() {
  state.fontSize = Number(prefs.get('font', FONT.def)) || FONT.def;
  const savedCat = prefs.get('category', 'All');
  state.category = CATEGORIES.includes(savedCat) ? savedCat : 'All';
  els.syncUrl.value = prefs.get('syncUrl', '');
  const q = new URLSearchParams(location.search).get('q'); // e.g. ?q=cold+war (handy for iOS Shortcuts)
  if (q) { els.search.value = q; state.query = q; els.clearSearch.hidden = false; }

  bindEvents();
  applyFontSize();
  updateNetStatus();
  renderTabs();

  await store.open();
  let articles = await store.all().catch(() => []);
  const firstRun = !articles.length;
  if (firstRun) {
    articles = await fetchSeed();
    if (articles.length) await store.putMany(articles).catch((err) => console.warn(err));
  }
  setArticles(articles);
  renderList();
  route();

  registerServiceWorker();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if (!firstRun && navigator.onLine) mergeNewSeedArticles().catch(() => {});
  if (!store.ok) toast('Storage unavailable — imports last for this session only.');
}

init();
