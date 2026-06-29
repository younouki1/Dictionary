// Translation via the free MyMemory API (no key, CORS allowed).
// Anonymous limit ~5000 words/day. To raise it to ~50000, put your email
// in EMAIL below (it adds the &de=... parameter).
const Translate = (() => {
  const ENDPOINT = 'https://api.mymemory.translated.net/get';
  const EMAIL = ''; // e.g. 'you@example.com' — optional

  // Returns { ok: true, text } or { ok: false, error }.
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
      // MyMemory may return an error string in the translation field when the limit is exceeded.
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
