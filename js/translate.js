// Перевод через бесплатный MyMemory API (без ключа, CORS разрешён).
// Анонимный лимит ~5000 слов/день. Чтобы поднять до ~50000, впишите свой
// email в EMAIL ниже (тогда добавится параметр &de=...).
const Translate = (() => {
  const ENDPOINT = 'https://api.mymemory.translated.net/get';
  const EMAIL = ''; // например 'you@example.com' — необязательно

  // Возвращает { ok: true, text } или { ok: false, error }.
  async function translate(text, srcLang, tgtLang) {
    const q = text.trim();
    if (!q) return { ok: false, error: 'empty' };

    const params = new URLSearchParams({ q, langpair: `${srcLang}|${tgtLang}` });
    if (EMAIL) params.set('de', EMAIL);

    try {
      const res = await fetch(`${ENDPOINT}?${params.toString()}`);
      if (!res.ok) return { ok: false, error: `http ${res.status}` };
      const data = await res.json();
      const translated = data?.responseData?.translatedText;
      if (!translated) return { ok: false, error: 'no translation' };
      // MyMemory может вернуть текст ошибки в поле перевода при превышении лимита.
      if (/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(translated)) {
        return { ok: false, error: 'limit' };
      }
      return { ok: true, text: translated };
    } catch {
      return { ok: false, error: 'network' };
    }
  }

  return { translate };
})();
