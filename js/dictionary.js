// Definition + usage example via the free Dictionary API (no key, CORS allowed).
// Works mainly for English words; returns { ok:false } for unsupported
// languages or unknown words (HTTP 404), so context is simply skipped.
const Dictionary = (() => {
  const ENDPOINT = 'https://api.dictionaryapi.dev/api/v2/entries';

  // Returns { ok:true, definition, example, partOfSpeech } or { ok:false }.
  async function lookup(word, lang) {
    const q = word.trim();
    if (!q) return { ok: false };

    try {
      const res = await fetch(`${ENDPOINT}/${encodeURIComponent(lang)}/${encodeURIComponent(q)}`);
      if (!res.ok) return { ok: false }; // 404 = no entry / unsupported language
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) return { ok: false };

      let definition = '';
      let partOfSpeech = '';
      let example = '';
      // First definition overall, and the first example found anywhere.
      for (const meaning of data[0].meanings || []) {
        for (const d of meaning.definitions || []) {
          if (!definition && d.definition) {
            definition = d.definition;
            partOfSpeech = meaning.partOfSpeech || '';
          }
          if (!example && d.example) example = d.example;
        }
      }
      if (!definition) return { ok: false };
      return { ok: true, definition, example, partOfSpeech };
    } catch {
      return { ok: false };
    }
  }

  return { lookup };
})();
