// Definition + usage example via the free Dictionary API (no key, CORS allowed).
// Works mainly for English words; returns { ok:false } for unsupported
// languages or unknown words (HTTP 404), so context is simply skipped.
const Dictionary = (() => {
  const ENDPOINT = 'https://api.dictionaryapi.dev/api/v2/entries';

  // Raw lookup of one exact word form. Returns parsed fields or null.
  async function fetchEntry(word, lang) {
    try {
      const res = await fetch(`${ENDPOINT}/${encodeURIComponent(lang)}/${encodeURIComponent(word)}`);
      if (!res.ok) return null; // 404 = no entry / unsupported language
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) return null;
      const entry = data[0];

      let definition = '';
      let partOfSpeech = '';
      let example = '';
      for (const meaning of entry.meanings || []) {
        for (const d of meaning.definitions || []) {
          if (!definition && d.definition) {
            definition = d.definition;
            partOfSpeech = meaning.partOfSpeech || '';
          }
          if (!example && d.example) example = d.example;
        }
      }

      let transcription = entry.phonetic || '';
      if (!transcription) {
        for (const p of entry.phonetics || []) { if (p && p.text) { transcription = p.text; break; } }
      }
      return { definition, example, partOfSpeech, transcription };
    } catch {
      return null;
    }
  }

  // Candidate base forms for an inflected English word (plurals / verb forms).
  function lemmas(word) {
    const w = word.toLowerCase();
    const out = [];
    if (w.endsWith('ies') && w.length > 4) out.push(w.slice(0, -3) + 'y');
    if (w.endsWith('es') && w.length > 3) out.push(w.slice(0, -2));
    if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) out.push(w.slice(0, -1));
    if (w.endsWith('ed') && w.length > 3) out.push(w.slice(0, -2));
    if (w.endsWith('ing') && w.length > 4) out.push(w.slice(0, -3));
    return [...new Set(out)].filter(x => x !== w).slice(0, 2);
  }

  // Returns { ok:true, definition, example, partOfSpeech, transcription } or { ok:false }.
  // `transcription` is IPA (e.g. "/juːˈbɪk.wə.təs/"); it already carries the stress mark ˈ.
  // Inflected forms (e.g. "infants") often have a definition but no phonetic — fall back
  // to a base form (e.g. "infant") to recover the transcription.
  async function lookup(word, lang) {
    const q = word.trim();
    if (!q) return { ok: false };

    let r = await fetchEntry(q, lang);
    const candidates = lemmas(q);

    // No entry at all (404): try base forms for the whole result.
    if (!r || !r.definition) {
      for (const c of candidates) {
        const alt = await fetchEntry(c, lang);
        if (alt && alt.definition) { r = alt; break; }
      }
    } else if (!r.transcription) {
      // Have a definition but no transcription: borrow it from a base form.
      for (const c of candidates) {
        const alt = await fetchEntry(c, lang);
        if (alt && alt.transcription) { r.transcription = alt.transcription; break; }
      }
    }

    if (!r || !r.definition) return { ok: false };
    return { ok: true, ...r };
  }

  return { lookup };
})();
