// Translation: Google's free endpoint as primary (accurate, no key, CORS ok),
// MyMemory as fallback. Returns { ok:true, text } or { ok:false, error }.
//
// Note: the Google endpoint is unofficial and undocumented — it can change or
// rate-limit, which is why MyMemory stays as a fallback.
const Translate = (() => {
  const GOOGLE = 'https://translate.googleapis.com/translate_a/single';
  const MYMEMORY = 'https://api.mymemory.translated.net/get';
  const EMAIL = ''; // optional MyMemory email to raise the daily limit (~50k)

  async function google(text, src, tgt) {
    const params = new URLSearchParams({ client: 'gtx', sl: src, tl: tgt, dt: 't', q: text });
    try {
      const res = await fetch(`${GOOGLE}?${params.toString()}`);
      if (!res.ok) return { ok: false };
      const data = await res.json();
      // data[0] is an array of [translatedSegment, sourceSegment, ...]; join the segments.
      const segs = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : [];
      const out = segs.map(s => (s && s[0]) || '').join('').trim();
      return out ? { ok: true, text: out } : { ok: false };
    } catch {
      return { ok: false };
    }
  }

  async function myMemory(text, src, tgt) {
    const params = new URLSearchParams({ q: text, langpair: `${src}|${tgt}` });
    if (EMAIL) params.set('de', EMAIL);
    try {
      const res = await fetch(`${MYMEMORY}?${params.toString()}`);
      if (!res.ok) return { ok: false, error: `http ${res.status}` };
      const data = await res.json();

      // Prefer the highest-quality match — the default translatedText is sometimes
      // a low-quality transliteration (e.g. "infants" -> "MLADENETS").
      let best = '';
      let bestQ = -1;
      for (const m of data.matches || []) {
        const t = (m && m.translation || '').trim();
        const q = Number(m && m.quality) || 0;
        if (t && q > bestQ && !/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(t)) { best = t; bestQ = q; }
      }
      const fallback = (data.responseData && data.responseData.translatedText || '').trim();
      const text2 = best || fallback;
      if (!text2 || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(text2)) return { ok: false, error: 'limit' };
      return { ok: true, text: text2 };
    } catch {
      return { ok: false, error: 'network' };
    }
  }

  async function translate(text, srcLang, tgtLang) {
    const q = text.trim();
    if (!q) return { ok: false, error: 'empty' };
    const g = await google(q, srcLang, tgtLang);
    if (g.ok) return g;
    return myMemory(q, srcLang, tgtLang);
  }

  return { translate };
})();
