// Kategorier för kalenderposter
export const CATEGORIES = [
  { id: 'jobb', label: 'Jobb', emoji: '💼' },
  { id: 'skola', label: 'Skola/förskola', emoji: '🏫' },
  { id: 'fritid', label: 'Fritid & träning', emoji: '⚽' },
  { id: 'vard', label: 'Läkare & vård', emoji: '🩺' },
  { id: 'kalas', label: 'Kalas & fest', emoji: '🎉' },
  { id: 'resa', label: 'Resa', emoji: '✈️' },
  { id: 'ledig', label: 'Ledig', emoji: '🌴' },
  { id: 'ovrigt', label: 'Övrigt', emoji: '📌' }
]
export const catById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

const WORDS = [
  ['skola', /(för)?skola|fritids|skoldag|utvecklingssamtal/i],
  ['jobb', /\b(jobb|arbete|arbetspass|pass|apt|kontor)\b/i],
  ['vard', /tandläk|läkare|vårdcentral|vårdbesök|bvc|vaccin|sjukhus|tandvård/i],
  ['kalas', /kalas|födelsedag|fest|bröllop/i],
  ['fritid', /fotboll|träning|simning|dans|innebandy|hockey|ridning|gympa|match|scout|gitarr|piano/i],
  ['resa', /resa|flyg|semester|tåg till/i],
  ['ledig', /\bledig|fridag|semesterdag/i]
]

// Gissar kategori: först hushållets egna regler (t.ex. M1L… = jobb), sedan vanliga ord
export function guessCategory(title, rules = []) {
  const t = (title || '').trim()
  for (const r of rules || []) if (r.prefix && t.toLowerCase().startsWith(r.prefix.toLowerCase())) return r.category
  for (const [id, re] of WORDS) if (re.test(t)) return id
  return null
}

// Förslag på prefix för en regel: inledande bokstäver/siffror före löpnumret, t.ex. "M1L494" → "M1L"
export function rulePrefix(title) {
  const m = (title || '').trim().match(/^([A-Za-zÅÄÖåäö]+\d?[A-Za-zÅÄÖåäö]+)\d/)
  return m ? m[1] : null
}
