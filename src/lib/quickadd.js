// Snabb inmatning: "Tandläkare Juhani tis 15–16" eller "mjölk, ägg, bröd".
// Läser ut dag, klockslag, person och upprepning ur texten. Resten blir titeln.
const p = (s) => new Date(s + 'T12:00:00')
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const plus = (s, n) => { const d = p(s); d.setDate(d.getDate() + n); return iso(d) }

const DAYS = [['mån', 1], ['måndag', 1], ['tis', 2], ['tisdag', 2], ['ons', 3], ['onsdag', 3], ['tor', 4], ['tors', 4], ['torsdag', 4],
  ['fre', 5], ['fredag', 5], ['lör', 6], ['lördag', 6], ['sön', 0], ['söndag', 0]]
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const REPEATS = [[/\bvarje vardag\b/, 'weekdays'], [/\bvarannan vecka\b/, 'biweekly'], [/\bvarje vecka\b/, 'weekly'], [/\bvarje dag\b/, 'daily'],
  [/\bvarje månad\b/, 'monthly'], [/\bvarje år\b/, 'yearly']]
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const pad = (h, m = '00') => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

export function parseQuick(text, { today, members = [] } = {}) {
  let s = ` ${text.trim()} `
  const out = { title: '', date: null, time: null, endTime: null, member: null, repeat: null, items: null }
  const cut = (re) => { s = s.replace(re, ' ') }

  // Upprepning
  for (const [re, val] of REPEATS) if (re.test(s.toLowerCase())) { out.repeat = val; s = s.replace(new RegExp(re.source, 'i'), ' '); break }

  // Klockslag: "kl 15", "15:30", "15.30", "15-16", "10–12:30"
  // Efter "kl" räcker en minutsiffra ("kl 14:0" = 14:00)
  const tm = s.match(/\s(?:kl\.?\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*[-–]\s*(\d{1,2})(?:[:.](\d{2}))?(?=\s)/i) ||
    s.match(/\skl\.?\s*(\d{1,2})(?:[:.](\d{1,2}))?(?=\s)/i) || s.match(/\s(\d{1,2})[:.](\d{2})(?=\s)/)
  if (tm && Number(tm[1]) < 24 && Number(tm[2] || 0) < 60) {
    out.time = pad(tm[1], tm[2] || '00')
    if (tm[3] !== undefined && tm.length > 3 && Number(tm[3]) < 24) out.endTime = pad(tm[3], tm[4] || '00')
    s = s.replace(tm[0], ' ')
  }

  // Dag
  const low = () => s.toLowerCase()
  let m
  if ((m = low().match(/\si\s?övermorgon(?=\s)/))) { out.date = plus(today, 2); cut(/\si\s?övermorgon(?=\s)/i) }
  else if ((m = low().match(/\s(i\s?morgon|imorgon)(?=\s)/))) { out.date = plus(today, 1); cut(/\s(i\s?morgon|imorgon)(?=\s)/i) }
  else if ((m = low().match(/\s(idag|i dag|ikväll|i kväll)(?=\s)/))) { out.date = today; cut(/\s(idag|i dag|ikväll|i kväll)(?=\s)/i) }
  // "4 dec", "4e dec", "4:e december", "1a dec", gärna med "den" före
  else if ((m = low().match(/\s(?:den\s)?(\d{1,2})(?::?[ea])?\s?(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)[a-zåäö]*\.?(?=\s)/))) {
    const mon = MONTHS.indexOf(m[2]); const y = +today.slice(0, 4)
    let d = iso(new Date(y, mon, Number(m[1]), 12)); if (d < today) d = iso(new Date(y + 1, mon, Number(m[1]), 12))
    out.date = d; s = s.replace(new RegExp(esc(m[0].trim()), 'i'), ' ')
  } else if ((m = low().match(/\s(?:den\s)?(\d{1,2})\/(\d{1,2})(?=\s)/))) {
    const y = +today.slice(0, 4); let d = iso(new Date(y, Number(m[2]) - 1, Number(m[1]), 12)); if (d < today) d = iso(new Date(y + 1, Number(m[2]) - 1, Number(m[1]), 12))
    out.date = d; s = s.replace(new RegExp(esc(m[0].trim()), 'i'), ' ')
  } else {
    // Veckodag: närmaste kommande (idag räknas om det är samma dag)
    for (const [name, wd] of [...DAYS].sort((a, b) => b[0].length - a[0].length)) {
      const re = new RegExp(`\\s(nästa\\s)?(på\\s)?${name}(?=\\s)`, 'i')
      const hit = s.match(re)
      if (hit) {
        const cur = p(today).getDay()
        let diff = (wd - cur + 7) % 7
        if (hit[1] && diff === 0) diff = 7
        out.date = plus(today, diff); s = s.replace(hit[0], ' ')
        break
      }
    }
  }

  // Person: ett namn i familjen (hela ordet)
  for (const mem of [...members].sort((a, b) => b.name.length - a.name.length)) {
    const re = new RegExp(`\\s(med\\s|till\\s|för\\s)?${mem.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?(?=[\\s,])`, 'i')
    if (re.test(s)) { out.member = mem.id; s = s.replace(re, ' '); break }
  }

  out.title = s.replace(/\s+/g, ' ').replace(/^\s*[-–,]\s*|\s*[-–,]\s*$/g, '').trim()
  out.title = out.title.charAt(0).toUpperCase() + out.title.slice(1)

  // Flera varor: "mjölk, ägg och bröd" (utan tid och dag)
  const raw = text.replace(/^\s*(köp|handla)\s+/i, '')
  if (!out.date && !out.time && /,|\soch\s/.test(raw)) out.items = raw.split(/,(?!\d)|\soch\s/).map((x) => x.trim()).filter(Boolean).map((x) => x.charAt(0).toUpperCase() + x.slice(1))
  return out
}

// Vad blir det troligen? Händelse om det finns dag eller tid, varor om det är en uppräkning eller börjar med "köp".
export function guessKind(text, parsed) {
  if (/^\s*(köp|handla)\s/i.test(text) || parsed.items) return 'item'
  if (parsed.date || parsed.time) return 'event'
  return 'chore'
}
