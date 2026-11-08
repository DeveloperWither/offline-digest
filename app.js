/* Offline Digest & Search — zero-dependency offline reader */
'use strict';

const APP_VERSION = '2.0.0';
const CATEGORIES = ['All', 'World News', 'AI News', 'Tech', 'Learn', 'History & Conflicts'];
const CATEGORY_KEYS = { 'World News': 'world', 'AI News': 'ai', 'History & Conflicts': 'history', 'Tech': 'tech', 'Learn': 'learn' };
const CATEGORY_HINTS = [
  ['AI News', /\b(ai|a\.i\.|artificial intelligence|machine learning|deep learning|llms?|neural|gpt|chatbots?|openai|anthropic|deepmind|transformers?|language models?)\b/i],
  ['World News', /\b(ceasefire|truce|missiles?|air ?strikes?|drones?|sanctions|troops|president|prime minister|election|nato|united nations)\b/i],
  ['History & Conflicts', /\b(history|historical|historians?|wars?|battles?|empires?|conflicts?|treaty|revolution|siege|dynasty|ancient|medieval|military|invasion)\b/i],
];
const DB_NAME = 'offline-digest';
const STORE = 'articles';
const SEED_URL = 'articles.json';

// Android app (Capacitor): same code, with native plugins for sharing, speech, haptics and ads.
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const Plug = NATIVE ? window.Capacitor.Plugins : {};
const WEB_URL = 'https://developerwither.github.io/offline-digest/';
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.developerwither.digest';
// New articles for the Android app come from the website; the bundled copy covers the first launch.
const REMOTE_SEED_URL = WEB_URL + 'articles.json';
const WORDS_PER_MINUTE = 230;
const FONT = { min: 14, max: 30, step: 2, def: 18 };
const THEME_COLORS = { dark: '#0e0f12', light: '#f7f6f2', sepia: '#f4ecd8' };
const LINE_HEIGHTS = { compact: 1.5, normal: 1.68, relaxed: 1.9 };
const DEFAULT_SETTINGS = { theme: 'system', font: 'serif', spacing: 'normal', rate: 1, voice: '', wake: true, goal: '10', topics: [], lang: '', region: '' };
const SETTING_VALUES = {
  theme: ['system', 'dark', 'light', 'sepia'],
  font: ['serif', 'sans'],
  spacing: ['compact', 'normal', 'relaxed'],
  goal: ['5', '10', '15', '30'],
};
const FILTERS = ['all', 'unread', 'progress', 'saved', 'highlights'];
const SORTS = ['foryou', 'new', 'old', 'short', 'long'];
const READ_AT = 0.97; // scroll fraction that counts as "finished"

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
  cont: $('#continue'),
  listMain: document.querySelector('.list-main'),
  filter: $('#filter-select'),
  sort: $('#sort-select'),
  sortWrap: $('#sort-wrap'),
  reader: $('#reader'),
  back: $('#back-btn'),
  listen: $('#listen-btn'),
  save: $('#save-btn'),
  displayBtn: $('#display-btn'),
  more: $('#more-btn'),
  progress: $('#progress-bar'),
  net: $('#net-status'),
  install: $('#install-btn'),
  settingsBtn: $('#settings-btn'),
  settings: $('#settings-dialog'),
  fontDown: $('#font-down'),
  fontUp: $('#font-up'),
  fontVal: $('#font-size-val'),
  wake: $('#wake-toggle'),
  rate: $('#rate-range'),
  rateVal: $('#rate-val'),
  voice: $('#voice-select'),
  ttsSettings: $('#tts-settings'),
  stats: $('#stats'),
  goalBtn: $('#goal-btn'),
  progressDlg: $('#progress-dialog'),
  todayRing: $('#today-ring'),
  todayText: $('#today-text'),
  week: $('#week'),
  level: $('#level'),
  badges: $('#badges'),
  badgeCount: $('#badge-count'),
  today: $('#today'),
  selBar: $('#sel-bar'),
  welcome: $('#welcome-dialog'),
  topics: $('#topics'),
  installRow: $('#install-row'),
  freezeInfo: $('#freeze-info'),
  shareProgress: $('#share-progress'),
  regionSelect: $('#region-select'),
  adsSec: $('#ads-sec'),
  adFreeBtn: $('#adfree-btn'),
  adPrivacyBtn: $('#adprivacy-btn'),
  privacyLink: $('#privacy-link'),
  actions: $('#actions-dialog'),
  actionsTitle: $('#actions-title'),
  actRead: $('#act-read'),
  player: $('#player'),
  ttsPrev: $('#tts-prev'),
  ttsPlay: $('#tts-play'),
  ttsNext: $('#tts-next'),
  ttsClose: $('#tts-close'),
  ttsLabel: $('#tts-label'),
  notesBtn: $('#notes-btn'),
  dialog: $('#import-dialog'),
  noteTitle: $('#note-title'),
  noteBody: $('#note-body'),
  noteCat: $('#note-cat'),
  noteSave: $('#note-save'),
  fileInput: $('#file-input'),
  exportBtn: $('#export-btn'),
  resetBtn: $('#reset-btn'),
  libStats: $('#lib-stats'),
  status: $('#import-status'),
  toast: $('#toast'),
  toastMsg: $('#toast-msg'),
  toastAction: $('#toast-action'),
  themeMeta: document.querySelector('meta[name="theme-color"]'),
};

const state = {
  articles: [],
  byId: new Map(),
  index: null,
  category: 'All',
  filter: 'all',
  sort: 'new',
  query: '',
  fontSize: FONT.def,
  settings: { ...DEFAULT_SETTINGS },
  listScroll: 0,
  openedFromList: false,
  currentId: null,
  lastFraction: 0,
  order: [],
  installPrompt: null,
  animateList: true,
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
const articleHref = (id) => '#/a/' + encodeURIComponent(id);

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

let dateFmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const formatDate = (iso) => (iso ? dateFmt.format(new Date(iso)) : '');

function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDuration(minutes) {
  if (minutes < 60) return t('dur.min', { m: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? t('dur.hm', { h, m }) : t('dur.h', { h });
}

/* ---------- Per-article reading state (saved, read, progress) ----------
 * Kept apart from the article store so syncs, re-imports and resets never lose it.
 * s = saved at, r = read at, p = scroll fraction 0..1, o = last opened at. */

const user = {
  data: {},

  load() {
    const d = prefs.get('user', {});
    this.data = d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  },

  get(id) { return this.data[id] || {}; },

  set(id, patch) {
    const next = { ...this.get(id), ...patch };
    for (const k of Object.keys(next)) if (next[k] == null || next[k] === false || next[k] === 0) delete next[k];
    if (Object.keys(next).length) this.data[id] = next; else delete this.data[id];
    this.save();
  },

  remove(id) { delete this.data[id]; this.save(); },

  save() { prefs.set('user', this.data); },

  // Restores state from a backup, keeping only well-formed fields.
  merge(other) {
    if (!other || typeof other !== 'object') return;
    for (const [id, v] of Object.entries(other)) {
      if (!v || typeof v !== 'object') continue;
      const patch = {};
      for (const k of ['s', 'r', 'o']) if (Number.isFinite(v[k]) && v[k] > 0) patch[k] = v[k];
      if (Number.isFinite(v.p) && v.p > 0 && v.p < 1) patch.p = v.p;
      if (Object.keys(patch).length) this.data[id] = { ...this.data[id], ...patch };
    }
    this.save();
  },
};

const isRead = (id) => !!user.get(id).r;
const isSaved = (id) => !!user.get(id).s;
function progressOf(id) {
  const u = user.get(id);
  return !u.r && u.p > 0.02 ? u.p : 0;
}

// Ids of bundled articles the user deleted, so seed syncs don't bring them back.
const tombstones = {
  get() { return new Set(prefs.get('deleted', [])); },
  add(id) { const s = this.get(); s.add(id); prefs.set('deleted', [...s]); },
  removeMany(ids) {
    const s = this.get();
    let changed = false;
    ids.forEach((id) => { if (s.delete(id)) changed = true; });
    if (changed) prefs.set('deleted', [...s]);
  },
  clear() { prefs.set('deleted', []); },
};

function markRead(id) {
  if (!id || isRead(id)) return;
  user.set(id, { r: Date.now(), p: null });
  markStreakDay();
  const hour = new Date().getHours();
  const ev = events();
  if (hour >= 23 || hour < 4) ev.night++;
  if (hour >= 4 && hour < 7) ev.early++;
  prefs.set('ev', ev);
  updateReadUI();
  checkBadges();
  renderGoalPill();
}

function markUnread(id) {
  user.set(id, { r: null, p: null });
  updateReadUI();
}

// Days that count for streaks: real reading days plus days saved by a streak freeze.
const streakDays = () => new Set([...prefs.get('days', []), ...prefs.get('frozen', [])]);

function readingStreak() {
  const days = streakDays();
  const d = new Date();
  if (!days.has(localDay(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(localDay(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

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

  async remove(id) {
    if (!this.ok) { this.memory.delete(id); return; }
    await this.run('readwrite', (s) => { s.delete(id); });
  },

  async clear() {
    if (!this.ok) { this.memory.clear(); return; }
    await this.run('readwrite', (s) => { s.clear(); });
  },
};

/* ---------- Import parsing (JSON, JSON Feed, RSS, Atom, backups) ---------- */

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, noscript, iframe, svg').forEach((n) => n.remove());
  doc.querySelectorAll('br').forEach((n) => n.replaceWith('\n'));
  doc.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, blockquote, pre, tr, section, article, figure')
    .forEach((n) => n.append('\n\n'));
  return (doc.body.textContent || '')
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function guessCategory(text) {
  for (const [cat, re] of CATEGORY_HINTS) if (re.test(text)) return cat;
  return 'Tech';
}

// Multiple-choice questions: { q, options[2-6], answer (index), explain }.
function cleanQuiz(list) {
  if (!Array.isArray(list)) return [];
  return list.map((q) => {
    if (!q || typeof q.q !== 'string' || !Array.isArray(q.options)) return null;
    const options = q.options.map(clean).filter(Boolean).slice(0, 6);
    if (options.length < 2 || !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= options.length) return null;
    return { q: clean(q.q).slice(0, 300), options: options.map((o) => o.slice(0, 200)), answer: q.answer, explain: clean(q.explain).slice(0, 400) };
  }).filter(Boolean).slice(0, 10);
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

  let regions = raw.regions ?? raw.region ?? [];
  if (typeof regions === 'string') regions = regions.split(',');
  regions = Array.isArray(regions)
    ? [...new Set(regions.map(clean).filter((r) => /^[A-Za-z-]{2,20}$/.test(r))
      .map((r) => (r.length === 2 ? r.toUpperCase() : r.toLowerCase())))].slice(0, 10)
    : [];

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
    regions,
    author: clean(raw.author?.name ?? raw.author),
    source: clean(raw.source),
    date,
    url,
    body,
    words: countWords(body),
    importedAt: Number(raw.importedAt) || Date.now(),
    evergreen: raw.evergreen === true,
    quiz: cleanQuiz(raw.quiz),
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
  if (doc.querySelector('parsererror')) throw new Error(t('err.xml'));
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

// Returns { items, backup }; backup is set when the text is a Digest export.
function parsePayload(text) {
  const src = String(text).replace(/^﻿/, '').trim();
  if (!src) throw new Error(t('err.empty'));

  let items;
  let backup = null;
  if (src.startsWith('<')) {
    items = parseFeed(src);
  } else {
    let data;
    try { data = JSON.parse(src); } catch { throw new Error(t('err.json')); }
    if (data?.app === 'offline-digest') backup = data;
    const list = Array.isArray(data) ? data
      : Array.isArray(data?.articles) ? data.articles
      : Array.isArray(data?.items) ? data.items
      : [data];
    items = list.map((raw) => normalize(raw)).filter(Boolean);
  }
  if (!items.length) throw new Error(t('err.none'));
  return { items, backup };
}

/* ---------- Search index ---------- */

// Works for every script: Latin accents and Arabic vowel marks are folded away; Hindi vowel signs stay inside words.
function tokenize(s) {
  return String(s).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, '')
    .match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*/gu) || [];
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
  return terms.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${terms.map(escRe).join('|')})[\\p{L}\\p{N}\\p{M}]*`, 'giu') : null;
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

const flatten = (body) => body.replace(/^(## |[-*] |\d+\. )/gm, '').replace(/\*\*/g, '').replace(/\s+/g, ' ');

function snippet(body, re) {
  const flat = flatten(body);
  const m = re ? new RegExp(re.source, 'iu').exec(flat) : null;
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
  renderLibStats();
}

function renderTabs(counts) {
  els.tabs.innerHTML = CATEGORIES.map((cat) => {
    const selected = cat === state.category;
    const count = counts ? counts[cat] || 0 : '';
    return `<button class="tab" type="button" role="tab" data-cat="${esc(cat)}" aria-selected="${selected}">
      ${esc(catName(cat))}<span class="count">${count}</span></button>`;
  }).join('');
}

function applyFilter(list) {
  switch (state.filter) {
    case 'unread': return list.filter((a) => !isRead(a.id));
    case 'progress': return list.filter((a) => progressOf(a.id) > 0);
    case 'saved': return list.filter((a) => isSaved(a.id));
    case 'highlights': { const hl = highlightsAll(); return list.filter((a) => hl[a.id]?.length); }
    default: return list;
  }
}

function applySort(list) {
  switch (state.sort) {
    case 'foryou': return list.slice().sort((a, b) => forYouRank(b) - forYouRank(a));
    case 'old': return list.slice().reverse();
    case 'short': return list.slice().sort((a, b) => a.words - b.words);
    case 'long': return list.slice().sort((a, b) => b.words - a.words);
    default: return list;
  }
}

const progressBar = (p) => `<div class="card-progress" aria-hidden="true"><span style="width:${Math.round(p * 100)}%"></span></div>`;

function renderContinue(show) {
  let best = null;
  let bestAt = 0;
  if (show) {
    for (const a of state.articles) {
      const u = user.get(a.id);
      if (progressOf(a.id) > 0 && (u.o || 0) >= bestAt) { best = a; bestAt = u.o || 0; }
    }
  }
  if (!best) { els.cont.innerHTML = ''; return; }
  const p = progressOf(best.id);
  els.cont.innerHTML = `<a class="continue" href="${articleHref(best.id)}">
    <span class="continue-label">${t('continue', { p: Math.round(p * 100) })}</span>
    <strong dir="auto">${esc(best.title)}</strong>
    ${progressBar(p)}
  </a>`;
}


function renderList() {
  const q = state.query.trim();
  const searched = q ? search(q) || [] : state.articles;
  const matched = applyFilter(searched);
  const re = q ? highlightRegex(q) : null;

  const counts = { All: matched.length };
  for (const a of matched) counts[a.category] = (counts[a.category] || 0) + 1;
  renderTabs(counts);

  const inCat = state.category === 'All' ? matched : matched.filter((a) => a.category === state.category);
  const shown = q ? inCat : applySort(inCat);
  state.order = shown.map((a) => a.id);
  els.sortWrap.hidden = !!q;
  renderContinue(!q && state.filter === 'all');
  renderToday(!q && state.filter === 'all' && state.category === 'All');
  const hlAll = state.filter === 'highlights' ? highlightsAll() : null;

  const animate = state.animateList;
  state.animateList = false;
  els.listMain.classList.remove('anim');
  if (animate && !reducedMotion()) { void els.listMain.offsetWidth; els.listMain.classList.add('anim'); }
  els.list.innerHTML = shown.map((a, i) => {
    const u = user.get(a.id);
    const p = progressOf(a.id);
    const meta = [a.source, formatDate(a.date)].filter(Boolean).map((x) => `<bdi>${esc(x)}</bdi>`).join(' · ');
    const tags = a.tags.slice(0, 3).map((t) => `<span class="tag">${highlight(t, re)}</span>`).join('');
    return `<li style="--i:${Math.min(i, 10) + 2}"><a class="card${u.r ? ' is-read' : ''}" href="${articleHref(a.id)}">
      <div class="card-meta"><span class="chip" data-cat="${CATEGORY_KEYS[a.category]}">${esc(catName(a.category))}</span>
        <span>${t('minRead', { n: readMinutes(a) })}</span>
        ${regionMatch(a) === 2 ? `<span class="near-mark">${esc(t('nearYou', { name: countryName(userRegion.cc) }))}</span>` : ''}
        ${a.quiz?.length && !a.quiz.every((_, i) => Number.isInteger(quizAnswers(a.id)[i])) ? `<span class="quiz-mark">${esc(t('quiz.tag'))}</span>` : ''}
        ${u.r ? `<span class="read-mark">${t('readMark')}</span>` : ''}
        ${u.s ? `<span class="saved-mark" aria-label="${esc(t('filter.saved'))}">★</span>` : ''}</div>
      <h2 class="card-title" dir="auto">${highlight(a.title, re)}</h2>
      ${hlAll ? `<blockquote class="card-quote" dir="auto">“${esc(hlAll[a.id][hlAll[a.id].length - 1].t)}”${hlAll[a.id].length > 1 ? `<small>${t('more', { n: hlAll[a.id].length - 1 })}</small>` : ''}</blockquote>`
        : `<p class="card-excerpt" dir="auto">${snippet(a.body, re)}</p>`}
      <div class="card-foot">${meta ? `<span>${meta}</span>` : ''}${tags}</div>
      ${p ? progressBar(p) : ''}
    </a></li>`;
  }).join('');

  els.info.textContent = (q ? t('count.results', { n: shown.length, q }) : t('count.articles', { n: shown.length }))
    + (state.filter !== 'all' ? ' · ' + t('filter.' + state.filter) : '');

  els.empty.hidden = shown.length > 0;
  if (!shown.length) {
    const key = state.articles.length === 0 ? 'lib'
      : q ? 'search'
      : state.filter === 'saved' ? 'saved'
      : state.filter === 'unread' ? 'unread'
      : state.filter === 'highlights' ? 'hl'
      : state.filter === 'progress' ? 'progress'
      : 'cat';
    const switchNote = state.category !== 'All' && key !== 'lib' && key !== 'cat' ? ' ' + t('empty.switch') : '';
    const icon = { lib: '📭', search: '🔍', saved: '🔖', unread: '🎉', hl: '🖍️', progress: '📖', cat: '🗂️' }[key];
    els.empty.innerHTML = `<span class="empty-icon" aria-hidden="true">${icon}</span><strong>${esc(t(`empty.${key}.t`))}</strong>${esc(t(`empty.${key}.d`) + switchNote)}`;
  }
}

function nextArticleId(id) {
  const order = state.order.includes(id) ? state.order : state.articles.map((a) => a.id);
  const i = order.indexOf(id);
  for (let k = i + 1; k < order.length; k++) if (!isRead(order[k])) return order[k];
  for (const a of state.articles) if (a.id !== id && !isRead(a.id)) return a.id;
  return i >= 0 && i + 1 < order.length ? order[i + 1] : null;
}

function renderReader(id) {
  const a = state.byId.get(id);
  if (!a) {
    els.reader.innerHTML = `<div class="empty"><strong>${esc(t('notFound.t'))}</strong>${esc(t('notFound.d'))}</div>`;
    document.title = 'Offline Digest';
    return false;
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
  const byline = [a.author, a.source].filter(Boolean).map((x) => `<bdi>${esc(x)}</bdi>`).join(' · ');
  const when = [formatDate(a.date), t('minRead', { n: readMinutes(a) }), t('words', { n: a.words })]
    .filter(Boolean).map((x) => `<bdi>${esc(x)}</bdi>`).join(' · ');
  const nextId = nextArticleId(a.id);
  const next = nextId && state.byId.get(nextId);
  const related = relatedArticles(a, nextId);
  const miniCard = (x) => `<a class="card next-card" href="${articleHref(x.id)}" data-next="${esc(x.id)}">
          <div class="card-meta"><span class="chip" data-cat="${CATEGORY_KEYS[x.category]}">${esc(catName(x.category))}</span>
            <span>${t('minRead', { n: readMinutes(x) })}</span>${isRead(x.id) ? `<span class="read-mark">${t('readMark')}</span>` : ''}</div>
          <h2 class="card-title" dir="auto">${esc(x.title)}</h2>
        </a>`;

  els.reader.innerHTML = `
    <span class="chip" data-cat="${CATEGORY_KEYS[a.category]}">${esc(catName(a.category))}</span>
    <h1 dir="auto">${esc(a.title)}</h1>
    <div class="reader-meta">
      ${byline ? `<div>${byline}</div>` : ''}
      <div>${when}</div>
      ${a.tags.length ? `<div class="tags">${a.tags.map((tag) => `<button type="button" class="tag tag-btn" data-tag="${esc(tag)}">${esc(tag)}</button>`).join('')}</div>` : ''}
    </div>
    <div class="reader-body" dir="auto">${body}</div>
    ${renderQuiz(a)}
    <div class="reader-end">
      <button id="finish-btn" class="btn" type="button"></button>
      ${a.url ? `<a class="orig" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${t('original')}</a>` : ''}
      ${next ? `<p class="up-next">${t('upNext')}</p>${miniCard(next)}` : ''}
      ${related.length ? `<p class="up-next">${t('related')}</p><div class="related">${related.map(miniCard).join('')}</div>` : ''}
    </div>`;
  document.title = a.title;
  return true;
}

function updateReadUI() {
  const id = state.currentId;
  if (!id) return;
  const read = isRead(id);
  const btn = document.getElementById('finish-btn');
  if (btn) {
    btn.textContent = read ? t('finish.done') : t('finish.mark');
    btn.classList.toggle('btn-primary', !read);
  }
  els.actRead.textContent = read ? t('act.unread') : t('act.read');
  const saved = isSaved(id);
  els.save.setAttribute('aria-pressed', String(saved));
  els.save.setAttribute('aria-label', saved ? t('aria.unsave') : t('aria.save'));
}

/* ---------- Display settings ---------- */

const colorQuery = matchMedia('(prefers-color-scheme: light)');

function loadSettings() {
  const saved = prefs.get('settings', {});
  const s = { ...DEFAULT_SETTINGS };
  if (saved && typeof saved === 'object') {
    for (const [k, values] of Object.entries(SETTING_VALUES)) if (values.includes(saved[k])) s[k] = saved[k];
    if (Number.isFinite(saved.rate)) s.rate = Math.min(2, Math.max(0.6, saved.rate));
    if (typeof saved.voice === 'string') s.voice = saved.voice;
    if (typeof saved.wake === 'boolean') s.wake = saved.wake;
    if (Array.isArray(saved.topics)) s.topics = saved.topics.filter((c) => CATEGORY_KEYS[c]);
    if (typeof saved.lang === 'string' && I18N[saved.lang]) s.lang = saved.lang;
    if (typeof saved.region === 'string' && /^([A-Z]{2})?$/.test(saved.region)) s.region = saved.region;
  }
  state.settings = s;
}

function saveSettings() { prefs.set('settings', state.settings); }

function applyTheme() {
  const t = state.settings.theme === 'system' ? (colorQuery.matches ? 'light' : 'dark') : state.settings.theme;
  document.documentElement.dataset.theme = t;
  els.themeMeta.setAttribute('content', THEME_COLORS[t]);
  if (NATIVE) Plug.SystemBars?.setStyle({ style: t === 'dark' ? 'DARK' : 'LIGHT' }).catch(() => {});
}

function applyReaderStyle() {
  els.reader.style.setProperty('--reader-size', state.fontSize + 'px');
  els.reader.style.setProperty('--reader-lh', LINE_HEIGHTS[state.settings.spacing]);
  els.reader.dataset.font = state.settings.font;
  els.fontDown.disabled = state.fontSize <= FONT.min;
  els.fontUp.disabled = state.fontSize >= FONT.max;
  els.fontVal.textContent = state.fontSize;
}

function renderSettingsUI() {
  document.querySelectorAll('.seg[data-setting]').forEach((seg) => {
    const current = state.settings[seg.dataset.setting];
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === current)));
  });
  els.wake.checked = state.settings.wake;
  els.rate.value = state.settings.rate;
  els.rateVal.textContent = state.settings.rate.toFixed(1) + '×';
  applyReaderStyle();
}

function changeFont(delta) {
  const keep = state.lastFraction;
  state.fontSize = Math.min(FONT.max, Math.max(FONT.min, state.fontSize + delta));
  prefs.set('font', state.fontSize);
  applyReaderStyle();
  if (!els.readerView.hidden) scrollToFraction(keep); // stay at the same place in the text
}

/* ---------- Reading progress, resume and wake lock ---------- */

function readerFraction() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 1;
}

function scrollToFraction(f) {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo(0, Math.max(0, f * max));
  updateProgress();
}

let progressTimer;
function persistProgress(now) {
  const id = state.currentId;
  if (!id) return;
  clearTimeout(progressTimer);
  const save = () => {
    if (id !== state.currentId || isRead(id)) return;
    const f = state.lastFraction;
    if (f >= READ_AT) markRead(id);
    else if (f > 0.02) user.set(id, { p: Math.round(f * 1000) / 1000 });
  };
  if (now) save(); else progressTimer = setTimeout(save, 400);
}

function updateProgress() {
  if (els.readerView.hidden || !state.currentId) return;
  const scrollable = document.documentElement.scrollHeight - window.innerHeight > 0;
  // A page that fits on one screen isn't auto-marked read; the "Mark as read" button is right there.
  state.lastFraction = scrollable ? readerFraction() : 0;
  els.progress.style.width = (scrollable ? state.lastFraction * 100 : 100) + '%';
  persistProgress(false);
}

let wakeLock = null;
let nativeAwake = false;
async function requestWakeLock() {
  if (NATIVE && Plug.KeepAwake) {
    if (state.settings.wake && state.currentId && !nativeAwake) { nativeAwake = true; Plug.KeepAwake.keepAwake().catch(() => {}); }
    return;
  }
  if (!state.settings.wake || !state.currentId || document.hidden || !('wakeLock' in navigator) || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { wakeLock = null; }
}
function releaseWakeLock() {
  if (nativeAwake) { nativeAwake = false; Plug.KeepAwake.allowSleep().catch(() => {}); }
  if (wakeLock) wakeLock.release().catch(() => {});
  wakeLock = null;
}

/* ---------- Read aloud (on-device speech synthesis) ---------- */

const nativeTts = NATIVE && !!Plug.TextToSpeech;
let nativeVoices = [];
const tts = {
  supported: nativeTts || ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window),
  on: false,
  playing: false,
  blocks: [],
  i: 0,
  run: 0,
};

function ttsChunks(text) {
  // Android/Chrome can cut off long utterances, so speak sentence-sized pieces.
  const sentences = text.replace(/\s+/g, ' ').trim().match(/[^.!?…]+[.!?…]+["'”’)\]]*\s*|[^.!?…]+$/g) || [text];
  const out = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + s).length > 220 && cur) { out.push(cur.trim()); cur = ''; }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function pickVoice() {
  if (!state.settings.voice || nativeTts) return null;
  return speechSynthesis.getVoices().find((v) => v.voiceURI === state.settings.voice) || null;
}

function ttsCancel() {
  if (nativeTts) Plug.TextToSpeech.stop().catch(() => {});
  else if ('speechSynthesis' in window) speechSynthesis.cancel();
}

function ttsStart() {
  if (!tts.supported) { toast(t('tts.na')); return; }
  tts.blocks = [...els.reader.querySelectorAll('h1, .reader-body > h2, .reader-body > p, .reader-body li')];
  if (!tts.blocks.length) return;
  // Start from the first paragraph visible on screen.
  const top = els.readerView.querySelector('.reader-bar').getBoundingClientRect().bottom;
  const from = tts.blocks.findIndex((b) => b.getBoundingClientRect().bottom > top + 8);
  tts.on = true;
  els.player.hidden = false;
  document.body.classList.add('tts-on');
  ttsSpeak(Math.max(0, from));
}

function clearSpeaking() {
  els.reader.querySelectorAll('.speaking').forEach((b) => b.classList.remove('speaking'));
}

function ttsSpeak(i) {
  const run = ++tts.run;
  ttsCancel();
  clearSpeaking();
  if (i >= tts.blocks.length) {
    const id = state.currentId;
    ttsStop();
    if (id) { markRead(id); bumpEvent('listened'); toast(t('tts.finished')); }
    return;
  }
  tts.i = Math.max(0, i);
  tts.playing = true;
  updatePlayer();
  const el = tts.blocks[tts.i];
  el.classList.add('speaking');
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });

  const chunks = ttsChunks(el.textContent);
  let k = 0;
  const next = () => {
    if (run !== tts.run) return;
    if (k >= chunks.length) { ttsSpeak(tts.i + 1); return; }
    if (nativeTts) {
      const text = chunks[k++];
      const opts = { text, lang: guessLang(text), rate: state.settings.rate };
      const vi = nativeVoices.findIndex((v) => v.voiceURI === state.settings.voice);
      if (vi >= 0) { opts.voice = vi; opts.lang = nativeVoices[vi].lang; }
      Plug.TextToSpeech.speak(opts).then(next, () => { if (run === tts.run) next(); });
      return;
    }
    const u = new SpeechSynthesisUtterance(chunks[k++]);
    u.rate = state.settings.rate;
    const v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = guessLang(chunks[k - 1]); }
    u.onend = next;
    u.onerror = (e) => {
      if (run !== tts.run || e.error === 'interrupted' || e.error === 'canceled') return;
      next();
    };
    speechSynthesis.speak(u);
  };
  // Chrome sometimes drops a speak() issued in the same tick as cancel().
  setTimeout(next, 60);
}

function ttsPause() {
  tts.run++;
  tts.playing = false;
  ttsCancel();
  updatePlayer();
}

function ttsStop() {
  if (!tts.on) return;
  tts.run++;
  tts.on = false;
  tts.playing = false;
  if (tts.supported) ttsCancel();
  clearSpeaking();
  els.player.hidden = true;
  document.body.classList.remove('tts-on');
  updatePlayer();
}

function updatePlayer() {
  updateBanner();
  els.ttsPlay.classList.toggle('is-paused', !tts.playing);
  els.ttsPlay.setAttribute('aria-label', tts.playing ? 'Pause' : 'Play');
  els.ttsLabel.textContent = tts.on ? `${tts.i + 1} / ${tts.blocks.length}` : '';
  els.listen.setAttribute('aria-pressed', String(tts.on));
}

function populateVoices() {
  if (!tts.supported) { els.ttsSettings.hidden = true; return; }
  if (nativeTts && !nativeVoices.length) {
    Plug.TextToSpeech.getSupportedVoices()
      .then((r) => { nativeVoices = r?.voices || []; if (nativeVoices.length) populateVoices(); })
      .catch(() => {});
  }
  const voices = (nativeTts ? nativeVoices : speechSynthesis.getVoices()).slice().sort((a, b) =>
    (b.localService - a.localService) || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
  els.voice.innerHTML = `<option value="">${esc(t('tts.default'))}</option>` + voices.map((v) =>
    `<option value="${esc(v.voiceURI)}">${esc(v.name)} · ${esc(v.lang)}${v.localService ? ' · ' + esc(t('tts.offline')) : ''}</option>`).join('');
  els.voice.value = state.settings.voice;
  if (els.voice.value !== state.settings.voice) els.voice.value = '';
}

/* ---------- Habits: reading time, daily goal, streaks ----------
 * Time counts only while an article is open, the app is visible, and the reader
 * scrolled or touched in the last 90 s (or read-aloud is playing). */

const TICK = 5; // seconds
const activity = { last: 0 };
const markActive = () => { activity.last = Date.now(); };

function readingLog() {
  const log = prefs.get('log', {});
  return log && typeof log === 'object' && !Array.isArray(log) ? log : {};
}
const secondsToday = () => readingLog()[localDay()] || 0;
const goalSeconds = () => Number(state.settings.goal) * 60;

function addDay(key) {
  const days = new Set(prefs.get(key, []));
  if (days.has(localDay())) return false;
  days.add(localDay());
  prefs.set(key, [...days].sort().slice(-400));
  return true;
}

function tickReading() {
  if (!state.currentId || document.hidden) return;
  if (!(tts.playing || Date.now() - activity.last < 90000)) return;
  const log = readingLog();
  const day = localDay();
  const before = log[day] || 0;
  log[day] = before + TICK;
  // Keep 60 days of history for the weekly chart.
  const keys = Object.keys(log).sort();
  keys.slice(0, Math.max(0, keys.length - 60)).forEach((k) => delete log[k]);
  prefs.set('log', log);
  prefs.set('totalSecs', (Number(prefs.get('totalSecs', 0)) || 0) + TICK);

  if (before < 60 && log[day] >= 60) markStreakDay(); // a real minute of reading keeps the streak alive
  if (before < goalSeconds() && log[day] >= goalSeconds() && addDay('goalDays')) {
    celebrate();
    buzz([30, 60, 30]);
    showCelebration('🎯', t('goal.title'), t('today.done.t'));
    replay(els.goalBtn, 'pulse');
    toast(t('goal.reached', { n: readingStreak() }), t('share'), () => shareText(t('share.goal', { n: readingStreak() })));
    setTimeout(checkBadges, 4000); // let the goal message show first
  }
  renderGoalPill();
}

function bestStreak() {
  const days = [...streakDays()].sort();
  let best = 0, run = 0, prev = null;
  for (const d of days) {
    const t = new Date(d + 'T12:00:00');
    run = prev && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

function ringSvg(fraction, size, stroke, animate = false) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, Math.max(0, fraction));
  return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg${f >= 1 ? ' done' : ''}${animate ? ' ring-anim' : ''}" stroke-width="${stroke}"
      style="--c:${c}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

function renderGoalPill() {
  const f = secondsToday() / goalSeconds();
  const streak = readingStreak();
  const label = streak
    ? `<i class="flame">🔥</i> ${streak.toLocaleString(LANG)}`
    : `${Math.floor(secondsToday() / 60)}/${state.settings.goal}m`;
  const fg = els.goalBtn.querySelector('.ring-fg');
  if (fg) {
    const c = Number(fg.getAttribute('stroke-dasharray'));
    const clamped = Math.min(1, Math.max(0, f));
    fg.setAttribute('stroke-dashoffset', c * (1 - clamped));
    fg.classList.toggle('done', clamped >= 1);
    const span = els.goalBtn.querySelector('span');
    if (span.innerHTML !== label) span.innerHTML = label;
  } else {
    els.goalBtn.innerHTML = `${ringSvg(f, 24, 4, true)}<span>${label}</span>`;
  }
  els.goalBtn.setAttribute('aria-label', t('pill.aria', { m: Math.floor(secondsToday() / 60), g: Number(state.settings.goal), s: streak }));
}

function markStreakDay() {
  if (!addDay('days')) return;
  // Every 7 days in a row earns a streak freeze (max 2).
  const streak = readingStreak();
  if (streak > 0 && streak % 7 === 0 && prefs.get('freezeAwardedAt', '') !== localDay()) {
    const f = Number(prefs.get('freezes', 0)) || 0;
    if (f < 2) {
      prefs.set('freezes', f + 1);
      prefs.set('freezeAwardedAt', localDay());
      setTimeout(() => toast(t('freeze.earned')), 1500);
    }
  }
}

// On launch: if the user missed day(s) but has freezes, spend them so the streak survives.
function applyFreezes() {
  const f = Number(prefs.get('freezes', 0)) || 0;
  if (!f) return;
  const days = streakDays();
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const missing = [];
  while (!days.has(localDay(d)) && missing.length <= f) { missing.push(localDay(d)); d.setDate(d.getDate() - 1); }
  // Only bridge a short gap that sits right after a real streak.
  if (!missing.length || missing.length > f || !days.has(localDay(d))) return;
  prefs.set('frozen', [...prefs.get('frozen', []), ...missing].slice(-60));
  prefs.set('freezes', f - missing.length);
  setTimeout(() => toast(t('freeze.used', { n: readingStreak() })), 800);
}

const buzz = (pattern) => {
  try {
    if (NATIVE && Plug.Haptics) Plug.Haptics.vibrate({ duration: Array.isArray(pattern) ? 45 : pattern }).catch(() => {});
    else navigator.vibrate?.(pattern);
  } catch { /* not supported */ }
};

/* ---------- Motion helpers ---------- */

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Restarts a CSS animation class on an element.
function replay(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth; // force reflow so the animation runs again
  el.classList.add(cls);
}

function popEl(el) {
  if (!el) return;
  replay(el, 'pop');
  el.addEventListener('animationend', () => el.classList.remove('pop'), { once: true });
}

// Animates numbers in [data-count] from 0 to their value.
function countUp(root) {
  if (reducedMotion()) return;
  root.querySelectorAll('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    if (!target) return;
    const start = performance.now();
    const dur = 900;
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString(LANG);
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = (0).toLocaleString(LANG);
    requestAnimationFrame(step);
  });
}
const num = (n) => `<b data-count="${n}">${Number(n).toLocaleString(LANG)}</b>`;

// Big centred card for special moments (badge unlocked, goal reached). It never blocks taps.
function showCelebration(icon, label, title) {
  document.querySelectorAll('.celebrate-card').forEach((c) => c.remove());
  const card = document.createElement('div');
  card.className = 'celebrate-card';
  card.setAttribute('role', 'status');
  card.innerHTML = `<span class="c-icon">${esc(icon)}</span><small>${esc(label)}</small><strong>${esc(title)}</strong>`;
  document.body.append(card);
  const close = () => {
    if (!card.isConnected) return;
    card.classList.add('out');
    setTimeout(() => card.remove(), reducedMotion() ? 0 : 300);
  };
  setTimeout(close, 2600);
}

/* ---------- Badges and levels ---------- */

const BADGES = [
  { id: 'first', icon: '📖', test: (s) => s.read >= 1 },
  { id: 'read10', icon: '📚', test: (s) => s.read >= 10 },
  { id: 'read50', icon: '🏛️', test: (s) => s.read >= 50 },
  { id: 'read100', icon: '🧠', test: (s) => s.read >= 100 },
  { id: 'streak3', icon: '🔥', test: (s) => s.best >= 3 },
  { id: 'streak7', icon: '⚡', test: (s) => s.best >= 7 },
  { id: 'streak30', icon: '🏆', test: (s) => s.best >= 30 },
  { id: 'goal1', icon: '🎯', test: (s) => s.goalDays >= 1 },
  { id: 'goal7', icon: '🥇', test: (s) => s.goalDays >= 7 },
  { id: 'hour', icon: '⏳', test: (s) => s.totalMin >= 300 },
  { id: 'explorer', icon: '🧭', test: (s) => s.cats >= CATEGORIES.length - 1 },
  { id: 'quiz5', icon: '🧠', test: (s) => s.quiz.done >= 5 },
  { id: 'perfect', icon: '💯', test: (s) => s.quiz.perfect >= 1 },
  { id: 'saver', icon: '⭐', test: (s) => s.saved >= 10 },
  { id: 'hl', icon: '🖍️', test: (s) => s.highlights >= 10 },
  { id: 'listener', icon: '🎧', test: (s) => s.ev.listened >= 1 },
  { id: 'writer', icon: '✍️', test: (s) => s.ev.notes >= 1 },
  { id: 'sharer', icon: '💌', test: (s) => s.ev.shares >= 1 },
  { id: 'night', icon: '🦉', test: (s) => s.ev.night >= 1 },
  { id: 'early', icon: '🌅', test: (s) => s.ev.early >= 1 },
];

const badgeName = (b) => t(`badge.${b.id}.n`);
const badgeDesc = (b) => t(`badge.${b.id}.d`);

function events() {
  const ev = prefs.get('ev', {});
  return { listened: 0, notes: 0, shares: 0, night: 0, early: 0, ...(ev && typeof ev === 'object' ? ev : {}) };
}
function bumpEvent(key) {
  const ev = events();
  ev[key] = (ev[key] || 0) + 1;
  prefs.set('ev', ev);
  checkBadges();
}

function computeStats() {
  let read = 0, saved = 0, inProgress = 0, words = 0;
  const cats = new Set();
  for (const a of state.articles) {
    if (isRead(a.id)) { read++; words += a.words; cats.add(a.category); }
    if (isSaved(a.id)) saved++;
    if (progressOf(a.id) > 0) inProgress++;
  }
  const highlights = Object.values(highlightsAll()).reduce((n, list) => n + list.length, 0);
  const totalMin = Math.floor((Number(prefs.get('totalSecs', 0)) || 0) / 60);
  const unlocked = prefs.get('badges', {}) || {};
  const s = {
    read, saved, inProgress, words, highlights, totalMin,
    cats: cats.size,
    streak: readingStreak(),
    best: bestStreak(),
    goalDays: prefs.get('goalDays', []).length,
    ev: events(),
    badgeCount: Object.keys(unlocked).length,
    quiz: quizStats(),
  };
  // XP: 1 per 10 words finished, 2 per minute read, 100 per badge, 5 per highlight.
  s.xp = Math.round(words / 10 + totalMin * 2 + s.badgeCount * 100 + highlights * 5 + s.quiz.correct * 10);
  let level = 1;
  while (s.xp >= 50 * (level + 1) * level) level++;
  s.level = level;
  s.levelName = (Array.isArray(I18N[LANG]?.levels) ? I18N[LANG].levels : I18N.en.levels)[Math.min(8, Math.floor((level - 1) / 2))];
  const lo = 50 * level * (level - 1);
  const hi = 50 * (level + 1) * level;
  s.levelFraction = (s.xp - lo) / (hi - lo);
  s.xpToNext = hi - s.xp;
  return s;
}

const badgeQueue = [];
function checkBadges() {
  const s = computeStats();
  const unlocked = prefs.get('badges', {}) || {};
  const fresh = BADGES.filter((b) => !unlocked[b.id] && b.test(s));
  if (!fresh.length) return;
  fresh.forEach((b) => { unlocked[b.id] = Date.now(); });
  prefs.set('badges', unlocked);
  badgeQueue.push(...fresh);
  if (badgeQueue.length === fresh.length) showNextBadge();
}

function showNextBadge() {
  const b = badgeQueue[0];
  if (!b) return;
  celebrate();
  buzz([20, 40, 20]);
  showCelebration(b.icon, t('badge.new'), badgeName(b));
  toast(t('badge.unlocked', { icon: b.icon, name: badgeName(b) }), t('share'), () => shareText(t('share.badge', { icon: b.icon, name: badgeName(b) })));
  setTimeout(() => { badgeQueue.shift(); showNextBadge(); }, 4200);
}

function renderProgress() {
  const s = computeStats();
  const today = secondsToday();
  const goal = goalSeconds();
  const unlocked = prefs.get('badges', {}) || {};
  const log = readingLog();

  els.todayRing.innerHTML = `${ringSvg(today / goal, 132, 12, true)}
    <div class="ring-label"><strong>${num(Math.floor(today / 60))}</strong><span>${esc(t('ring.of', { g: Number(state.settings.goal) }))}</span></div>`;
  els.todayText.innerHTML = today >= goal
    ? `<strong>${esc(t('today.done.t'))}</strong>${esc(t('today.done.d', { n: s.streak }))}`
    : `<strong>${esc(t('today.left', { n: Math.ceil((goal - today) / 60) }))}</strong>${esc(s.streak ? t('today.keep', { n: s.streak }) : t('today.start'))}`;

  // Last 7 days
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
  const maxMin = Math.max(Number(state.settings.goal), ...days.map((d) => (log[localDay(d)] || 0) / 60));
  const dayFmt = new Intl.DateTimeFormat(LANG, { weekday: 'narrow' });
  const bars = days.map((d, i) => {
    const min = (log[localDay(d)] || 0) / 60;
    const hit = min >= Number(state.settings.goal);
    return `<div class="bar${hit ? ' hit' : ''}" title="${Math.round(min)} min"><span style="--i:${i};height:${Math.max(3, (min / maxMin) * 100)}%"></span></div>`;
  }).join('');
  const labels = days.map((d, i) => `<em${i === 6 ? ' class="now"' : ''}>${dayFmt.format(d)}</em>`).join('');
  els.week.innerHTML = `<div class="bars">${bars}<i class="goal-line" style="bottom:${(Number(state.settings.goal) / maxMin) * 100}%"><b>${esc(t('goalLine', { n: Number(state.settings.goal) }))}</b></i></div>
    <div class="days">${labels}</div>`;

  els.level.innerHTML = `<div class="level-top"><strong>${esc(t('level', { n: s.level, name: s.levelName }))}</strong><span>${esc(t('xp', { n: s.xp }))}</span></div>
    <div class="level-bar"><span style="width:${Math.round(s.levelFraction * 100)}%"></span></div>
    <p class="hint">${esc(t('xp.next', { n: s.xpToNext, next: s.level + 1 }))}</p>`;

  let tileIndex = 0;
  const tile = (value, label) => `<div class="stat" style="--i:${tileIndex++}"><strong>${value}</strong><span>${label}</span></div>`;
  els.stats.innerHTML =
    tile(`${num(s.read)}<small> / ${state.articles.length.toLocaleString(LANG)}</small>`, t('stat.read')) +
    tile(formatDuration(s.totalMin), t('stat.time')) +
    tile(`${num(s.streak)}<small>${esc(t('stat.best', { n: s.best }))}</small>`, t('stat.streak')) +
    tile(num(s.words), t('stat.words')) +
    tile(num(s.highlights), t('stat.hl')) +
    tile(num(s.saved), t('stat.saved')) +
    tile(num(s.quiz.done), t('stat.quiz'));
  const freezes = Number(prefs.get('freezes', 0)) || 0;
  els.freezeInfo.innerHTML = `<strong>${esc(t('freeze.count', { n: freezes }))}</strong><span>${esc(t('freeze.hint'))}</span>`;

  els.badges.innerHTML = BADGES.map((b, i) => {
    const got = unlocked[b.id];
    return `<div class="badge${got ? ' got' : ''}" style="--i:${i}" title="${esc(badgeDesc(b))}">
      <span class="badge-icon">${got ? b.icon : '🔒'}</span><strong>${esc(badgeName(b))}</strong><small>${esc(badgeDesc(b))}</small></div>`;
  }).join('');
  els.badgeCount.textContent = `${s.badgeCount} / ${BADGES.length}`;
  countUp(els.progressDlg);
}

/* ---------- Confetti ---------- */

function celebrate() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const colors = ['#f2b45a', '#8fb8ff', '#7fd6b4', '#ff8f9e', '#f0a37a', '#ffffff'];
  const parts = Array.from({ length: 110 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 13,
    vy: -Math.random() * 13 - 4,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    c: colors[(Math.random() * colors.length) | 0],
  }));
  const start = performance.now();
  const frame = (t) => {
    const age = t - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalAlpha = Math.max(0, 1 - age / 2200);
    for (const p of parts) {
      p.vy += 0.38; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.cos(p.r * 2));
      ctx.restore();
    }
    if (age < 2200) requestAnimationFrame(frame); else canvas.remove();
  };
  requestAnimationFrame(frame);
}

/* ---------- Highlights ---------- */

function highlightsAll() {
  const h = prefs.get('hl', {});
  return h && typeof h === 'object' && !Array.isArray(h) ? h : {};
}
const highlightsOf = (id) => highlightsAll()[id] || [];
function setHighlights(id, list) {
  const all = highlightsAll();
  if (list.length) all[id] = list; else delete all[id];
  prefs.set('hl', all);
}
const normText = (s) => s.replace(/\s+/g, ' ').trim();

// Wraps every stored highlight of the open article in <mark class="hl">. Works across inline tags.
function applyHighlights() {
  els.reader.querySelectorAll('mark.hl').forEach((m) => m.replaceWith(...m.childNodes));
  els.reader.normalize();
  const list = highlightsOf(state.currentId);
  if (!list.length) return;
  const blocks = els.reader.querySelectorAll('.reader-body > h2, .reader-body > p, .reader-body li');
  for (const { t } of list) {
    for (const block of blocks) if (wrapInBlock(block, t)) break;
  }
}

function wrapInBlock(block, target) {
  // Build a whitespace-collapsed copy of the block's text with a map back to text nodes.
  const map = [];
  let flat = '';
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    for (let i = 0; i < n.data.length; i++) {
      const ch = /\s/.test(n.data[i]) ? ' ' : n.data[i];
      if (ch === ' ' && flat.endsWith(' ')) continue;
      flat += ch;
      map.push([n, i]);
    }
  }
  const start = flat.indexOf(target);
  if (start < 0) return false;
  const end = start + target.length - 1;
  // Group the matched characters by text node, then wrap each node's slice (last first, so offsets stay valid).
  const segs = [];
  for (let k = start; k <= end; k++) {
    const [node, off] = map[k];
    const last = segs[segs.length - 1];
    if (last && last.node === node) last.to = off; else segs.push({ node, from: off, to: off });
  }
  for (const { node, from, to } of segs.reverse()) {
    const range = document.createRange();
    range.setStart(node, from);
    range.setEnd(node, to + 1);
    const mark = document.createElement('mark');
    mark.className = 'hl';
    mark.dataset.hl = target;
    range.surroundContents(mark);
  }
  return true;
}

const sel = { text: '', mode: '', y: 0 };

function hideSelBar() { els.selBar.hidden = true; sel.text = ''; sel.mode = ''; }

function showSelBar(rect, mode) {
  sel.mode = mode;
  sel.y = window.scrollY;
  els.selBar.querySelector('[data-sel="hl"]').textContent = mode === 'mark' ? t('sel.remove') : t('sel.hl');
  els.selBar.hidden = false;
  const barW = els.selBar.offsetWidth;
  const left = Math.min(innerWidth - barW - 8, Math.max(8, rect.left + rect.width / 2 - barW / 2));
  // Below the selection, so it doesn't fight the phone's own copy/paste menu above it.
  let top = rect.bottom + 12;
  if (top + 56 > innerHeight) top = rect.top - 60;
  top = Math.min(innerHeight - 64, Math.max(64, top)); // always on screen
  els.selBar.style.left = left + 'px';
  els.selBar.style.top = top + 'px';
}

let selTimer;
function onSelectionChange() {
  clearTimeout(selTimer);
  selTimer = setTimeout(() => {
    if (els.readerView.hidden || sel.mode === 'mark') return;
    const s = getSelection();
    if (!s || s.isCollapsed || !s.rangeCount) { hideSelBar(); return; }
    const range = s.getRangeAt(0);
    const body = els.reader.querySelector('.reader-body');
    if (!body || !body.contains(range.commonAncestorContainer)) { hideSelBar(); return; }
    // Keep highlights within one paragraph so they can be found again reliably.
    const block = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement)
      .closest('.reader-body > h2, .reader-body > p, .reader-body li');
    let text = normText(s.toString());
    if (block && !block.contains(range.endContainer)) {
      const blockText = normText(block.textContent);
      const head = text.split(' ').slice(0, 4).join(' ');
      const at = blockText.indexOf(head);
      text = at >= 0 ? blockText.slice(at) : text;
    }
    if (text.length < 3 || text.length > 700) { hideSelBar(); return; }
    sel.text = text;
    showSelBar(range.getBoundingClientRect(), 'select');
  }, 180);
}

function addHighlight(text) {
  const id = state.currentId;
  if (!id || !text) return;
  const list = highlightsOf(id);
  if (!list.some((h) => h.t === text)) list.push({ t: text, at: Date.now() });
  setHighlights(id, list);
  getSelection().removeAllRanges();
  applyHighlights();
  checkBadges();
}

function removeHighlight(text) {
  setHighlights(state.currentId, highlightsOf(state.currentId).filter((h) => h.t !== text));
  applyHighlights();
}

/* ---------- Quote cards (shareable images) ---------- */

const appUrl = () => (NATIVE ? PLAY_URL : location.origin + location.pathname.replace(/index\.html$/, ''));

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1]);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

// One share path for text, links and files. Returns 'shared', 'cancelled', 'failed' or 'unsupported'.
async function shareOut({ title = 'Digest', text = '', url, blob, name }) {
  if (NATIVE && Plug.Share) {
    try {
      const opts = { title, text, dialogTitle: title };
      if (url) opts.url = url;
      if (blob) {
        const res = await Plug.Filesystem.writeFile({ path: name, data: await blobToBase64(blob), directory: 'CACHE' });
        opts.files = [res.uri];
      }
      await Plug.Share.share(opts);
      return 'shared';
    } catch (err) {
      return /cancel/i.test(String(err?.message || err)) ? 'cancelled' : 'failed';
    }
  }
  const file = blob ? new File([blob], name, { type: blob.type || 'application/octet-stream' }) : null;
  if (navigator.share && (!file || navigator.canShare?.({ files: [file] }))) {
    try {
      await navigator.share(file ? { files: [file], text, title } : { title, text, ...(url ? { url } : {}) });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
    }
  }
  return 'unsupported';
}

// Image cards: share them, or save them when sharing isn't possible.
async function shareImage(blob, name, text, title) {
  const r = await shareOut({ title, text, blob, name });
  if (r === 'shared') { bumpEvent('shares'); return; }
  if (r === 'cancelled') return;
  if (NATIVE) { toast(t('quote.fail')); return; }
  downloadBlob(blob, name);
  bumpEvent('shares');
  toast(t('quote.saved'));
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

async function makeQuoteCard(quote, a) {
  const W = 1080, H = 1350, PAD = 96;
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, v('--surface'));
  g.addColorStop(1, v('--surface-2'));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = v('--accent');
  ctx.fillRect(0, 0, W, 14);

  const serif = 'Georgia, "Iowan Old Style", "Times New Roman", "Noto Naskh Arabic", "Noto Serif Devanagari", serif';
  const sans = '-apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Arabic", "Noto Sans Devanagari", Helvetica, Arial, sans-serif';
  ctx.fillStyle = v('--accent');
  ctx.font = `bold 220px ${serif}`;
  ctx.fillText('“', PAD - 20, 300);

  // Largest font size that fits the quote in the middle area.
  const q = quote.length > 420 ? quote.slice(0, 417).replace(/\s+\S*$/, '') + '…' : quote;
  let size = 76, lines;
  for (; size >= 34; size -= 4) {
    ctx.font = `600 ${size}px ${serif}`;
    lines = wrapLines(ctx, q, W - PAD * 2);
    if (lines.length * size * 1.35 <= 680) break;
  }
  ctx.fillStyle = v('--text');
  const lh = size * 1.35;
  let y = 340 + size;
  const rtlQuote = isRtlText(q);
  ctx.direction = rtlQuote ? 'rtl' : 'ltr';
  ctx.textAlign = rtlQuote ? 'right' : 'left';
  for (const l of lines) { ctx.fillText(l, rtlQuote ? W - PAD : PAD, y); y += lh; }

  ctx.fillStyle = v('--text-2');
  ctx.font = `500 36px ${sans}`;
  const rtlTitle = isRtlText(a.title);
  ctx.direction = rtlTitle ? 'rtl' : 'ltr';
  ctx.textAlign = rtlTitle ? 'right' : 'left';
  const titleLines = wrapLines(ctx, '— ' + a.title, W - PAD * 2).slice(0, 2);
  y += 30;
  for (const l of titleLines) { ctx.fillText(l, rtlTitle ? W - PAD : PAD, y); y += 48; }
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';

  ctx.fillStyle = v('--border');
  ctx.fillRect(PAD, H - 200, W - PAD * 2, 2);
  ctx.fillStyle = v('--accent');
  ctx.font = `800 52px ${sans}`;
  ctx.fillText('Digest', PAD, H - 118);
  ctx.fillStyle = v('--text-3');
  ctx.font = `500 30px ${sans}`;
  ctx.direction = (I18N[LANG]._dir || 'ltr');
  ctx.textAlign = ctx.direction === 'rtl' ? 'right' : 'left';
  ctx.fillText(t('card.free'), ctx.direction === 'rtl' ? W - PAD : PAD, H - 72);
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  const host = location.host;
  if (host) {
    ctx.textAlign = 'right';
    ctx.fillText(host, W - PAD, H - 118);
    ctx.textAlign = 'left';
  }
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

async function shareQuote(quote) {
  const a = currentArticle();
  if (!a || !quote) return;
  const blob = await makeQuoteCard(quote, a);
  if (!blob) { toast(t('quote.fail')); return; }
  const text = `“${quote.length > 200 ? quote.slice(0, 197) + '…' : quote}” — ${a.title}\n\n${t('share.quote')} ${appUrl()}`;
  await shareImage(blob, 'digest-quote.png', text, a.title);
}

function downloadBlob(blob, name) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

async function shareText(text) {
  const full = `${text} ${appUrl()}`;
  const r = await shareOut({ title: 'Digest', text: full });
  if (r === 'shared') bumpEvent('shares');
  else if (r !== 'cancelled') { await copyText(full, t('linkCopied')); bumpEvent('shares'); }
}

const inviteFriends = () => shareText(t('share.invite'));

/* ---------- Your region ----------
 * Works offline: the country comes from the phone's time zone (then its language setting),
 * and stories tagged with that country or its wider region rank a little higher. */

const REGION_GROUPS = {
  gulf: 'SA AE QA KW BH OM',
  'middle-east': 'SA AE QA KW BH OM YE IQ IR SY LB JO IL PS TR EG',
  'north-africa': 'EG LY TN DZ MA SD',
  europe: 'GB IE FR DE ES PT IT NL BE LU CH AT PL CZ SK HU RO BG GR SE NO DK FI IS EE LV LT UA BY MD RS HR SI BA ME MK AL CY MT RU',
  'north-america': 'US CA MX',
  'latin-america': 'MX GT SV HN NI CR PA CU DO HT JM CO VE EC PE BO CL AR UY PY BR',
  africa: 'NG GH KE ET TZ UG ZA SD SS SO CD CM SN CI ML NE BF TD ZW ZM MZ AO RW EG LY TN DZ MA',
  'south-asia': 'IN PK BD LK NP AF',
  'east-asia': 'CN JP KR KP TW HK MN',
  'southeast-asia': 'ID MY SG TH VN PH MM KH LA',
  'central-asia': 'KZ UZ TM KG TJ',
  oceania: 'AU NZ',
};
const EU_MEMBERS = 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE';
const TIMEZONE_COUNTRY = {
  'Asia/Riyadh': 'SA', 'Asia/Dubai': 'AE', 'Asia/Qatar': 'QA', 'Asia/Kuwait': 'KW', 'Asia/Bahrain': 'BH', 'Asia/Muscat': 'OM',
  'Asia/Aden': 'YE', 'Asia/Baghdad': 'IQ', 'Asia/Tehran': 'IR', 'Asia/Damascus': 'SY', 'Asia/Beirut': 'LB', 'Asia/Amman': 'JO',
  'Asia/Jerusalem': 'IL', 'Asia/Gaza': 'PS', 'Asia/Hebron': 'PS', 'Europe/Istanbul': 'TR', 'Africa/Cairo': 'EG',
  'Africa/Tripoli': 'LY', 'Africa/Tunis': 'TN', 'Africa/Algiers': 'DZ', 'Africa/Casablanca': 'MA', 'Africa/Khartoum': 'SD',
  'Africa/Lagos': 'NG', 'Africa/Accra': 'GH', 'Africa/Nairobi': 'KE', 'Africa/Addis_Ababa': 'ET', 'Africa/Johannesburg': 'ZA',
  'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Europe/Madrid': 'ES',
  'Europe/Lisbon': 'PT', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Zurich': 'CH',
  'Europe/Vienna': 'AT', 'Europe/Warsaw': 'PL', 'Europe/Prague': 'CZ', 'Europe/Budapest': 'HU', 'Europe/Bucharest': 'RO',
  'Europe/Athens': 'GR', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI',
  'Europe/Kiev': 'UA', 'Europe/Kyiv': 'UA', 'Europe/Moscow': 'RU', 'America/New_York': 'US', 'America/Chicago': 'US',
  'America/Denver': 'US', 'America/Los_Angeles': 'US', 'America/Phoenix': 'US', 'America/Anchorage': 'US', 'Pacific/Honolulu': 'US',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Mexico_City': 'MX', 'America/Bogota': 'CO', 'America/Lima': 'PE',
  'America/Santiago': 'CL', 'America/Argentina/Buenos_Aires': 'AR', 'America/Sao_Paulo': 'BR', 'America/Caracas': 'VE',
  'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD', 'Asia/Colombo': 'LK', 'Asia/Kathmandu': 'NP',
  'Asia/Kabul': 'AF', 'Asia/Shanghai': 'CN', 'Asia/Hong_Kong': 'HK', 'Asia/Taipei': 'TW', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR',
  'Asia/Jakarta': 'ID', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Singapore': 'SG', 'Asia/Bangkok': 'TH', 'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Manila': 'PH', 'Asia/Almaty': 'KZ', 'Asia/Tashkent': 'UZ', 'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU',
  'Australia/Perth': 'AU', 'Pacific/Auckland': 'NZ',
};
const ALL_COUNTRIES = [...new Set(Object.values(REGION_GROUPS).join(' ').split(' '))];

function detectCountry() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TIMEZONE_COUNTRY[tz]) return TIMEZONE_COUNTRY[tz];
  } catch { /* ignore */ }
  for (const tag of navigator.languages || [navigator.language || '']) {
    const m = String(tag).match(/-([A-Za-z]{2})\b/);
    if (m && ALL_COUNTRIES.includes(m[1].toUpperCase())) return m[1].toUpperCase();
  }
  return '';
}

const userRegion = { cc: '', groups: [] };
function applyRegion() {
  const cc = state.settings.region || detectCountry();
  userRegion.cc = cc;
  userRegion.groups = Object.entries(REGION_GROUPS).filter(([, list]) => list.split(' ').includes(cc)).map(([g]) => g);
  if (EU_MEMBERS.split(' ').includes(cc)) userRegion.groups.push('EU');
}

function countryName(cc) {
  try { return new Intl.DisplayNames([LANG], { type: 'region' }).of(cc) || cc; } catch { return cc; }
}

// 2 = about the user's country, 1 = about their wider region, 0 = elsewhere.
function regionMatch(a) {
  if (!userRegion.cc || !a.regions?.length) return 0;
  if (a.regions.includes(userRegion.cc)) return 2;
  return userRegion.groups.some((g) => a.regions.includes(g)) ? 1 : 0;
}

// "For you": newest first, but local stories count as ~3 days newer (country) or ~1.5 days (region),
// and favourite topics ~1 day. Enough to lift local news without hiding the rest of the world.
function forYouRank(a) {
  const day = a.date ? Date.parse(a.date) / 86400000 : 0;
  const m = regionMatch(a);
  return day + (m === 2 ? 3 : m === 1 ? 1.5 : 0) + (state.settings.topics.includes(a.category) ? 1 : 0) - (a.evergreen ? 5 : 0); // timeless guides sit behind fresh news
}

function renderRegionSelect() {
  const auto = detectCountry();
  const names = ALL_COUNTRIES.map((cc) => [cc, countryName(cc)]).sort((x, y) => x[1].localeCompare(y[1], LANG));
  els.regionSelect.innerHTML =
    `<option value="">${esc(auto ? t('region.auto', { name: countryName(auto) }) : t('region.autoNone'))}</option>` +
    names.map(([cc, name]) => `<option value="${cc}">${esc(name)}</option>`).join('');
  els.regionSelect.value = state.settings.region;
}

/* ---------- Quizzes ("Test yourself") ---------- */

function quizAll() {
  const q = prefs.get('quiz', {});
  return q && typeof q === 'object' && !Array.isArray(q) ? q : {};
}
const quizAnswers = (id) => (Array.isArray(quizAll()[id]) ? quizAll()[id] : []);

function quizStats() {
  let done = 0, perfect = 0, correct = 0;
  for (const [id, answers] of Object.entries(quizAll())) {
    const a = state.byId.get(id);
    if (!a?.quiz?.length || !Array.isArray(answers)) continue;
    const right = a.quiz.filter((q, i) => answers[i] === q.answer).length;
    correct += right;
    if (a.quiz.every((_, i) => Number.isInteger(answers[i]))) {
      done++;
      if (right === a.quiz.length) perfect++;
    }
  }
  return { done, perfect, correct };
}

function quizFeedback(q, chosen) {
  const ok = chosen === q.answer;
  return `${ok ? '✅ ' + esc(t('quiz.correct')) : '❌ ' + esc(t('quiz.wrong'))} ${esc(q.explain || '')}`;
}

function renderQuiz(a) {
  if (!a.quiz?.length) return '';
  const answers = quizAnswers(a.id);
  const items = a.quiz.map((q, qi) => {
    const chosen = answers[qi];
    const done = Number.isInteger(chosen);
    const opts = q.options.map((o, oi) => {
      const cls = done ? (oi === q.answer ? ' right' : oi === chosen ? ' wrong' : ' dim') : '';
      return `<button type="button" class="opt${cls}" data-qi="${qi}" data-oi="${oi}" ${done ? 'disabled' : ''} dir="auto">${esc(o)}</button>`;
    }).join('');
    return `<div class="quiz-q" data-q="${qi}">
      <p class="q" dir="auto"><span class="qn">${qi + 1}</span>${esc(q.q)}</p>
      <div class="opts">${opts}</div>
      <p class="explain" dir="auto" ${done ? '' : 'hidden'}>${done ? quizFeedback(q, chosen) : ''}</p>
    </div>`;
  }).join('');
  return `<section class="quiz" aria-label="${esc(t('quiz.title'))}">
    <h2>🧠 ${esc(t('quiz.title'))}</h2>
    <p class="quiz-hint">${esc(t('quiz.hint'))}</p>
    ${items}
    <p class="quiz-score" aria-live="polite">${quizScoreText(a)}</p>
  </section>`;
}

function quizScoreText(a) {
  const answers = quizAnswers(a.id);
  if (!a.quiz.every((_, i) => Number.isInteger(answers[i]))) return '';
  const right = a.quiz.filter((q, i) => answers[i] === q.answer).length;
  return esc(right === a.quiz.length ? t('quiz.perfect') : t('quiz.score', { n: right, total: a.quiz.length }));
}

function answerQuiz(qi, oi) {
  const a = currentArticle();
  if (!a?.quiz?.[qi]) return;
  const all = quizAll();
  const answers = Array.isArray(all[a.id]) ? all[a.id] : [];
  if (Number.isInteger(answers[qi])) return; // already answered
  answers[qi] = oi;
  all[a.id] = answers;
  prefs.set('quiz', all);

  const q = a.quiz[qi];
  const box = els.reader.querySelector(`.quiz-q[data-q="${qi}"]`);
  box.querySelectorAll('.opt').forEach((b, i) => {
    b.disabled = true;
    b.classList.add(i === q.answer ? 'right' : i === oi ? 'wrong' : 'dim');
  });
  const ex = box.querySelector('.explain');
  ex.innerHTML = quizFeedback(q, oi);
  ex.hidden = false;
  buzz(oi === q.answer ? 15 : [10, 40, 10]);

  const score = els.reader.querySelector('.quiz-score');
  score.innerHTML = quizScoreText(a);
  if (score.textContent) {
    const right = a.quiz.filter((x, i) => answers[i] === x.answer).length;
    if (right === a.quiz.length) celebrate();
    replay(score, 'pop');
    markRead(a.id);
    checkBadges();
    renderGoalPill();
  }
}

/* ---------- Ads (Android app only) ----------
 * Light by design: one small banner, only when the reader reaches the end of an article.
 * Never pop-ups, never during quizzes or read-aloud, never offline, never in the first days,
 * and a short video turns ads off for 24 hours. The website has no ads. */

const ADS = {
  // TEST IDs from Google. Replace with your own AdMob ad unit IDs before publishing.
  banner: 'ca-app-pub-3940256099942544/9214589741',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
  testing: true,
  graceDays: 3,
  adFreeHours: 24,
};
const ad = { ready: false, created: false, visible: false, privacy: false, endSeen: false, quizSeen: false, observer: null };

async function initAds() {
  if (!NATIVE || !Plug.AdMob) return;
  if (!prefs.get('firstSeen', 0)) prefs.set('firstSeen', Date.now());
  els.adsSec.hidden = false;
  try {
    let info = await Plug.AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === 'REQUIRED') info = await Plug.AdMob.showConsentForm();
    ad.privacy = info.privacyOptionsRequirementStatus === 'REQUIRED';
    if (!info.canRequestAds) { renderAdUi(); return; }
    await Plug.AdMob.initialize({ initializeForTesting: ADS.testing });
    ad.ready = true;
    Plug.AdMob.addListener('bannerAdSizeChanged', (size) => {
      document.documentElement.style.setProperty('--ad-h', `${Math.max(0, size?.height || 0)}px`);
    });
    Plug.AdMob.addListener('onRewardedVideoAdReward', grantAdFree);
  } catch (err) {
    console.warn('Ads unavailable:', err);
  }
  renderAdUi();
}

const adFreeUntil = () => Number(prefs.get('adFreeUntil', 0)) || 0;

function adsAllowed() {
  return ad.ready && navigator.onLine
    && Date.now() - Number(prefs.get('firstSeen', Date.now())) > ADS.graceDays * 86400000
    && Date.now() > adFreeUntil();
}

// Called whenever something that affects the banner changes.
function updateBanner() {
  if (!NATIVE || !ad.ready) return;
  const want = adsAllowed() && !els.readerView.hidden && ad.endSeen && !ad.quizSeen && !tts.on
    && !document.querySelector('dialog[open]');
  if (want === ad.visible) return;
  ad.visible = want;
  document.body.classList.toggle('ad-on', want);
  if (want) {
    const p = ad.created ? Plug.AdMob.resumeBanner()
      : Plug.AdMob.showBanner({ adId: ADS.banner, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0, isTesting: ADS.testing });
    ad.created = true;
    p.catch(() => { ad.visible = false; document.body.classList.remove('ad-on'); });
  } else {
    Plug.AdMob.hideBanner().catch(() => {});
  }
}

// Watches the end of the open article (and its quiz) to decide when the banner may appear.
function watchArticleForAds() {
  if (!NATIVE) return;
  ad.observer?.disconnect();
  ad.endSeen = false;
  ad.quizSeen = false;
  updateBanner();
  if (!ad.ready || !('IntersectionObserver' in window)) return;
  ad.observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.target.classList.contains('reader-end')) ad.endSeen = e.isIntersecting;
      if (e.target.classList.contains('quiz')) ad.quizSeen = e.isIntersecting;
    }
    updateBanner();
  });
  els.reader.querySelectorAll('.reader-end, .quiz').forEach((el) => ad.observer.observe(el));
}

async function watchForAdFree() {
  if (!ad.ready) { toast(t('ads.none')); return; }
  els.adFreeBtn.disabled = true;
  try {
    await Plug.AdMob.prepareRewardVideoAd({ adId: ADS.rewarded, isTesting: ADS.testing });
    await Plug.AdMob.showRewardVideoAd();
  } catch {
    toast(t('ads.none'));
  }
  els.adFreeBtn.disabled = false;
}

function grantAdFree() {
  prefs.set('adFreeUntil', Date.now() + ADS.adFreeHours * 3600000);
  updateBanner();
  renderAdUi();
  celebrate();
  toast(t('ads.thanks'));
}

function renderAdUi() {
  if (!NATIVE) return;
  const until = adFreeUntil();
  if (Date.now() < until) {
    const time = new Intl.DateTimeFormat(LANG, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(until));
    els.adFreeBtn.textContent = t('ads.freeOn', { time });
    els.adFreeBtn.disabled = true;
  } else {
    els.adFreeBtn.textContent = t('ads.free');
    els.adFreeBtn.disabled = !ad.ready;
  }
  els.adPrivacyBtn.hidden = !ad.privacy;
}

/* ---------- Related articles ---------- */

function relatedArticles(a, excludeId, limit = 3) {
  const tags = new Set(a.tags.map((x) => x.toLowerCase()));
  const words = new Set(tokenize(a.title).filter((w) => w.length > 3));
  const scored = [];
  for (const b of state.articles) {
    if (b.id === a.id || b.id === excludeId) continue;
    let score = 0;
    for (const tag of b.tags) if (tags.has(tag.toLowerCase())) score += 3;
    for (const w of tokenize(b.title)) if (words.has(w)) score += 2;
    if (b.category === a.category) score += 1;
    if (isRead(b.id)) score -= 1.5; // prefer things not read yet
    if (score >= 2) scored.push([score, b]);
  }
  return scored.sort((x, y) => y[0] - x[0]).slice(0, limit).map(([, b]) => b);
}

/* ---------- Language helpers ---------- */

// Picks a speech language from the text itself, so English articles stay English even in an Arabic UI.
function guessLang(text) {
  if (/[\u0600-\u06ff]/.test(text)) return 'ar';
  if (/[\u0900-\u097f]/.test(text)) return 'hi';
  const sample = ` ${text.toLowerCase().slice(0, 600)} `;
  const hits = (words) => words.reduce((n, w) => n + (sample.split(` ${w} `).length - 1), 0);
  const scores = {
    en: hits(['the', 'and', 'of', 'to', 'is', 'in', 'that']),
    es: hits(['el', 'la', 'de', 'que', 'y', 'los', 'es', 'por']),
    fr: hits(['le', 'la', 'les', 'de', 'et', 'des', 'est', 'une']),
    pt: hits(['o', 'a', 'de', 'que', 'e', 'os', 'não', 'uma', 'com']),
  };
  const best = Object.entries(scores).sort((x, y) => y[1] - x[1])[0];
  return best[1] > 0 ? best[0] : 'en';
}

const isRtlText = (text) => /[\u0590-\u08ff]/.test(text);

function renderLibStats() {
  els.libStats.textContent = t('lib.stats', { n: state.articles.length }) + (store.ok ? '' : ' ' + t('lib.temp'));
}

function renderNoteCats() {
  const cur = els.noteCat.value;
  els.noteCat.innerHTML = CATEGORIES.slice(1).map((c) => `<option value="${esc(c)}">${esc(catName(c))}</option>`).join('');
  if (cur) els.noteCat.value = cur;
}

function applyLanguage() {
  LANG = pickLanguage(state.settings.lang);
  document.documentElement.lang = LANG;
  document.documentElement.dir = I18N[LANG]._dir || 'ltr';
  dateFmt = new Intl.DateTimeFormat(LANG, { year: 'numeric', month: 'short', day: 'numeric' });
  applyI18nDom();
  document.querySelectorAll('.lang-select').forEach((sel) => {
    sel.innerHTML = Object.entries(I18N).map(([code, d]) => `<option value="${code}">${esc(d._name)}</option>`).join('');
    sel.value = LANG;
  });
  renderNoteCats();
  renderLibStats();
  renderRegionSelect();
  if (els.topics) renderTopics();
}

// Re-renders everything that shows translated text.
function relabelAll() {
  applyLanguage();
  renderList();
  renderGoalPill();
  if (state.currentId) {
    const keep = state.lastFraction;
    renderReader(state.currentId);
    applyHighlights();
    updateReadUI();
    scrollToFraction(keep);
    watchArticleForAds();
  }
  renderAdUi();
  if (els.progressDlg.open) renderProgress();
  if (tts.supported) populateVoices();
}

/* ---------- Progress card (shareable image) ---------- */

async function makeProgressCard() {
  const s = computeStats();
  const W = 1080, H = 1350, PAD = 96;
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const sans = '-apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Arabic", "Noto Sans Devanagari", Helvetica, Arial, sans-serif';
  const rtl = (I18N[LANG]._dir || 'ltr') === 'rtl';
  ctx.direction = rtl ? 'rtl' : 'ltr';

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, v('--surface'));
  g.addColorStop(1, v('--surface-2'));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = v('--accent');
  ctx.fillRect(0, 0, W, 14);

  ctx.textAlign = 'center';
  ctx.font = `200px ${sans}`;
  ctx.fillText('🔥', W / 2, 360);
  ctx.fillStyle = v('--text');
  ctx.font = `800 220px ${sans}`;
  ctx.fillText(s.streak.toLocaleString(LANG), W / 2, 600);
  ctx.fillStyle = v('--text-2');
  ctx.font = `600 54px ${sans}`;
  ctx.fillText(t('stat.streak'), W / 2, 680);

  const cols = [
    [s.read.toLocaleString(LANG), t('stat.read')],
    [s.totalMin.toLocaleString(LANG), t('stat.minutes')],
    [s.level.toLocaleString(LANG), s.levelName],
  ];
  cols.forEach(([val, label], i) => {
    const x = PAD + ((W - PAD * 2) / 3) * (i + 0.5);
    ctx.fillStyle = v('--accent');
    ctx.font = `800 84px ${sans}`;
    ctx.fillText(val, x, 860);
    ctx.fillStyle = v('--text-3');
    ctx.font = `500 32px ${sans}`;
    ctx.fillText(label, x, 910);
  });

  const unlocked = prefs.get('badges', {}) || {};
  const icons = BADGES.filter((b) => unlocked[b.id]).map((b) => b.icon).slice(0, 9).join(' ');
  if (icons) {
    ctx.font = `64px ${sans}`;
    ctx.fillText(icons, W / 2, 1040);
  }

  ctx.fillStyle = v('--border');
  ctx.fillRect(PAD, H - 200, W - PAD * 2, 2);
  ctx.fillStyle = v('--accent');
  ctx.font = `800 56px ${sans}`;
  ctx.fillText('Digest', W / 2, H - 118);
  ctx.fillStyle = v('--text-3');
  ctx.font = `500 30px ${sans}`;
  ctx.fillText(`${t('card.free')}${location.host ? ' · ' + location.host : ''}`, W / 2, H - 70);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

async function shareProgress() {
  const blob = await makeProgressCard();
  if (!blob) { toast(t('quote.fail')); return; }
  const s = computeStats();
  const text = `${t('share.progress', { streak: s.streak, level: s.level })} ${appUrl()}`;
  await shareImage(blob, 'digest-progress.png', text, 'Digest');
}

/* ---------- Today's pick ---------- */

function todaysPick(excludeId) {
  const topics = state.settings.topics;
  const unread = state.articles.filter((a) => !isRead(a.id) && a.id !== excludeId);
  const preferred = topics.length ? unread.filter((a) => topics.includes(a.category)) : unread;
  let pool = preferred.length ? preferred : unread;
  if (!pool.length) return null;
  const seed = parseInt(hash(localDay()), 36);
  const local = unread.filter((a) => regionMatch(a) > 0);
  if (local.length && seed % 2 === 0) pool = local; // local news on alternate days
  return pool[seed % pool.length];
}

function renderToday(show) {
  const cont = els.cont.querySelector('a');
  const contId = cont ? decodeURIComponent(cont.getAttribute('href').slice(4)) : null;
  const pick = show ? todaysPick(contId) : null;
  if (!pick) { els.today.innerHTML = ''; return; }
  els.today.innerHTML = `<div class="today-card">
    <a href="${articleHref(pick.id)}">
      <span class="continue-label">${t('today.pick', { n: readMinutes(pick) })}</span>
      <strong dir="auto">${esc(pick.title)}</strong>
    </a>
    <button class="dice" type="button" data-surprise aria-label="${esc(t('surprise'))}">🎲</button>
  </div>`;
}

function surpriseMe() {
  const unread = state.articles.filter((a) => !isRead(a.id));
  const pool = unread.length ? unread : state.articles;
  if (!pool.length) return;
  const a = pool[(Math.random() * pool.length) | 0];
  state.openedFromList = true;
  location.hash = articleHref(a.id);
}

/* ---------- Welcome (first launch) ---------- */

function renderTopics() {
  els.topics.innerHTML = CATEGORIES.slice(1).map((c) =>
    `<button type="button" class="topic" data-topic="${esc(c)}" aria-pressed="${state.settings.topics.includes(c)}">${esc(catName(c))}</button>`).join('');
}

function maybeWelcome() {
  if (prefs.get('onboarded', false)) return;
  renderTopics();
  renderSettingsUI();
  els.welcome.showModal();
}

/* ---------- Routing (#/a/<id> opens the reader) ---------- */

function leaveArticle() {
  if (NATIVE) { ad.observer?.disconnect(); ad.endSeen = false; ad.quizSeen = false; }
  if (!state.currentId) return;
  persistProgress(true);
  ttsStop();
  releaseWakeLock();
  state.currentId = null;
}

function openArticle(id) {
  const found = renderReader(id);
  els.listView.hidden = true;
  els.readerView.hidden = false;
  if (!reducedMotion()) replay(els.reader, 'reader-in');
  applyReaderStyle();
  window.scrollTo(0, 0);
  els.progress.style.width = '0%';
  if (!found) { state.currentId = null; return; }

  const resumeAt = progressOf(id);
  state.currentId = id;
  state.lastFraction = 0;
  user.set(id, { o: Date.now() });
  markActive();
  hideSelBar();
  applyHighlights();
  updateReadUI();
  watchArticleForAds();
  requestWakeLock();

  if (resumeAt > 0 && resumeAt < READ_AT) {
    // Wait for layout so the scroll height is final.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (state.currentId !== id) return;
      scrollToFraction(resumeAt);
      toast(t('resumed', { p: Math.round(resumeAt * 100) }), t('startOver'), () => {
        user.set(id, { p: null });
        window.scrollTo(0, 0);
        els.toast.hidden = true;
      });
    }));
  } else {
    requestAnimationFrame(updateProgress);
  }
}

function route() {
  const m = location.hash.match(/^#\/a\/(.+)$/);
  if (m) {
    if (!els.listView.hidden) state.listScroll = window.scrollY;
    let id;
    try { id = decodeURIComponent(m[1]); } catch { id = m[1]; }
    if (state.currentId !== id) leaveArticle();
    openArticle(id);
  } else {
    const wasReading = !els.readerView.hidden;
    leaveArticle();
    hideSelBar();
    els.readerView.hidden = true;
    els.listView.hidden = false;
    document.title = 'Offline Digest';
    state.openedFromList = false;
    if (wasReading) {
      replay(els.listView, 'fade-in');
      renderList(); // reflect saved / read / progress changes
      requestAnimationFrame(() => window.scrollTo(0, state.listScroll));
    }
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

/* ---------- Article actions ---------- */

function currentArticle() { return state.currentId ? state.byId.get(state.currentId) : null; }

function plainText(a) {
  return `${a.title}\n\n${flatten(a.body.replace(/\n{2,}/g, '\u0000')).replace(/\u0000/g, '\n\n')}${a.url ? `\n\n${a.url}` : ''}`;
}

async function copyText(text, done = t('copied')) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    toast(t('copyNA'));
  }
}

async function shareArticle(a) {
  const data = a.url
    ? { title: a.title, text: `${a.title}\n\n${flatten(a.body).slice(0, 280)}…`, url: a.url }
    : { title: a.title, text: plainText(a).slice(0, 20000) };
  const r = await shareOut(data);
  if (r === 'failed' || r === 'unsupported') copyText(plainText(a), t('shareNA'));
}

async function deleteArticle(a) {
  if (!confirm(t('del.confirm', { title: a.title }))) return;
  const snapshot = { article: a, user: user.get(a.id) };
  els.actions.close();
  leaveArticle();
  await store.remove(a.id);
  user.remove(a.id);
  tombstones.add(a.id);
  setArticles(await store.all());
  goBack();
  renderList();
  toast(t('del.done'), t('undo'), async () => {
    await store.putMany([snapshot.article]);
    tombstones.removeMany([snapshot.article.id]);
    user.set(snapshot.article.id, snapshot.user);
    setArticles(await store.all());
    renderList();
    els.toast.hidden = true;
  });
}

function toggleSaved() {
  const id = state.currentId;
  if (!id) return;
  const now = !isSaved(id);
  user.set(id, { s: now ? Date.now() : null });
  updateReadUI();
  popEl(els.save);
  buzz(10);
  toast(now ? t('saved.on') : t('saved.off'));
}

/* ---------- Import / sync / backup ---------- */

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
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, actionLabel ? 8000 : 3200);
}

async function saveItems(items, fromUser) {
  // User imports are never overwritten by updates to the bundled articles.json.
  items.forEach((a) => { a.userImported = fromUser; });
  const fresh = items.filter((a) => !state.byId.has(a.id)).length;
  await store.putMany(items);
  if (fromUser) tombstones.removeMany(items.map((a) => a.id));
  setArticles(await store.all());
  renderList();
  return fresh;
}

async function importText(text, label, fromUser = true) {
  setStatus(t('imp.working'));
  try {
    const { items, backup } = parsePayload(text);
    const fresh = await saveItems(items, fromUser);
    if (backup) {
      user.merge(backup.user);
      if (Array.isArray(backup.days)) {
        const days = new Set([...prefs.get('days', []), ...backup.days.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))]);
        prefs.set('days', [...days].sort().slice(-400));
      }
      restoreExtras(backup);
      renderList();
    }
    const msg = backup
      ? t('imp.backup', { n: items.length, fresh })
      : t('imp.done', { n: items.length, fresh, label });
    setStatus(msg, 'ok');
    toast(msg);
    return true;
  } catch (err) {
    setStatus(err.message || t('err.failed'), 'error');
    return false;
  }
}

// Merges habit data from a backup without ever lowering what this phone already has.
function restoreExtras(b) {
  const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
  if (isObj(b.highlights)) {
    const all = highlightsAll();
    for (const [id, list] of Object.entries(b.highlights)) {
      if (!Array.isArray(list)) continue;
      const cur = all[id] || [];
      for (const h of list) if (h && typeof h.t === 'string' && !cur.some((c) => c.t === h.t)) cur.push({ t: h.t.slice(0, 700), at: Number(h.at) || Date.now() });
      if (cur.length) all[id] = cur;
    }
    prefs.set('hl', all);
  }
  if (isObj(b.log)) {
    const log = readingLog();
    for (const [d, secs] of Object.entries(b.log)) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(secs)) log[d] = Math.max(log[d] || 0, secs);
    prefs.set('log', log);
  }
  if (Array.isArray(b.goalDays)) {
    prefs.set('goalDays', [...new Set([...prefs.get('goalDays', []), ...b.goalDays.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))])].sort().slice(-400));
  }
  if (isObj(b.badges)) {
    const mine = prefs.get('badges', {}) || {};
    for (const bd of BADGES) if (Number.isFinite(b.badges[bd.id]) && !mine[bd.id]) mine[bd.id] = b.badges[bd.id];
    prefs.set('badges', mine);
  }
  if (isObj(b.ev)) {
    const ev = events();
    for (const k of Object.keys(ev)) if (Number.isFinite(b.ev[k])) ev[k] = Math.max(ev[k], b.ev[k]);
    prefs.set('ev', ev);
  }
  if (isObj(b.quiz)) {
    const mine = quizAll();
    for (const [id, ans] of Object.entries(b.quiz)) if (Array.isArray(ans) && !mine[id]) mine[id] = ans.map((x) => (Number.isInteger(x) ? x : null));
    prefs.set('quiz', mine);
  }
  if (Number.isFinite(b.totalSecs)) prefs.set('totalSecs', Math.max(Number(prefs.get('totalSecs', 0)) || 0, b.totalSecs));
  renderGoalPill();
}

// articles.json can be a plain array, or { "articles": [...], "removed": ["id", ...] }.
async function fetchSeedFull(options, url = SEED_URL) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) return { items: [], removed: [] };
    const text = await res.text();
    const { items } = parsePayload(text);
    let removed = [];
    try { const data = JSON.parse(text); if (Array.isArray(data?.removed)) removed = data.removed.map(String); } catch { /* XML */ }
    return { items, removed };
  } catch { return { items: [], removed: [] }; }
}
async function fetchSeed(options) { return (await fetchSeedFull(options)).items; }

// Adds new articles from the bundled articles.json and refreshes bundled ones whose text changed.
// Articles the user imported themselves, or deleted, are left alone.
async function mergeNewSeedArticles() {
  const { items: seed, removed } = await fetchSeedFull({ cache: 'no-store' }, NATIVE ? REMOTE_SEED_URL : SEED_URL);
  // Retire bundled articles the publisher removed (never the user's own imports).
  const retire = removed.filter((id) => state.byId.has(id) && !state.byId.get(id).userImported);
  for (const id of retire) await store.remove(id);
  if (retire.length) { setArticles(await store.all()); if (els.readerView.hidden) renderList(); }
  const deleted = tombstones.get();
  const changed = seed.filter((a) => {
    if (deleted.has(a.id)) return false;
    const old = state.byId.get(a.id);
    return !old || (!old.userImported && (old.title !== a.title || old.body !== a.body || old.category !== a.category));
  });
  if (!changed.length) return;
  changed.forEach((a) => { a.importedAt = state.byId.get(a.id)?.importedAt || a.importedAt; });
  await store.putMany(changed);
  setArticles(await store.all());
  if (els.readerView.hidden) renderList();
  toast(t('seed.updated', { n: changed.length }));
}

async function resetLibrary() {
  if (!confirm(t('reset.confirm'))) return;
  await store.clear();
  tombstones.clear();
  const seed = await fetchSeed();
  if (seed.length) await store.putMany(seed);
  setArticles(await store.all());
  renderList();
  setStatus(t('reset.done', { n: state.articles.length }), 'ok');
}

function exportBackup() {
  const data = {
    app: 'offline-digest',
    version: 2,
    exportedAt: new Date().toISOString(),
    articles: state.articles.map(({ words, ...a }) => a),
    user: user.data,
    days: prefs.get('days', []),
    highlights: highlightsAll(),
    log: readingLog(),
    goalDays: prefs.get('goalDays', []),
    badges: prefs.get('badges', {}),
    ev: events(),
    totalSecs: prefs.get('totalSecs', 0),
    quiz: quizAll(),
  };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const name = `digest-backup-${localDay()}.json`;
  if (NATIVE) {
    // Android: hand the file to the share sheet so it can go to Drive, Files, email...
    shareOut({ title: name, blob, name }).then((r) => {
      if (r === 'failed') setStatus(t('err.failed'), 'error');
      else if (r === 'shared') setStatus(t('export.done', { n: state.articles.length }), 'ok');
    });
    return;
  }
  downloadBlob(blob, name);
  setStatus(t('export.done', { n: state.articles.length }), 'ok');
}

async function saveNote() {
  const title = els.noteTitle.value.trim();
  const body = els.noteBody.value.trim();
  if (!title && !body) { setStatus(t('note.empty'), 'error'); return; }
  const note = normalize({
    id: 'n-' + Date.now().toString(36),
    title,
    body,
    category: els.noteCat.value,
    source: t('note.source'),
    tags: ['note'],
    date: new Date().toISOString(),
  });
  await saveItems([note], true);
  els.noteTitle.value = '';
  els.noteBody.value = '';
  bumpEvent('notes');
  setStatus(t('note.saved'), 'ok');
  toast(t('note.saved'), t('open'), () => {
    els.dialog.close();
    state.openedFromList = true;
    location.hash = articleHref(note.id);
  });
}

// Android share sheet → Digest (manifest share_target). Saves the shared text or link offline.
async function handleIncomingShare(params) {
  const sharedTitle = clean(params.get('share_title'));
  let text = (params.get('share_text') || '').replace(/\r\n?/g, '\n').trim();
  let url = safeUrl(params.get('share_url'));
  if (!sharedTitle && !text && !url) return null;

  if (!url) {
    const m = text.match(/https?:\/\/[^\s<>"]+/);
    if (m) { url = safeUrl(m[0]); text = text.replace(m[0], '').trim(); }
  }
  let host = '';
  try { host = url ? new URL(url).hostname.replace(/^www\./, '') : ''; } catch { /* ignore */ }
  const firstLine = clean(text.split('\n')[0]);
  const title = sharedTitle || (firstLine.length <= 100 ? firstLine : firstLine.slice(0, 90) + '…') || host || t('shared.item');
  let body = text === title ? '' : text;
  if (!body) body = url ? t('shared.body', { host }) : title;

  const item = normalize({ id: 's-' + hash(`${url}|${title}|${body.slice(0, 200)}`), title, body, url, source: host || 'Shared', tags: ['shared'], date: new Date().toISOString() });
  await saveItems([item], true);
  user.set(item.id, { s: Date.now() });
  return item;
}

function updateNetStatus() {
  const online = navigator.onLine;
  els.net.hidden = online;
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
    if (e.key === 'Enter') els.search.blur(); // dismiss the on-screen keyboard
    if (e.key === 'Escape') els.clearSearch.click();
  });
  els.clearSearch.addEventListener('click', () => {
    els.search.value = '';
    els.clearSearch.hidden = true;
    state.query = '';
    renderList();
    els.search.focus();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !els.listView.hidden && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)
        && !document.querySelector('dialog[open]')) {
      e.preventDefault();
      els.search.focus();
    }
  });

  els.tabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    state.category = tab.dataset.cat;
    state.animateList = true;
    prefs.set('category', state.category);
    renderList();
    const on = els.tabs.querySelector(`[data-cat="${CSS.escape(state.category)}"]`);
    if (on) { on.classList.add('just-on'); on.scrollIntoView({ inline: 'nearest', block: 'nearest' }); }
  });

  els.filter.addEventListener('change', () => {
    state.filter = els.filter.value;
    state.animateList = true;
    prefs.set('filter', state.filter);
    renderList();
    window.scrollTo(0, 0);
  });
  els.sort.addEventListener('change', () => {
    state.sort = els.sort.value;
    state.animateList = true;
    prefs.set('sort', state.sort);
    renderList();
    window.scrollTo(0, 0);
  });

  const markFromList = (e) => { if (e.target.closest('a')) state.openedFromList = true; };
  els.list.addEventListener('click', markFromList);
  els.cont.addEventListener('click', markFromList);
  els.today.addEventListener('click', (e) => {
    const dice = e.target.closest('[data-surprise]');
    if (dice) {
      if (reducedMotion()) { surpriseMe(); return; }
      dice.classList.add('rolling');
      buzz(15);
      setTimeout(surpriseMe, 430);
      return;
    }
    markFromList(e);
  });

  // Progress / goals / badges
  const openProgress = () => { renderProgress(); renderSettingsUI(); els.progressDlg.showModal(); };
  els.goalBtn.addEventListener('click', openProgress);
  document.querySelectorAll('[data-invite]').forEach((b) => b.addEventListener('click', inviteFriends));
  els.shareProgress.addEventListener('click', shareProgress);
  els.regionSelect.addEventListener('change', () => {
    state.settings.region = els.regionSelect.value;
    saveSettings();
    applyRegion();
    state.animateList = true;
    renderList();
  });
  document.querySelectorAll('.lang-select').forEach((sel) => sel.addEventListener('change', () => {
    state.settings.lang = sel.value;
    saveSettings();
    relabelAll();
  }));

  // Highlights: select text in the reader, or tap an existing highlight.
  document.addEventListener('selectionchange', onSelectionChange);
  els.selBar.addEventListener('mousedown', (e) => e.preventDefault()); // keep the selection alive
  els.selBar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sel]');
    if (!b) return;
    const text = sel.text;
    const mode = sel.mode;
    hideSelBar();
    if (b.dataset.sel === 'hl') { if (mode === 'mark') removeHighlight(text); else { addHighlight(text); buzz(10); toast(t('hl.done')); } }
    if (b.dataset.sel === 'quote') { if (mode !== 'mark') addHighlight(text); shareQuote(text); }
    if (b.dataset.sel === 'copy') { copyText(`“${text}”`); getSelection().removeAllRanges(); }
  });
  ['scroll', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => window.addEventListener(t, markActive, { passive: true }));
  window.addEventListener('scroll', () => { if (sel.mode === 'mark' && Math.abs(window.scrollY - sel.y) > 40) hideSelBar(); }, { passive: true });
  setInterval(tickReading, TICK * 1000);

  // Welcome
  els.topics.addEventListener('click', (e) => {
    const b = e.target.closest('[data-topic]');
    if (!b) return;
    const t = b.dataset.topic;
    const set = new Set(state.settings.topics);
    if (set.has(t)) set.delete(t); else set.add(t);
    state.settings.topics = CATEGORIES.filter((c) => set.has(c));
    saveSettings();
    renderTopics();
  });
  els.welcome.addEventListener('close', () => {
    prefs.set('onboarded', true);
    renderGoalPill();
    state.animateList = true; // cards rise in as the welcome screen closes
    renderList();
  });

  window.addEventListener('hashchange', route);
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });

  els.back.addEventListener('click', goBack);
  els.listen.addEventListener('click', () => (tts.on ? ttsStop() : ttsStart()));
  els.save.addEventListener('click', toggleSaved);
  els.more.addEventListener('click', () => {
    const a = currentArticle();
    if (!a) return;
    els.actionsTitle.textContent = a.title;
    updateReadUI();
    els.actions.showModal();
  });

  els.reader.addEventListener('click', (e) => {
    const mark = e.target.closest('mark.hl');
    if (mark && getSelection().isCollapsed) {
      sel.text = mark.dataset.hl;
      showSelBar(mark.getBoundingClientRect(), 'mark');
      return;
    }
    const opt = e.target.closest('.quiz .opt');
    if (opt) { answerQuiz(Number(opt.dataset.qi), Number(opt.dataset.oi)); return; }
    const tagBtn = e.target.closest('[data-tag]');
    if (tagBtn) {
      // Tapping a tag searches the library for it.
      const tag = tagBtn.dataset.tag;
      goBack();
      els.search.value = tag;
      els.clearSearch.hidden = false;
      state.query = tag;
      state.category = 'All';
      renderList();
      window.scrollTo(0, 0);
      return;
    }
    if (e.target.closest('#finish-btn')) {
      const id = state.currentId;
      if (!id) return;
      if (isRead(id)) markUnread(id); else { markRead(id); toast(t('markedRead')); }
      popEl(document.getElementById('finish-btn'));
      return;
    }
    const next = e.target.closest('[data-next]');
    if (next) {
      e.preventDefault();
      // Replace, so "Library" still goes straight back to the list.
      location.replace(location.pathname + location.search + articleHref(next.dataset.next));
    }
  });

  els.actions.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    const a = currentArticle();
    if (!btn || !a) return;
    switch (btn.dataset.act) {
      case 'share': els.actions.close(); shareArticle(a); break;
      case 'copy': els.actions.close(); copyText(plainText(a)); break;
      case 'read':
        if (isRead(a.id)) markUnread(a.id); else markRead(a.id);
        els.actions.close();
        toast(isRead(a.id) ? t('markedRead') : t('markedUnread'));
        break;
      case 'top': els.actions.close(); window.scrollTo({ top: 0, behavior: 'smooth' }); break;
      case 'delete': await deleteArticle(a); break;
    }
  });

  // Player
  els.ttsPlay.addEventListener('click', () => (tts.playing ? ttsPause() : ttsSpeak(tts.i)));
  els.ttsPrev.addEventListener('click', () => ttsSpeak(tts.i - 1));
  els.ttsNext.addEventListener('click', () => ttsSpeak(tts.i + 1));
  els.ttsClose.addEventListener('click', ttsStop);
  if (tts.supported) {
    populateVoices();
    if (!nativeTts) speechSynthesis.addEventListener?.('voiceschanged', populateVoices);
  } else {
    els.listen.hidden = true;
    els.ttsSettings.hidden = true;
  }

  // Settings
  const openSettings = () => {
    renderSettingsUI();
    if (tts.supported) populateVoices();
    els.settings.showModal();
  };
  els.settingsBtn.addEventListener('click', openSettings);
  els.displayBtn.addEventListener('click', openSettings);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.seg[data-setting] button');
    if (!b) return;
    const key = b.closest('.seg').dataset.setting;
    const keep = state.lastFraction;
    state.settings[key] = b.dataset.value;
    saveSettings();
    if (key === 'theme') {
      const root = document.documentElement;
      root.classList.add('theme-fade');
      applyTheme();
      setTimeout(() => root.classList.remove('theme-fade'), 400);
    }
    renderSettingsUI();
    if (key === 'goal') {
      renderGoalPill();
      if (els.progressDlg.open) renderProgress();
    } else if (key !== 'theme' && !els.readerView.hidden) {
      scrollToFraction(keep);
    }
  });
  els.fontDown.addEventListener('click', () => changeFont(-FONT.step));
  els.fontUp.addEventListener('click', () => changeFont(FONT.step));
  els.wake.addEventListener('change', () => {
    state.settings.wake = els.wake.checked;
    saveSettings();
    if (state.settings.wake) requestWakeLock(); else releaseWakeLock();
  });
  els.rate.addEventListener('input', () => {
    state.settings.rate = Number(els.rate.value) || 1;
    els.rateVal.textContent = state.settings.rate.toFixed(1) + '×';
    saveSettings();
  });
  els.voice.addEventListener('change', () => {
    state.settings.voice = els.voice.value;
    saveSettings();
    if (tts.on && tts.playing) ttsSpeak(tts.i);
  });
  colorQuery.addEventListener?.('change', () => { if (state.settings.theme === 'system') applyTheme(); });

  // Notes & backup sheet (opened from Settings)
  els.notesBtn.addEventListener('click', () => {
    els.settings.close();
    setStatus('');
    els.dialog.showModal();
  });
  document.querySelectorAll('dialog.sheet').forEach((d) => {
    d.addEventListener('click', (e) => {
      if (e.target === d || e.target.closest('[data-close]')) d.close();
    });
    d.addEventListener('close', () => updateBanner());
    new MutationObserver(() => updateBanner()).observe(d, { attributes: true, attributeFilter: ['open'] });
  });

  if (NATIVE) {
    // Android back button: close what's on top first, then go back, then leave the app.
    Plug.App?.addListener('backButton', () => {
      const open = document.querySelector('dialog[open]');
      if (open) { open.close(); return; }
      if (!els.selBar.hidden) { hideSelBar(); return; }
      if (tts.on) { ttsStop(); return; }
      if (!els.readerView.hidden) { goBack(); return; }
      if (state.query) { els.clearSearch.click(); return; }
      Plug.App.minimizeApp();
    });
    // Web links open in the phone's browser, not inside the app.
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="http"]');
      if (!a) return;
      e.preventDefault();
      window.location.href = a.href; // Capacitor hands external URLs to the system browser
    });
    els.privacyLink.href = WEB_URL + 'privacy.html';
    els.adFreeBtn.addEventListener('click', watchForAdFree);
    els.adPrivacyBtn.addEventListener('click', () => Plug.AdMob.showPrivacyOptionsForm().catch(() => {}));
    window.addEventListener('online', updateBanner);
    window.addEventListener('offline', updateBanner);
    Plug.App?.addListener('resume', () => { renderAdUi(); updateBanner(); });
  }

  els.noteSave.addEventListener('click', saveNote);

  els.fileInput.addEventListener('change', async () => {
    const file = els.fileInput.files[0];
    if (file) await importText(await file.text(), `“${file.name}”`);
    els.fileInput.value = '';
  });

  els.exportBtn.addEventListener('click', exportBackup);
  els.resetBtn.addEventListener('click', resetLibrary);

  // Install prompt (Android / desktop Chrome)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.installPrompt = e;
    els.installRow.hidden = false;
    if (!prefs.get('installHinted', false)) {
      prefs.set('installHinted', true);
      setTimeout(() => toast(t('install.hint'), t('install.short'), () => els.install.click()), 4000);
    }
  });
  els.install.addEventListener('click', async () => {
    const p = state.installPrompt;
    if (!p) return;
    els.installRow.hidden = true;
    state.installPrompt = null;
    p.prompt();
    try { await p.userChoice; } catch { /* ignore */ }
  });
  window.addEventListener('appinstalled', () => { els.installRow.hidden = true; toast(t('installed')); });

  window.addEventListener('online', updateNetStatus);
  window.addEventListener('offline', updateNetStatus);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) persistProgress(true); else requestWakeLock();
  });
  window.addEventListener('pagehide', () => persistProgress(true));
}

function registerServiceWorker() {
  if (NATIVE || !('serviceWorker' in navigator)) return; // the Android app ships its files inside the app
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker failed:', err));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) toast(t('update.ready'), t('update.reload'), () => location.reload());
  });
}

/* ---------- Boot ---------- */

async function init() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  loadSettings();
  applyTheme();
  applyLanguage();
  user.load();
  state.fontSize = Math.min(FONT.max, Math.max(FONT.min, Number(prefs.get('font', FONT.def)) || FONT.def));
  const savedCat = prefs.get('category', 'All');
  state.category = CATEGORIES.includes(savedCat) ? savedCat : 'All';
  const savedFilter = prefs.get('filter', 'all');
  state.filter = FILTERS.includes(savedFilter) ? savedFilter : 'all';
  if (!prefs.get('sortForYou', false)) { prefs.set('sortForYou', true); prefs.set('sort', 'foryou'); }
  const savedSort = prefs.get('sort', 'foryou');
  state.sort = SORTS.includes(savedSort) ? savedSort : 'foryou';
  applyRegion();
  renderNoteCats();

  const params = new URLSearchParams(location.search);
  const q = params.get('q'); // e.g. ?q=cold+war (handy for shortcuts)
  if (q) { els.search.value = q; state.query = q; els.clearSearch.hidden = false; }
  const view = params.get('view'); // home-screen shortcut: ?view=saved
  if (FILTERS.includes(view)) state.filter = view;
  els.filter.value = state.filter;
  els.sort.value = state.sort;

  bindEvents();
  renderSettingsUI();
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

  const shared = await handleIncomingShare(params).catch((err) => { console.warn(err); return null; });
  // Drop one-shot launch parameters so a reload doesn't repeat them.
  if (shared || view || params.has('focus') || params.has('continue')) {
    history.replaceState(null, '', location.pathname + location.hash);
  }

  route();

  if (shared) {
    toast(t('shared.saved'), t('open'), () => { state.openedFromList = true; location.hash = articleHref(shared.id); });
  } else if (params.has('continue')) {
    const link = els.cont.querySelector('a');
    if (link) { state.openedFromList = true; location.hash = link.getAttribute('href'); }
  } else if (params.get('focus') === 'search' && els.readerView.hidden) {
    els.search.focus();
  }

  applyFreezes();
  renderGoalPill();
  checkBadges();
  if (!shared && els.readerView.hidden) maybeWelcome();

  registerServiceWorker();
  initAds();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if (!firstRun && navigator.onLine) mergeNewSeedArticles().catch(() => {});
  if (!store.ok) toast(t('storage.na'));
}

init();
