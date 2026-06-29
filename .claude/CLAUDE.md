# Project Instructions

Loaded into every Claude Code session for this project.
Keep under 200 lines. Add a rule only if removing it would cause a mistake.

## What this is

Personal vocabulary PWA for iPhone. You save unfamiliar words; the app
auto-fetches the translation and a usage example/definition, groups words by
source (book, article, video), and shows them. Installed via Safari "Add to
Home Screen". No backend, no accounts: all data lives in the browser's
`localStorage` on the device.

## Stack

- Language: vanilla HTML / CSS / JavaScript (ES2020+), no framework
- Build: none (static files served as-is)
- Runtime: any modern browser; target is iOS Safari (PWA, offline via service worker)
- Dependencies: zero runtime deps. External HTTP APIs only:
  - MyMemory (translation) — no key, CORS ok
  - Free Dictionary API `dictionaryapi.dev` (definition + example) — no key, CORS ok

## Commands

- Run dev: `python3 -m http.server 8000` then open http://localhost:8000
  (service worker needs http; opening `index.html` as `file://` breaks SW + modules)
- Syntax check: `node --check js/<file>.js` (and `sw.js`)
- Logic tests: ad-hoc Node harness in the scratchpad dir (vm + localStorage shim)
  for `storage.js` / `dictionary.js`; see git history for the pattern
- UI test: Playwright MCP against the local server (clear SW + localStorage first)
- Deploy: `git add -A && git commit && git push` — GitHub Pages publishes `main` automatically
- Install/Lint/Typecheck/Build: none

## Layout

- `index.html` — single-page shell: top tabs (Words, Sources), `+`/`⚙` floating
  buttons, and three sheets/modals (Add, Settings, Edit a word)
- `css/styles.css` — all styles; light/dark via `prefers-color-scheme` CSS vars
- `js/storage.js` — `Storage`: localStorage CRUD (keys `dict.words`, `dict.sources`, `dict.prefs`)
- `js/translate.js` — `Translate.translate()`: MyMemory wrapper
- `js/dictionary.js` — `Dictionary.lookup()`: Free Dictionary API (definition + example)
- `js/app.js` — UI: rendering, events, add/enrich flow, modals (self-invoking IIFE, no global)
- `sw.js` — service worker: cache-first shell for offline. `CACHE` version + `SHELL` list
- `manifest.webmanifest`, `icons/` — PWA install metadata and icons (`icon.svg` is the source)
- `.claude/` — Claude Code config; `CLAUDE.local.md` (gitignored) holds personal notes

## Data model (localStorage)

- word: `{ id, text, translation, definition, example, sourceLang, targetLang, sourceId, note, createdAt }`
- source: `{ id, name, type }` where type ∈ book | article | video | other
- prefs: `{ src, tgt, activeSourceId }` — `tgt` is the user's native (target) language

## Conventions

- Each JS file is an IIFE that exposes one global (`Storage`/`Translate`/`Dictionary`);
  `app.js` consumes them. No bundler, no imports.
- Always HTML-escape user data with the local `esc()` before inserting into innerHTML.
- UI strings and code comments are in English. Keep it that way.
- Network failures degrade gracefully (save the word, leave translation empty, offer retry).
  Never throw to the UI; API helpers return `{ ok, ... }`.
- Match the existing terse style; no speculative abstractions or new deps.

## Strict rules

- ALWAYS bump `CACHE` in `sw.js` (e.g. `dict-v5` → `dict-v6`) whenever you change any
  shell file (html/css/js/manifest/icons), or installed devices keep the stale version.
- When adding a new JS/asset file to the shell, ALSO add it to the `SHELL` array in `sw.js`
  and add its `<script>` to `index.html`.
- NEVER introduce a build step, framework, or runtime dependency without asking first.
- NEVER add a backend or move data off-device; words stay in `localStorage`.
- Translation quality varies (MyMemory may echo the input word); this is expected, not a bug.
  Definitions/examples are mostly English-only; skip gracefully on 404.

## Repo / deploy

- Remote: `git@github.com:younouki1/Dictionary.git`, branch `main`
- Live: https://younouki1.github.io/Dictionary/ (GitHub Pages, public repo, root)
