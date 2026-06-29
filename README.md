# Dictionary

A personal vocabulary PWA for iPhone. Save unfamiliar words and the app
automatically fetches the **translation** plus a **definition and usage
example**, then groups everything by **source** (book, article, video). Runs on
your phone like a normal app, with no App Store and no Xcode.

- **Translation** — free [MyMemory API](https://mymemory.translated.net/) (no key).
- **Definition + example** — free [Free Dictionary API](https://dictionaryapi.dev/) (no key).
- **Storage** — `localStorage` in the phone's browser. No server, no accounts; data never leaves the device.
- **No dependencies** — plain HTML/CSS/JS, no build step.

## How to use

- **Add words**: tap the **`+`** button → pick the word's language and source once,
  then type a word and press **Enter**. The translation, definition and example are
  fetched automatically; keep typing to add more.
- **Browse**: the **Words** tab lists saved words grouped by source. Use the filter
  to narrow to one source, or search by word/translation.
- **Details**: tap a word card to expand it (definition, example, languages, Edit/Delete).
- **Native language**: tap the **`⚙`** button to set the language you translate *into*
  (and the default word language). It applies to every new word.
- **Sources**: the **Sources** tab lets you rename or delete sources.

## Run locally (development)

The service worker needs http, so don't open `index.html` directly (`file://`).
Serve it instead:

```bash
cd /path/to/Dictionary
python3 -m http.server 8000
```

Open http://localhost:8000

## Deploy (GitHub Pages)

The repo is already wired to GitHub Pages. To publish changes:

```bash
git add -A
git commit -m "your message"
git push
```

Pages rebuilds `main` automatically. Live site:
**https://younouki1.github.io/Dictionary/**

> When you change any shell file (HTML/CSS/JS/manifest/icons), bump the `CACHE`
> version in `sw.js` (e.g. `dict-v5` → `dict-v6`) so installed devices pick up the
> new version instead of the cached one.

## Install on iPhone

1. Open **https://younouki1.github.io/Dictionary/** in **Safari** (not Chrome).
2. Share button → **Add to Home Screen**.
3. Launch from the icon: full screen, works offline, words stored on the phone.

## Data backup

Words live in Safari's `localStorage`. Clearing the site's data in iOS Settings
will erase them. JSON export/import is not implemented yet.

## Translation limit

Anonymous MyMemory allows ~5000 words/day. To raise it to ~50000, put your email
in the `EMAIL` constant in `js/translate.js`.

## Project structure

```
index.html              single-page shell (tabs, +/⚙ buttons, sheets, edit modal)
css/styles.css          styles (light/dark via prefers-color-scheme)
js/storage.js           localStorage CRUD (Storage)
js/translate.js         MyMemory translation (Translate)
js/dictionary.js        Free Dictionary API: definition + example (Dictionary)
js/app.js               UI, state, add/enrich flow
manifest.webmanifest    PWA manifest
sw.js                   service worker (offline cache)
icons/                  app icons (icon.svg is the source)
```
