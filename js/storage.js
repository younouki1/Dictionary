// localStorage-backed storage. No dependencies, no network.
// Keys: dict.words, dict.sources, dict.prefs
const Storage = (() => {
  const K_WORDS = 'dict.words';
  const K_SOURCES = 'dict.sources';
  const K_PREFS = 'dict.prefs';

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      // Corrupted data must not crash the app.
      return fallback;
    }
  }
  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  const newId = () =>
    (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));

  // --- Words ---
  function getWords() { return read(K_WORDS, []); }

  // Creates (no id) or updates (with id) a word. Returns the saved object.
  function saveWord(word) {
    const words = getWords();
    if (word.id) {
      const i = words.findIndex(w => w.id === word.id);
      if (i !== -1) words[i] = word;
      else words.push(word);
    } else {
      word.id = newId();
      word.createdAt = Date.now();
      words.push(word);
    }
    write(K_WORDS, words);
    return word;
  }

  function deleteWord(id) {
    write(K_WORDS, getWords().filter(w => w.id !== id));
  }

  // --- Sources ---
  function getSources() { return read(K_SOURCES, []); }

  function saveSource(source) {
    const sources = getSources();
    if (source.id) {
      const i = sources.findIndex(s => s.id === source.id);
      if (i !== -1) sources[i] = source;
      else sources.push(source);
    } else {
      source.id = newId();
      sources.push(source);
    }
    write(K_SOURCES, sources);
    return source;
  }

  // mode: 'detach' (words -> no source) or 'delete' (delete the source's words)
  function deleteSource(id, mode = 'detach') {
    write(K_SOURCES, getSources().filter(s => s.id !== id));
    const words = getWords();
    if (mode === 'delete') {
      write(K_WORDS, words.filter(w => w.sourceId !== id));
    } else {
      words.forEach(w => { if (w.sourceId === id) w.sourceId = null; });
      write(K_WORDS, words);
    }
  }

  // --- Preferences (last language pair) ---
  function getPrefs() { return read(K_PREFS, { src: 'en', tgt: 'ru' }); }
  function setPrefs(prefs) { write(K_PREFS, prefs); }

  return {
    getWords, saveWord, deleteWord,
    getSources, saveSource, deleteSource,
    getPrefs, setPrefs,
  };
})();
