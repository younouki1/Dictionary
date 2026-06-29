// UI and app state. Depends on Storage and Translate (globals).
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
    search: $('search'),
    groups: $('word-groups'),
    emptyList: $('empty-list'),
    sourceList: $('source-list'),
    emptySources: $('empty-sources'),
    fab: $('fab'),
    modal: $('word-modal'),
    modalTitle: $('word-modal-title'),
    fText: $('f-text'),
    fSrc: $('f-src'),
    fTgt: $('f-tgt'),
    fTranslation: $('f-translation'),
    fTranslateBtn: $('f-translate-btn'),
    fTranslateStatus: $('f-translate-status'),
    fSource: $('f-source'),
    fNewSource: $('f-new-source'),
    fNote: $('f-note'),
    fCancel: $('f-cancel'),
    fSave: $('f-save'),
  };

  let editingId = null; // id of the word being edited, or null for a new one

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
      els.emptyList.classList.toggle('hidden', false);
      els.emptyList.textContent = term
        ? 'Nothing found.'
        : 'No words yet. Tap + to add your first one.';
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

    // Sources in their list order, then "No source".
    const order = [...sources.map(s => s.id).filter(id => bySource.has(id))];
    if (bySource.has(NO_SOURCE)) order.push(NO_SOURCE);

    els.groups.innerHTML = order.map((key) => {
      const list = bySource.get(key)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const title = key === NO_SOURCE ? 'No source' : sourceName(key);
      const items = list.map((w) => `
        <div class="word">
          <div class="word-main">
            <div class="word-text">${esc(w.text)}</div>
            <div class="word-translation">${w.translation ? esc(w.translation) : '— no translation'}</div>
            ${w.note ? `<div class="word-note">${esc(w.note)}</div>` : ''}
            <div class="word-langs">${esc(langName(w.sourceLang))} → ${esc(langName(w.targetLang))}</div>
          </div>
          <div class="word-actions">
            <button data-edit="${esc(w.id)}">Edit</button>
            <button class="del" data-del="${esc(w.id)}">Delete</button>
          </div>
        </div>`).join('');
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
    renderList();
    renderSources();
  }

  // --- Word modal ---
  function openWordModal(word) {
    editingId = word ? word.id : null;
    els.modalTitle.textContent = word ? 'Edit word' : 'New word';

    const prefs = Storage.getPrefs();
    fillSelect(els.fSrc, LANGS, word ? word.sourceLang : prefs.src);
    fillSelect(els.fTgt, LANGS, word ? word.targetLang : prefs.tgt);

    // Sources + special options.
    const sources = Storage.getSources();
    const sourceOptions = [
      [NO_SOURCE, 'No source'],
      ...sources.map(s => [s.id, s.name]),
      [NEW_SOURCE, '➕ New source…'],
    ];
    const selectedSource = word ? (word.sourceId || NO_SOURCE) : NO_SOURCE;
    fillSelect(els.fSource, sourceOptions, selectedSource);

    els.fText.value = word ? word.text : '';
    els.fTranslation.value = word ? (word.translation || '') : '';
    els.fNote.value = word ? (word.note || '') : '';
    els.fNewSource.value = '';
    els.fNewSource.classList.add('hidden');
    els.fTranslateStatus.textContent = '';

    els.modal.classList.remove('hidden');
    els.fText.focus();
  }

  function closeWordModal() {
    els.modal.classList.add('hidden');
    editingId = null;
  }

  async function doTranslate() {
    const text = els.fText.value.trim();
    if (!text) {
      els.fTranslateStatus.textContent = 'Enter a word first.';
      return;
    }
    els.fTranslateBtn.disabled = true;
    els.fTranslateStatus.textContent = 'Translating…';
    const res = await Translate.translate(text, els.fSrc.value, els.fTgt.value);
    els.fTranslateBtn.disabled = false;
    if (res.ok) {
      els.fTranslation.value = res.text;
      els.fTranslateStatus.textContent = '';
    } else {
      const msg = res.error === 'limit'
        ? 'Daily translation limit reached. Enter the translation manually.'
        : res.error === 'network'
          ? 'No connection. Save without translation and translate later.'
          : 'Could not translate. Enter the translation manually.';
      els.fTranslateStatus.textContent = msg;
    }
  }

  function saveWord() {
    const text = els.fText.value.trim();
    if (!text) {
      els.fText.focus();
      return;
    }

    // Source: existing, new, or none.
    let sourceId = els.fSource.value;
    if (sourceId === NEW_SOURCE) {
      const name = els.fNewSource.value.trim();
      if (!name) {
        els.fNewSource.focus();
        return;
      }
      sourceId = Storage.saveSource({ name, type: 'book' }).id;
    } else if (sourceId === NO_SOURCE) {
      sourceId = null;
    }

    const existing = editingId
      ? Storage.getWords().find(w => w.id === editingId)
      : null;

    Storage.saveWord({
      id: editingId || undefined,
      createdAt: existing ? existing.createdAt : undefined,
      text,
      translation: els.fTranslation.value.trim(),
      sourceLang: els.fSrc.value,
      targetLang: els.fTgt.value,
      sourceId,
      note: els.fNote.value.trim(),
    });

    Storage.setPrefs({ src: els.fSrc.value, tgt: els.fTgt.value });
    closeWordModal();
    refresh();
  }

  // --- Source actions ---
  function renameSource(id) {
    const sources = Storage.getSources();
    const s = sources.find(x => x.id === id);
    if (!s) return;
    const name = prompt('New source name:', s.name);
    if (name && name.trim()) {
      s.name = name.trim();
      Storage.saveSource(s);
      refresh();
    }
  }

  function deleteSource(id) {
    const sources = Storage.getSources();
    const s = sources.find(x => x.id === id);
    if (!s) return;
    const count = Storage.getWords().filter(w => w.sourceId === id).length;
    if (count === 0) {
      if (confirm(`Delete source "${s.name}"?`)) {
        Storage.deleteSource(id, 'detach');
        refresh();
      }
      return;
    }
    // Has words: ask what to do with them. OK = keep, Cancel = delete.
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
    els.fab.addEventListener('click', () => openWordModal(null));

    els.fSource.addEventListener('change', () => {
      els.fNewSource.classList.toggle('hidden', els.fSource.value !== NEW_SOURCE);
      if (els.fSource.value === NEW_SOURCE) els.fNewSource.focus();
    });
    els.fTranslateBtn.addEventListener('click', doTranslate);
    els.fCancel.addEventListener('click', closeWordModal);
    els.fSave.addEventListener('click', saveWord);
    els.modal.addEventListener('click', (e) => {
      if (e.target === els.modal) closeWordModal(); // click on the backdrop
    });

    // Delegation for dynamic buttons.
    els.groups.addEventListener('click', (e) => {
      const editId = e.target.dataset.edit;
      const delId = e.target.dataset.del;
      if (editId) {
        const w = Storage.getWords().find(x => x.id === editId);
        if (w) openWordModal(w);
      } else if (delId) {
        if (confirm('Delete this word?')) {
          Storage.deleteWord(delId);
          refresh();
        }
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
