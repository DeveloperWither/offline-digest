# Offline Digest & Search

A zero-dependency Progressive Web App for reading articles offline on your iPhone, with instant full-text search. It has no build step and no frameworks. Every file is static, so it runs on free GitHub Pages hosting.

- **Works offline**: a service worker caches the app after your first visit.
- **Instant search**: an in-memory inverted index covers titles, tags and full body text, and it matches word prefixes (typing `trans` finds "transformer").
- **Category tabs**: All, World News, AI News, History & Conflicts, Tech.
- **Reader view**: A− / A+ font size (remembered between visits), estimated read time and a reading progress bar.
- **Your library stays on the device**: articles are stored in IndexedDB. You can import JSON, JSON Feed, RSS or Atom from a file, a URL or pasted text.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell and iOS meta tags |
| `styles.css` | Mobile-first dark theme |
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

## Importing articles

Tap the download icon (top right) to open **Import & Sync**:

- **From a file**: pick a `.json`, `.xml`, `.rss` or `.atom` file from Files or iCloud Drive.
- **Sync from URL**: fetch a JSON or RSS URL. You need to be online, and the remote server must send CORS headers. Many RSS feeds don't, so download the feed first and import the file instead. Files hosted in your own GitHub Pages repo always work.
- **Paste**: paste raw JSON or RSS XML.
- **Reset library**: removes imported articles and restores the bundled set.

If you import an article with the same `id` as an existing one, it updates that article instead of creating a duplicate.

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

Only `title` or `body` is required. `category` must be one of `World News`, `AI News`, `History & Conflicts` or `Tech`. In `body`, a line starting with `## ` becomes a heading, lines starting with `- ` or `1. ` become lists, and `**text**` becomes bold. If it's missing or unrecognised, the app guesses a category from the content. A `{ "articles": [...] }` wrapper, JSON Feed (`items`, `content_html`) and HTML bodies are also accepted. HTML is converted to plain text, so scripts and markup never run.

## Updating the app

When you change any cached file, bump `VERSION` at the top of `sw.js` and push. Installed copies download the new version in the background and show a **Reload** prompt.

New articles you add to `articles.json` are merged into existing installs on their next online launch. Articles already on the device are not overwritten.

## Local testing

Service workers need `http://localhost` or HTTPS. They don't work from `file://`. From this folder, run:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.
