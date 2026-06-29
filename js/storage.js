// Хранилище в localStorage. Никаких зависимостей и сети.
// Ключи: dict.words, dict.sources, dict.prefs
const Storage = (() => {
  const K_WORDS = 'dict.words';
  const K_SOURCES = 'dict.sources';
  const K_PREFS = 'dict.prefs';

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      // Повреждённые данные не должны ронять приложение.
      return fallback;
    }
  }
  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  const newId = () =>
    (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));

  // --- Слова ---
  function getWords() { return read(K_WORDS, []); }

  // Создаёт (без id) или обновляет (с id) слово. Возвращает сохранённый объект.
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

  // --- Источники ---
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

  // mode: 'detach' (слова → без источника) или 'delete' (удалить слова источника)
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

  // --- Настройки (последняя языковая пара) ---
  function getPrefs() { return read(K_PREFS, { src: 'en', tgt: 'ru' }); }
  function setPrefs(prefs) { write(K_PREFS, prefs); }

  return {
    getWords, saveWord, deleteWord,
    getSources, saveSource, deleteSource,
    getPrefs, setPrefs,
  };
})();
