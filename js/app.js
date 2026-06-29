// UI and app state. Depends on Storage, Translate, Dictionary (globals).
(() => {
  'use strict';

  const LANGS = [
    ['en', 'English'], ['ru', 'Russian'], ['de', 'German'],
    ['fr', 'French'], ['es', 'Spanish'], ['it', 'Italian'],
    ['pt', 'Portuguese'], ['pl', 'Polish'], ['uk', 'Ukrainian'],
    ['tr', 'Turkish'], ['zh', 'Chinese'], ['ja', 'Japanese'],
  ];
  const SOURCE_TYPES = [
    ['book', 'Book'], ['article', 'Article'], ['video', 'Video'], ['other', 'Other'],
  ];
  const NO_SOURCE = '__none__';
  const NEW_SOURCE = '__new__';

  // --- DOM ---
  const $ = (id) => document.getElementById(id);
  const els = {
    tabs: document.querySelectorAll('.tab'),
    viewList: $('view-list'),
    viewSources: $('view-sources'),
    qSrc: $('q-src'),
    qTgt: $('q-tgt'),
    qSource: $('q-source'),
    qWord: $('q-word'),
    search: $('search'),
    groups: $('word-groups'),
    emptyList: $('empty-list'),
    sourceList: $('source-list'),
    emptySources: $('empty-sources'),
    modal: $('word-modal'),
    modalTitle: $('word-modal-title'),
    fText: $('f-text'),
    fSrc: $('f-src'),
    fTgt: $('f-tgt'),
    fTranslation: $('f-translation'),
    fDefinition: $('f-definition'),
    fExample: $('f-example'),
    fRefetch: $('f-refetch'),
    fRefetchStatus: $('f-refetch-status'),
    fSource: $('f-source'),
    fNewSource: $('f-new-source'),
    fNote: $('f-note'),
    fCancel: $('f-cancel'),
    fSave: $('f-save'),
  };

  let editingId = null;        // id of the word being edited, or null
  const pending = new Set();   // ids currently being enriched (translation/context)

  // --- Helpers ---
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const langName = (code) => (LANGS.find(l => l[0] === code) || [code, code])[1];
  const sourceTypeName = (t) => (SOURCE_TYPES.find(s => s[0] === t) || [t, t])[1];

  function fillSelect(sel, pairs, selected) {
    sel.innerHTML = pairs
      .map(([v, label]) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(label)}</option>`)
      .join('');
  }

  // Source options shared by the quick-add bar and the edit modal.
  function sourceOptions(includeNone) {
    const sources = Storage.getSources();
    const opts = includeNone ? [[NO_SOURCE, 'No source']] : [];
    return [...opts, ...sources.map(s => [s.id, s.name]), [NEW_SOURCE, '➕ New source…']];
  }

  // --- Quick-add bar ---
  function renderAddBar() {
    const prefs = Storage.getPrefs();
    fillSelect(els.qSrc, LANGS, prefs.src);
    fillSelect(els.qTgt, LANGS, prefs.tgt);
    const active = prefs.activeSourceId || NO_SOURCE;
    fillSelect(els.qSource, sourceOptions(true), active);
  }

  function savePrefsFromBar() {
    Storage.setPrefs({
      src: els.qSrc.value,
      tgt: els.qTgt.value,
      activeSourceId: els.qSource.value === NO_SOURCE ? null : els.qSource.value,
    });
  }

  // Handle the "➕ New source…" choice in the quick-add source select.
  function onQuickSourceChange() {
    if (els.qSource.value === NEW_SOURCE) {
      const name = prompt('New source name:');
      if (name && name.trim()) {
        const s = Storage.saveSource({ name: name.trim(), type: 'book' });
        renderAddBar();
        els.qSource.value = s.id;
      } else {
        els.qSource.value = (Storage.getPrefs().activeSourceId) || NO_SOURCE;
      }
    }
    savePrefsFromBar();
    refresh();
  }

  // Type a word + Enter -> save immediately, then fetch translation + context.
  function addQuick() {
    const text = els.qWord.value.trim();
    if (!text) return;

    const prefs = Storage.getPrefs();
    const word = Storage.saveWord({
      text,
      translation: '',
      definition: '',
      example: '',
      sourceLang: els.qSrc.value,
      targetLang: els.qTgt.value,
      sourceId: prefs.activeSourceId || null,
    });

    els.qWord.value = '';
    els.qWord.focus(); // keep adding words in a row
    pending.add(word.id);
    refresh();
    enrich(word.id);
  }

  // Fetch translation (MyMemory) + definition/example (Dictionary) for a word.
  async function enrich(id) {
    const word = Storage.getWords().find(w => w.id === id);
    if (!word) { pending.delete(id); return; }
    pending.add(id);
    refresh();

    const [tr, dict] = await Promise.all([
      Translate.translate(word.text, word.sourceLang, word.targetLang),
      Dictionary.lookup(word.text, word.sourceLang),
    ]);

    // Word may have been edited/deleted meanwhile — re-read latest.
    const latest = Storage.getWords().find(w => w.id === id);
    if (!latest) { pending.delete(id); refresh(); return; }
    if (tr.ok) latest.translation = tr.text;
    if (dict.ok) {
      latest.definition = dict.definition;
      latest.example = dict.example || '';
    }
    Storage.saveWord(latest);
    pending.delete(id);
    refresh();
  }

  // --- Render word list ---
  function renderList() {
    const term = els.search.value.trim().toLowerCase();
    const sources = Storage.getSources();
    const sourceName = (id) => (sources.find(s => s.id === id) || {}).name || 'No source';

    let words = Storage.getWords();
    if (term) {
      words = words.filter(w =>
        w.text.toLowerCase().includes(term) ||
        (w.translation || '').toLowerCase().includes(term));
    }

    if (words.length === 0) {
      els.groups.innerHTML = '';
      els.emptyList.classList.remove('hidden');
      els.emptyList.textContent = term
        ? 'Nothing found.'
        : 'No words yet. Type a word above and press Enter.';
      return;
    }
    els.emptyList.classList.add('hidden');

    // Group by source.
    const bySource = new Map();
    for (const w of words) {
      const key = w.sourceId || NO_SOURCE;
      if (!bySource.has(key)) bySource.set(key, []);
      bySource.get(key).push(w);
    }
    const order = [...sources.map(s => s.id).filter(id => bySource.has(id))];
    if (bySource.has(NO_SOURCE)) order.push(NO_SOURCE);

    els.groups.innerHTML = order.map((key) => {
      const list = bySource.get(key).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const title = key === NO_SOURCE ? 'No source' : sourceName(key);
      const items = list.map(renderWord).join('');
      return `
        <section class="group">
          <div class="group-head">
            <h3>${esc(title)}</h3>
            <span class="count">${list.length}</span>
          </div>
          ${items}
        </section>`;
    }).join('');
  }

  function renderWord(w) {
    let translationHtml;
    if (w.translation) {
      translationHtml = `<div class="word-translation">${esc(w.translation)}</div>`;
    } else if (pending.has(w.id)) {
      translationHtml = `<div class="word-translation muted">Translating…</div>`;
    } else {
      translationHtml = `<div class="word-translation muted">— no translation
        <button class="link-btn" data-retry="${esc(w.id)}">↻ retry</button></div>`;
    }
    return `
      <div class="word">
        <div class="word-main">
          <div class="word-text">${esc(w.text)}</div>
          ${translationHtml}
          ${w.definition ? `<div class="word-def">${esc(w.definition)}</div>` : ''}
          ${w.example ? `<div class="word-example">“${esc(w.example)}”</div>` : ''}
          ${w.note ? `<div class="word-note">${esc(w.note)}</div>` : ''}
          <div class="word-langs">${esc(langName(w.sourceLang))} → ${esc(langName(w.targetLang))}</div>
        </div>
        <div class="word-actions">
          <button data-edit="${esc(w.id)}">Edit</button>
          <button class="del" data-del="${esc(w.id)}">Delete</button>
        </div>
      </div>`;
  }

  // --- Render sources ---
  function renderSources() {
    const sources = Storage.getSources();
    const words = Storage.getWords();
    const countFor = (id) => words.filter(w => w.sourceId === id).length;

    if (sources.length === 0) {
      els.sourceList.innerHTML = '';
      els.emptySources.classList.remove('hidden');
      return;
    }
    els.emptySources.classList.add('hidden');
    els.sourceList.innerHTML = sources.map((s) => `
      <div class="source-row">
        <div>
          <div>${esc(s.name)}</div>
          <div class="meta">${esc(sourceTypeName(s.type))} · words: ${countFor(s.id)}</div>
        </div>
        <div class="ops">
          <button data-rename="${esc(s.id)}">Rename</button>
          <button class="del" data-delsource="${esc(s.id)}">Delete</button>
        </div>
      </div>`).join('');
  }

  function refresh() {
    renderAddBar();
    renderList();
    renderSources();
  }

  // --- Edit modal ---
  function openWordModal(word) {
    editingId = word.id;
    els.modalTitle.textContent = 'Edit word';
    fillSelect(els.fSrc, LANGS, word.sourceLang);
    fillSelect(els.fTgt, LANGS, word.targetLang);
    fillSelect(els.fSource, sourceOptions(true), word.sourceId || NO_SOURCE);

    els.fText.value = word.text;
    els.fTranslation.value = word.translation || '';
    els.fDefinition.value = word.definition || '';
    els.fExample.value = word.example || '';
    els.fNote.value = word.note || '';
    els.fNewSource.value = '';
    els.fNewSource.classList.add('hidden');
    els.fRefetchStatus.textContent = '';

    els.modal.classList.remove('hidden');
    els.fText.focus();
  }

  function closeWordModal() {
    els.modal.classList.add('hidden');
    editingId = null;
  }

  // Re-fetch translation + context into the modal fields (without saving yet).
  async function refetchModal() {
    const text = els.fText.value.trim();
    if (!text) { els.fRefetchStatus.textContent = 'Enter a word first.'; return; }
    els.fRefetch.disabled = true;
    els.fRefetchStatus.textContent = 'Fetching…';
    const [tr, dict] = await Promise.all([
      Translate.translate(text, els.fSrc.value, els.fTgt.value),
      Dictionary.lookup(text, els.fSrc.value),
    ]);
    els.fRefetch.disabled = false;
    if (tr.ok) els.fTranslation.value = tr.text;
    if (dict.ok) {
      els.fDefinition.value = dict.definition;
      els.fExample.value = dict.example || '';
    }
    els.fRefetchStatus.textContent = (tr.ok || dict.ok) ? '' : 'Nothing found. Edit manually.';
  }

  function saveWord() {
    const text = els.fText.value.trim();
    if (!text) { els.fText.focus(); return; }

    let sourceId = els.fSource.value;
    if (sourceId === NEW_SOURCE) {
      const name = els.fNewSource.value.trim();
      if (!name) { els.fNewSource.focus(); return; }
      sourceId = Storage.saveSource({ name, type: 'book' }).id;
    } else if (sourceId === NO_SOURCE) {
      sourceId = null;
    }

    const existing = Storage.getWords().find(w => w.id === editingId);
    Storage.saveWord({
      id: editingId,
      createdAt: existing ? existing.createdAt : undefined,
      text,
      translation: els.fTranslation.value.trim(),
      definition: els.fDefinition.value.trim(),
      example: els.fExample.value.trim(),
      sourceLang: els.fSrc.value,
      targetLang: els.fTgt.value,
      sourceId,
      note: els.fNote.value.trim(),
    });
    closeWordModal();
    refresh();
  }

  // --- Source actions ---
  function renameSource(id) {
    const s = Storage.getSources().find(x => x.id === id);
    if (!s) return;
    const name = prompt('New source name:', s.name);
    if (name && name.trim()) {
      s.name = name.trim();
      Storage.saveSource(s);
      refresh();
    }
  }

  function deleteSource(id) {
    const s = Storage.getSources().find(x => x.id === id);
    if (!s) return;
    const count = Storage.getWords().filter(w => w.sourceId === id).length;
    if (count === 0) {
      if (confirm(`Delete source "${s.name}"?`)) { Storage.deleteSource(id, 'detach'); refresh(); }
      return;
    }
    const keep = confirm(
      `Source "${s.name}" has ${count} word(s).\n\n` +
      `OK — keep the words (move them to "No source").\n` +
      `Cancel — delete the words together with the source.`);
    Storage.deleteSource(id, keep ? 'detach' : 'delete');
    refresh();
  }

  // --- Tab navigation ---
  function switchView(view) {
    els.tabs.forEach(t => t.setAttribute('aria-current', String(t.dataset.view === view)));
    els.viewList.classList.toggle('hidden', view !== 'list');
    els.viewSources.classList.toggle('hidden', view !== 'sources');
  }

  // --- Events ---
  function bind() {
    els.tabs.forEach(t => t.addEventListener('click', () => switchView(t.dataset.view)));
    els.search.addEventListener('input', renderList);

    els.qSrc.addEventListener('change', savePrefsFromBar);
    els.qTgt.addEventListener('change', savePrefsFromBar);
    els.qSource.addEventListener('change', onQuickSourceChange);
    els.qWord.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addQuick(); }
    });

    els.fRefetch.addEventListener('click', refetchModal);
    els.fSource.addEventListener('change', () => {
      els.fNewSource.classList.toggle('hidden', els.fSource.value !== NEW_SOURCE);
      if (els.fSource.value === NEW_SOURCE) els.fNewSource.focus();
    });
    els.fCancel.addEventListener('click', closeWordModal);
    els.fSave.addEventListener('click', saveWord);
    els.modal.addEventListener('click', (e) => { if (e.target === els.modal) closeWordModal(); });

    // Delegation for dynamic word buttons.
    els.groups.addEventListener('click', (e) => {
      const { edit, del, retry } = e.target.dataset;
      if (edit) {
        const w = Storage.getWords().find(x => x.id === edit);
        if (w) openWordModal(w);
      } else if (del) {
        if (confirm('Delete this word?')) { Storage.deleteWord(del); refresh(); }
      } else if (retry) {
        enrich(retry);
      }
    });
    els.sourceList.addEventListener('click', (e) => {
      if (e.target.dataset.rename) renameSource(e.target.dataset.rename);
      else if (e.target.dataset.delsource) deleteSource(e.target.dataset.delsource);
    });
  }

  // --- Service worker for offline use ---
  function registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => { /* offline mode just won't turn on */ });
      });
    }
  }

  // --- Start ---
  bind();
  refresh();
  registerSW();
})();
