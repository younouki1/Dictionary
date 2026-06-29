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
  const BASE_SOURCE = '__base__'; // the always-present default source ("General")
  const BASE_NAME = 'General';
  const ALL_SOURCES = '__all__';

  // --- DOM ---
  const $ = (id) => document.getElementById(id);
  const els = {
    tabs: document.querySelectorAll('.tab'),
    viewWords: $('view-words'),
    viewSources: $('view-sources'),
    filterSource: $('filter-source'),
    search: $('search'),
    groups: $('word-groups'),
    emptyList: $('empty-list'),
    sourceList: $('source-list'),
    newSourceName: $('new-source-name'),
    newSourceType: $('new-source-type'),
    addSourceBtn: $('add-source-btn'),
    fabAdd: $('fab-add'),
    fabSettings: $('fab-settings'),
    // Add sheet
    addModal: $('add-modal'),
    addNative: $('add-native'),
    qSrc: $('q-src'),
    qSource: $('q-source'),
    qWord: $('q-word'),
    addStatus: $('add-status'),
    addClose: $('add-close'),
    // Settings sheet
    settingsModal: $('settings-modal'),
    sNative: $('s-native'),
    sSourceLang: $('s-source-lang'),
    exportBtn: $('export-btn'),
    importBtn: $('import-btn'),
    importFile: $('import-file'),
    backupStatus: $('backup-status'),
    settingsClose: $('settings-close'),
    // Edit modal
    modal: $('word-modal'),
    fText: $('f-text'),
    fSrc: $('f-src'),
    fTgt: $('f-tgt'),
    fTranslation: $('f-translation'),
    fTranscription: $('f-transcription'),
    fDefinition: $('f-definition'),
    fExample: $('f-example'),
    fRefetch: $('f-refetch'),
    fRefetchStatus: $('f-refetch-status'),
    fSource: $('f-source'),
    fNote: $('f-note'),
    fCancel: $('f-cancel'),
    fSave: $('f-save'),
  };

  let editingId = null;             // id of the word being edited, or null
  let filterSourceId = ALL_SOURCES; // current source filter on the Words tab
  const expanded = new Set();       // ids of expanded (open) word cards
  const pending = new Set();        // ids currently being enriched

  // --- Helpers ---
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const langName = (code) => (LANGS.find(l => l[0] === code) || [code, code])[1];
  const sourceTypeName = (t) => (SOURCE_TYPES.find(s => s[0] === t) || [t, t])[1];

  // IPA transcription with the primary-stressed syllable bolded.
  // The stressed syllable is the run right after the ˈ mark, up to the next boundary.
  function transcriptionHtml(ipa) {
    const i = ipa.indexOf('ˈ');
    if (i === -1) return esc(ipa);
    const boundaries = new Set(['.', 'ˈ', 'ˌ', '/', ' ']);
    let j = i + 1;
    while (j < ipa.length && !boundaries.has(ipa[j])) j++;
    return esc(ipa.slice(0, i + 1)) + '<b>' + esc(ipa.slice(i + 1, j)) + '</b>' + esc(ipa.slice(j));
  }

  function fillSelect(sel, pairs, selected) {
    sel.innerHTML = pairs
      .map(([v, label]) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(label)}</option>`)
      .join('');
  }

  // Source options for the add/edit selects: the base source + user sources.
  // No "create" option here — sources are created only on the Sources tab.
  function sourceOptions() {
    return [[BASE_SOURCE, BASE_NAME], ...Storage.getSources().map(s => [s.id, s.name])];
  }

  // --- Add sheet ---
  function openAdd() {
    const prefs = Storage.getPrefs();
    els.addNative.textContent = langName(prefs.tgt);
    fillSelect(els.qSrc, LANGS, prefs.src);
    fillSelect(els.qSource, sourceOptions(), prefs.activeSourceId || BASE_SOURCE);
    els.addStatus.textContent = '';
    els.qWord.value = '';
    els.addModal.classList.remove('hidden');
    els.qWord.focus();
  }
  function closeAdd() { els.addModal.classList.add('hidden'); }

  function savePrefsFromAdd() {
    const prefs = Storage.getPrefs();
    Storage.setPrefs({
      ...prefs,
      src: els.qSrc.value,
      activeSourceId: els.qSource.value === BASE_SOURCE ? null : els.qSource.value,
    });
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
      targetLang: prefs.tgt,
      sourceId: prefs.activeSourceId || null,
    });

    els.qWord.value = '';
    els.qWord.focus(); // keep adding words in a row
    els.addStatus.textContent = `Added “${word.text}” — fetching translation…`;
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

    const latest = Storage.getWords().find(w => w.id === id);
    if (!latest) { pending.delete(id); refresh(); return; }
    if (tr.ok) latest.translation = tr.text;
    if (dict.ok) {
      latest.definition = dict.definition;
      latest.example = dict.example || '';
      latest.transcription = dict.transcription || '';
    }
    Storage.saveWord(latest);
    pending.delete(id);
    refresh();
  }

  // --- Settings sheet ---
  function openSettings() {
    const prefs = Storage.getPrefs();
    fillSelect(els.sNative, LANGS, prefs.tgt);
    fillSelect(els.sSourceLang, LANGS, prefs.src);
    els.settingsModal.classList.remove('hidden');
  }
  function closeSettings() { els.settingsModal.classList.add('hidden'); }
  function saveSettings() {
    const prefs = Storage.getPrefs();
    Storage.setPrefs({ ...prefs, tgt: els.sNative.value, src: els.sSourceLang.value });
  }

  // --- Backup ---
  async function exportData() {
    const json = JSON.stringify(Storage.exportData(), null, 2);
    const filename = `dictionary-backup-${new Date().toISOString().slice(0, 10)}.json`;
    els.backupStatus.textContent = '';

    // On iPhone the native share sheet (save to Files / iCloud) is the best path.
    const file = new File([json], filename, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Dictionary backup' }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; /* else fall back to download */ }
    }
    // Fallback: download via a temporary link.
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const res = Storage.importData(JSON.parse(reader.result));
        refresh();
        els.backupStatus.textContent =
          `Imported: +${res.wordsAdded} words (updated ${res.wordsUpdated}), ` +
          `+${res.sourcesAdded} sources (updated ${res.sourcesUpdated}).`;
      } catch {
        els.backupStatus.textContent = 'Import failed: invalid file.';
      }
      els.importFile.value = ''; // allow re-importing the same file
    };
    reader.onerror = () => { els.backupStatus.textContent = 'Could not read the file.'; };
    reader.readAsText(file);
  }

  // --- Words tab: filter + list ---
  function renderFilter() {
    const opts = [[ALL_SOURCES, 'All sources'], [BASE_SOURCE, BASE_NAME], ...Storage.getSources().map(s => [s.id, s.name])];
    if (!opts.some(([v]) => v === filterSourceId)) filterSourceId = ALL_SOURCES;
    fillSelect(els.filterSource, opts, filterSourceId);
  }

  function renderList() {
    const term = els.search.value.trim().toLowerCase();
    const sources = Storage.getSources();
    const sourceName = (id) => (sources.find(s => s.id === id) || {}).name || BASE_NAME;

    let words = Storage.getWords();
    if (filterSourceId === BASE_SOURCE) words = words.filter(w => !w.sourceId);
    else if (filterSourceId !== ALL_SOURCES) words = words.filter(w => w.sourceId === filterSourceId);
    if (term) {
      words = words.filter(w =>
        w.text.toLowerCase().includes(term) ||
        (w.translation || '').toLowerCase().includes(term));
    }

    if (words.length === 0) {
      els.groups.innerHTML = '';
      els.emptyList.classList.remove('hidden');
      els.emptyList.textContent = (term || filterSourceId !== ALL_SOURCES)
        ? 'Nothing here.'
        : 'No words yet. Tap + to add one.';
      return;
    }
    els.emptyList.classList.add('hidden');

    const bySource = new Map();
    for (const w of words) {
      const key = w.sourceId || BASE_SOURCE;
      if (!bySource.has(key)) bySource.set(key, []);
      bySource.get(key).push(w);
    }
    const order = [...sources.map(s => s.id).filter(id => bySource.has(id))];
    if (bySource.has(BASE_SOURCE)) order.push(BASE_SOURCE);

    els.groups.innerHTML = order.map((key) => {
      const list = bySource.get(key).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const title = key === BASE_SOURCE ? BASE_NAME : sourceName(key);
      return `
        <section class="group">
          <div class="group-head">
            <h3>${esc(title)}</h3>
            <span class="count">${list.length}</span>
          </div>
          ${list.map(renderWord).join('')}
        </section>`;
    }).join('');
  }

  // Compact card: word + translation, tap to expand context + actions.
  function renderWord(w) {
    const isOpen = expanded.has(w.id);
    let translationHtml;
    if (w.translation) {
      translationHtml = `<div class="word-translation">${esc(w.translation)}</div>`;
    } else if (pending.has(w.id)) {
      translationHtml = `<div class="word-translation muted">Translating…</div>`;
    } else {
      translationHtml = `<div class="word-translation muted">— no translation
        <button class="link-btn" data-retry="${esc(w.id)}">↻ retry</button></div>`;
    }

    const details = isOpen ? `
      <div class="word-details">
        ${w.definition ? `<div class="word-def">${esc(w.definition)}</div>` : ''}
        ${w.example ? `<div class="word-example">“${esc(w.example)}”</div>` : ''}
        ${w.note ? `<div class="word-note">${esc(w.note)}</div>` : ''}
        <div class="word-langs">${esc(langName(w.sourceLang))} → ${esc(langName(w.targetLang))}</div>
        <div class="word-actions">
          <button data-edit="${esc(w.id)}">Edit</button>
          <button class="del" data-del="${esc(w.id)}">Delete</button>
        </div>
      </div>` : '';

    return `
      <div class="word ${isOpen ? 'open' : ''}">
        <div class="word-head" data-toggle="${esc(w.id)}">
          <div class="word-main">
            <div class="word-text">${esc(w.text)}${w.transcription
              ? ` <span class="word-transcription">${transcriptionHtml(w.transcription)}</span>` : ''}</div>
            ${translationHtml}
          </div>
          <span class="chevron">›</span>
        </div>
        ${details}
      </div>`;
  }

  // --- Sources tab ---
  function renderSources() {
    const sources = Storage.getSources();
    const words = Storage.getWords();
    const countFor = (id) => words.filter(w => w.sourceId === id).length;
    const baseCount = words.filter(w => !w.sourceId).length;

    // The base source is always present and cannot be renamed or deleted.
    const baseRow = `
      <div class="source-row">
        <div>
          <div>${BASE_NAME}</div>
          <div class="meta">default · words: ${baseCount}</div>
        </div>
      </div>`;

    els.sourceList.innerHTML = baseRow + sources.map((s) => `
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

  // Create a source from the Sources tab (the only place sources are created).
  function addSourceFromTab() {
    const name = els.newSourceName.value.trim();
    if (!name) { els.newSourceName.focus(); return; }
    Storage.saveSource({ name, type: els.newSourceType.value });
    els.newSourceName.value = '';
    refresh();
  }

  function refresh() {
    renderFilter();
    renderList();
    renderSources();
  }

  // --- Edit modal ---
  function openWordModal(word) {
    editingId = word.id;
    fillSelect(els.fSrc, LANGS, word.sourceLang);
    fillSelect(els.fTgt, LANGS, word.targetLang);
    fillSelect(els.fSource, sourceOptions(), word.sourceId || BASE_SOURCE);

    els.fText.value = word.text;
    els.fTranslation.value = word.translation || '';
    els.fTranscription.value = word.transcription || '';
    els.fDefinition.value = word.definition || '';
    els.fExample.value = word.example || '';
    els.fNote.value = word.note || '';
    els.fRefetchStatus.textContent = '';

    els.modal.classList.remove('hidden');
    els.fText.focus();
  }
  function closeWordModal() { els.modal.classList.add('hidden'); editingId = null; }

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
      els.fTranscription.value = dict.transcription || '';
    }
    els.fRefetchStatus.textContent = (tr.ok || dict.ok) ? '' : 'Nothing found. Edit manually.';
  }

  function saveWord() {
    const text = els.fText.value.trim();
    if (!text) { els.fText.focus(); return; }

    const sourceId = els.fSource.value === BASE_SOURCE ? null : els.fSource.value;

    const existing = Storage.getWords().find(w => w.id === editingId);
    Storage.saveWord({
      id: editingId,
      createdAt: existing ? existing.createdAt : undefined,
      text,
      translation: els.fTranslation.value.trim(),
      transcription: els.fTranscription.value.trim(),
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
    if (name && name.trim()) { s.name = name.trim(); Storage.saveSource(s); refresh(); }
  }

  // Deleting a source never deletes words — they move to the base source (General).
  function deleteSource(id) {
    const s = Storage.getSources().find(x => x.id === id);
    if (!s) return;
    const count = Storage.getWords().filter(w => w.sourceId === id).length;
    const msg = count
      ? `Delete source "${s.name}"? Its ${count} word(s) will move to ${BASE_NAME}.`
      : `Delete source "${s.name}"?`;
    if (confirm(msg)) { Storage.deleteSource(id, 'detach'); refresh(); }
  }

  // --- Tab navigation ---
  function switchView(view) {
    els.tabs.forEach(t => t.setAttribute('aria-current', String(t.dataset.view === view)));
    els.viewWords.classList.toggle('hidden', view !== 'words');
    els.viewSources.classList.toggle('hidden', view !== 'sources');
  }

  // --- Events ---
  function bind() {
    els.tabs.forEach(t => t.addEventListener('click', () => switchView(t.dataset.view)));
    els.search.addEventListener('input', renderList);
    els.filterSource.addEventListener('change', () => { filterSourceId = els.filterSource.value; renderList(); });

    els.fabAdd.addEventListener('click', openAdd);
    els.fabSettings.addEventListener('click', openSettings);

    els.qSrc.addEventListener('change', savePrefsFromAdd);
    els.qSource.addEventListener('change', savePrefsFromAdd);
    els.qWord.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addQuick(); } });
    els.addClose.addEventListener('click', closeAdd);
    els.addModal.addEventListener('click', (e) => { if (e.target === els.addModal) closeAdd(); });

    els.sNative.addEventListener('change', () => { saveSettings(); refresh(); });
    els.sSourceLang.addEventListener('change', saveSettings);
    els.exportBtn.addEventListener('click', exportData);
    els.importBtn.addEventListener('click', () => els.importFile.click());
    els.importFile.addEventListener('change', (e) => { if (e.target.files[0]) importFile(e.target.files[0]); });
    els.settingsClose.addEventListener('click', closeSettings);
    els.settingsModal.addEventListener('click', (e) => { if (e.target === els.settingsModal) closeSettings(); });

    els.addSourceBtn.addEventListener('click', addSourceFromTab);
    els.newSourceName.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addSourceFromTab(); } });

    els.fRefetch.addEventListener('click', refetchModal);
    els.fCancel.addEventListener('click', closeWordModal);
    els.fSave.addEventListener('click', saveWord);
    els.modal.addEventListener('click', (e) => { if (e.target === els.modal) closeWordModal(); });

    // Delegated clicks on word cards (buttons checked before row toggle).
    els.groups.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-edit]');
      const delBtn = e.target.closest('[data-del]');
      const retryBtn = e.target.closest('[data-retry]');
      const toggle = e.target.closest('[data-toggle]');
      if (editBtn) {
        const w = Storage.getWords().find(x => x.id === editBtn.dataset.edit);
        if (w) openWordModal(w);
      } else if (delBtn) {
        if (confirm('Delete this word?')) { Storage.deleteWord(delBtn.dataset.del); refresh(); }
      } else if (retryBtn) {
        enrich(retryBtn.dataset.retry);
      } else if (toggle) {
        const id = toggle.dataset.toggle;
        expanded.has(id) ? expanded.delete(id) : expanded.add(id);
        renderList();
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
