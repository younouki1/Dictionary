// Definition + usage example via the free Dictionary API (no key, CORS allowed).
// Works mainly for English words; returns { ok:false } for unsupported
// languages or unknown words (HTTP 404), so context is simply skipped.
const Dictionary = (() => {
  const ENDPOINT = 'https://api.dictionaryapi.dev/api/v2/entries';

  // Returns { ok:true, definition, example, partOfSpeech, transcription } or { ok:false }.
  // `transcription` is IPA (e.g. "/juːˈbɪk.wə.təs/"); it already carries the stress mark ˈ.
  async function lookup(word, lang) {
    const q = word.trim();
    if (!q) return { ok: false };

    try {
      const res = await fetch(`${ENDPOINT}/${encodeURIComponent(lang)}/${encodeURIComponent(q)}`);
      if (!res.ok) return { ok: false }; // 404 = no entry / unsupported language
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) return { ok: false };
      const entry = data[0];

      let definition = '';
      let partOfSpeech = '';
      let example = '';
      // First definition overall, and the first example found anywhere.
      for (const meaning of entry.meanings || []) {
        for (const d of meaning.definitions || []) {
          if (!definition && d.definition) {
            definition = d.definition;
            partOfSpeech = meaning.partOfSpeech || '';
          }
          if (!example && d.example) example = d.example;
        }
      }
      if (!definition) return { ok: false };

      // IPA transcription: prefer the top-level field, else the first phonetics entry.
      let transcription = entry.phonetic || '';
      if (!transcription) {
        for (const p of entry.phonetics || []) { if (p && p.text) { transcription = p.text; break; } }
      }

      return { ok: true, definition, example, partOfSpeech, transcription };
    } catch {
      return { ok: false };
    }
  }

  return { lookup };
})();
