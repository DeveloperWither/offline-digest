# Offline Digest & Search

A free, zero-dependency Progressive Web App for reading articles offline on Android and iPhone, with instant full-text search. It has no build step, no frameworks, no ads, no accounts and no tracking. Every file is static, so it runs on free GitHub Pages hosting.

- **Works offline**: a service worker caches the app after your first visit.
- **Instant search**: an in-memory inverted index covers titles, tags and full body text, and it matches word prefixes (typing `trans` finds "transformer").
- **Category tabs**: All, World News, AI News, History & Conflicts, Tech. You can also filter by **Unread / In progress / Saved** and sort by **Newest / Oldest / Shortest / Longest**.
- **Saved articles**: tap the bookmark in the reader. There's a home-screen shortcut for Saved.
- **Resume reading**: the app remembers where you stopped in every article and shows a **Continue reading** card. Articles you finish are marked read, and the reader suggests what's **Up next**.
- **Read aloud**: on-device text-to-speech with a mini player (pause, previous and next paragraph), adjustable speed and voice choice. Offline voices work in airplane mode.
- **Themes and text**: Auto, Dark, Light or Sepia. Serif or sans text, size from 14 to 30 px, three line spacings, and a **Keep screen on** option while reading.
- **Your notes**: write or paste your own text. It's stored and searchable offline.
- **Share to Digest (Android)**: once installed, Digest shows up in the Android share sheet. Shared text or links are saved straight into Saved.
- **Daily goal and streaks**: pick 5, 10, 15 or 30 minutes a day. A ring in the top bar fills as you read, and hitting the goal sets off confetti 🎉. Reading for a minute or finishing an article keeps your 🔥 streak alive. Only real reading counts: the reader must be open and in use.
- **Levels and 18 badges**: earn XP from reading, highlights and badges (Bookworm, Week Warrior, Night Owl, Explorer and more). Unlocking a badge offers a one-tap share.
- **Highlights and quote cards**: select text to highlight it, and see them all under **Highlighted**. **Quote card** turns a highlight into a 1080×1350 branded image that shares straight to WhatsApp, Instagram, X and other apps.
- **Today's pick and Surprise me 🎲**: a daily article from your favourite topics, plus a random unread one whenever you want.
- **6 languages**: English, العربية (full right-to-left layout), Español, Français, Português and हिन्दी. The app picks the phone language automatically, and you can change it in Settings or on the welcome screen. Search, highlights and read-aloud work in every script. English articles stay left-to-right inside the Arabic interface. To add a language, copy the `en` block in `i18n.js` and translate it.
- **Streak freezes 🧊**: every 7 days in a row earns one (max 2). If you miss a day, a freeze is used automatically so your streak survives.
- **Share my progress**: a branded image of your streak, level, stats and badges, ready for WhatsApp, Instagram and other apps.
- **More like this**: related articles at the end of each article, matched by tags, title words and category. Tap any tag in an article to search for it.
- **Haptics**: a short vibration when you save, highlight, hit your goal or unlock a badge, on phones that support it.
- **Smooth animations everywhere**: cards rise into place one after another, articles slide in, rings fill and numbers count up on the progress page, badges pop in with a shine, the 🔥 flame flickers, the 🎲 dice rolls, and a big card appears when you unlock a badge or hit your goal. Theme changes cross-fade. If the phone has **Reduce motion** turned on, every animation is switched off.
- **News for your region**: the app works out your country offline, from the phone's time zone and then its language setting. The default **For you** sort lifts stories about your country (with a 📍 label) and your wider region slightly above the rest, and Today's pick features local news every other day. You can change the region in Settings.
- **Learn**: a category of practical, evidence-based guides on health, money and life skills, and science. Each guide and history article ends with a 3-question **Test yourself** quiz. Answers are marked right or wrong with a short explanation, and quizzes earn XP and two badges (Quiz Whiz, Perfect Score). Guides list **Further reading** from reputable sources, and in "For you" they sit behind fresh news.
- **Welcome screen**: on first launch, new users pick topics and a daily goal.
- **Progress page**: today's ring, a 7-day chart, level, stats, badges and **Invite friends**.
- **Backup and restore** (Settings → Notes & backup): export one JSON file with your articles, notes, saved items and progress, then import it on another phone.
- **Share, copy, delete**: every article has these actions, and deleting can be undone.
- **Your library stays on the device**: articles are stored in IndexedDB.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell and iOS meta tags |
| `styles.css` | Mobile-first dark theme |
| `i18n.js` | Interface translations (6 languages) |
| `app.js` | IndexedDB storage, search index, import, routing, reader |
| `sw.js` | Service worker (offline cache) |
| `manifest.json` | PWA manifest (standalone display) |
| `articles.json` | Bundled starter articles |
| `icons/` | Home Screen and app icons |

## 1. Push to GitHub

Create an empty repository on GitHub (for example `offline-digest`), then run this from inside this folder:

```bash
git init
git add .
git commit -m "Offline Digest PWA"
git branch -M main
git remote add origin https://github.com/<username>/<repository-name>.git
git push -u origin main
```

## 2. Enable GitHub Pages

1. Open the repository on GitHub and go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Choose branch **main**, folder **/ (root)**, then click **Save**.
4. After a minute or so, the site is live at `https://<username>.github.io/<repository-name>/`.

Every path in the app is relative, so it works from that sub-path without changes. GitHub Pages serves over HTTPS, which service workers require.

## 3. Add it to your iPhone Home Screen

1. Open the site URL in **Safari**. Other browsers on iOS don't support this step.
2. Wait for the articles to appear. This first visit is what caches the app for offline use.
3. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
4. Launch **Digest** from the Home Screen. It opens full screen without browser chrome and works in airplane mode.

> Use the Home Screen app instead of a Safari tab. Safari can clear data for websites you haven't visited recently, but Home Screen web apps keep their storage.

## Android: install and publish

- **Install as an app**: open the site in Chrome on Android and tap the **Install** button in the top bar (or Chrome menu → **Install app**). Digest then gets its own icon, the share-sheet entry and long-press shortcuts (Continue reading, Saved, Search).
- **Publish on Google Play**: wrap the hosted PWA as a Trusted Web Activity with [PWABuilder](https://www.pwabuilder.com) (enter your GitHub Pages URL, choose Android, and download the signed `.aab`) or with Bubblewrap. Upload the `assetlinks.json` file it generates to `.well-known/assetlinks.json` on your site so the app opens without a browser bar. Then upload the `.aab` in Play Console as a free app.

## Adding articles

Readers don't import anything. They get articles from the bundled `articles.json`, and new ones are merged in automatically each time the app opens online. To publish news, add articles to `articles.json` and push.

In the app, **Settings → 📝 Notes & backup** lets readers:

- **Write a note**: their own text, stored and searchable offline.
- **Restore a backup**: choose a backup file exported from Digest (for moving to a new phone).
- **Export backup** or **Reset library**.

### JSON format

```json
[
  {
    "id": "unique-id",
    "title": "Article title",
    "category": "AI News",
    "tags": ["tag one", "tag two"],
    "author": "Name",
    "source": "Publication",
    "date": "2026-10-01",
    "url": "https://example.com/original",
    "body": "Paragraphs separated by a blank line.\n\n## Lines starting with ## become headings."
  }
]
```

Add `"regions": ["SA", "gulf", "middle-east"]` to tag where a story is about. Use ISO country codes, plus `EU`, `middle-east`, `gulf`, `north-africa`, `europe`, `north-america`, `latin-america`, `africa`, `south-asia`, `east-asia`, `southeast-asia`, `central-asia`, `oceania` or `global`.

The bundled `articles.json` uses the wrapper `{ "articles": [...], "removed": ["id"] }`. Any id listed in `removed` is deleted from phones that already have it, on their next online launch. Articles users imported themselves are never removed.

Only `title` or `body` is required. `category` must be one of `World News`, `AI News`, `Tech`, `Learn` or `History & Conflicts`. Add `"evergreen": true` for timeless guides, and an optional `"quiz": [{ "q": "…", "options": ["…"], "answer": 0, "explain": "…" }]`. In `body`, a line starting with `## ` becomes a heading, lines starting with `- ` or `1. ` become lists, and `**text**` becomes bold. If it's missing or unrecognised, the app guesses a category from the content. A `{ "articles": [...] }` wrapper, JSON Feed (`items`, `content_html`) and HTML bodies are also accepted. HTML is converted to plain text, so scripts and markup never run.

## Updating the app

When you change any cached file, bump `VERSION` at the top of `sw.js` and push. Installed copies download the new version in the background and show a **Reload** prompt.

New articles you add to `articles.json` are merged into existing installs on their next online launch. Articles already on the device are not overwritten.

## Local testing

Service workers need `http://localhost` or HTTPS. They don't work from `file://`. From this folder, run:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.
