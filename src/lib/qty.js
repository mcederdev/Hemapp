// Mängder på varor: "2 st", "500 g", "1,5 dl", eller flera delar "500 g + 1 burk".
// Mängden sparas som text så att den alltid går att skriva fritt, men räknas ihop när det går.

// Enheter som går att räkna om till en bas (vikt i gram, volym i dl)
const BASE = { g: ['g', 1], kg: ['g', 1000], hg: ['g', 100], mg: ['g', 0.001], dl: ['dl', 1], l: ['dl', 10], cl: ['dl', 0.1], ml: ['dl', 0.01] }
// Andra sätt att skriva samma enhet
const ALIAS = {
  styck: 'st', stycken: 'st', 'st.': 'st', gram: 'g', kilo: 'kg', liter: 'l', 'msk.': 'msk', 'tsk.': 'tsk', 'krm.': 'krm',
  matsked: 'msk', matskedar: 'msk', tesked: 'tsk', teskedar: 'tsk', kryddmått: 'krm',
  burkar: 'burk', paket: 'paket', pkt: 'paket', 'pkt.': 'paket', förp: 'förp', 'förp.': 'förp', förpackning: 'förp', förpackningar: 'förp',
  påsar: 'påse', tuber: 'tub', klyftor: 'klyfta', skivor: 'skiva', knippen: 'knippe', krukor: 'kruka', askar: 'ask', flaskor: 'flaska',
  bitar: 'bit', tärningar: 'tärning', kvistar: 'kvist', nypor: 'nypa', portioner: 'port', portion: 'port', näven: 'näve', nävar: 'näve',
  stora: null, små: null
}
const UNITS = new Set(['st', 'g', 'kg', 'hg', 'mg', 'ml', 'cl', 'dl', 'l', 'msk', 'tsk', 'krm', 'burk', 'paket', 'förp', 'påse', 'klyfta', 'skiva',
  'knippe', 'kruka', 'ask', 'flaska', 'tub', 'bit', 'tärning', 'kvist', 'nypa', 'port', 'blad', 'näve', 'cm', 'liten', 'stor'])
// Enheter man köper hela av (avrundas uppåt när en mängd räknas om för fler portioner)
const WHOLE = new Set(['st', 'tub', 'burk', 'paket', 'förp', 'påse', 'knippe', 'kruka', 'ask', 'flaska', 'tärning'])

export function unitOf(word) {
  const w = String(word || '').toLowerCase()
  if (w in ALIAS) return ALIAS[w]
  const bare = w.replace(/\.$/, '')
  return UNITS.has(bare) ? bare : null
}

const FRAC = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 }
const NUM = '(?:\\d+\\s+\\d+\\s*/\\s*\\d+|\\d+\\s*[½¼¾⅓⅔]|\\d+(?:[.,]\\d+)?(?:\\s*/\\s*\\d+)?|[½¼¾⅓⅔])'
const toNum = (s) => {
  const mixed = s.trim().match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/) // "1 1/2"
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / (Number(mixed[3]) || 1)
  s = s.replace(/\s+/g, '')
  const m = s.match(/^(\d+)([½¼¾⅓⅔])$/)
  if (m) return Number(m[1]) + FRAC[m[2]]
  if (FRAC[s] != null) return FRAC[s]
  if (s.includes('/')) { const [a, b] = s.split('/').map(Number); return b ? a / b : a }
  return Number(s.replace(',', '.'))
}

// "2 st + 500 g" -> [{ n: 2, u: 'st' }, { n: 500, u: 'g' }]. Det som inte går att läsa blir { text }.
export function parseQty(s) {
  const out = []
  for (const part of String(s || '').split('+').map((x) => x.trim()).filter(Boolean)) {
    const m = part.match(new RegExp(`^(${NUM})(?:\\s*[-–]\\s*(${NUM}))?\\s*(\\S+)?$`))
    const u = m && (m[3] ? unitOf(m[3]) : 'st')
    if (m && u) out.push({ n: toNum(m[2] || m[1]), u })
    else out.push({ text: part })
  }
  return out
}

const nice = (n) => {
  const r = Math.round(n * 100) / 100
  return String(r).replace('.', ',')
}
// Visa i en rimlig enhet: 1500 g -> 1,5 kg, 15 dl -> 1,5 l
const PLURAL = { burk: 'burkar', påse: 'påsar', klyfta: 'klyftor', skiva: 'skivor', kruka: 'krukor', ask: 'askar', flaska: 'flaskor', tub: 'tuber', bit: 'bitar', tärning: 'tärningar', kvist: 'kvistar', nypa: 'nypor', knippe: 'knippen' }
function show({ n, u }) {
  if (u === 'g' && n >= 1000) return `${nice(n / 1000)} kg`
  if (u === 'dl' && n >= 10) return `${nice(n / 10)} l`
  if (u === 'dl' && n < 0.5) return `${nice(n * 100)} ml`
  // Halva saker visas som ½: "½ st", "1½ burk"
  const half = WHOLE.has(u) && Math.abs((n % 1) - 0.5) < 0.001
  const num = half ? `${Math.floor(n) || ''}½` : nice(n)
  return `${num} ${n > 1 && PLURAL[u] ? PLURAL[u] : u}`
}

// Slå ihop delar med samma (eller omräkningsbar) enhet
function merge(parts) {
  const sums = new Map(), texts = []
  for (const p of parts) {
    if (p.text) { if (!texts.includes(p.text)) texts.push(p.text); continue }
    const [u, f] = BASE[p.u] || [p.u, 1]
    sums.set(u, (sums.get(u) || 0) + p.n * f)
  }
  return [...[...sums].map(([u, n]) => ({ n, u })), ...texts.map((text) => ({ text }))]
}

export const formatQty = (parts) => merge(parts).map((p) => (p.text ? p.text : show(p))).join(' + ')
// Lägg ihop två mängder: addQty('1 st', '1 st') === '2 st'. Tom mängd räknas som ingenting.
export const addQty = (...qs) => formatQty(qs.flatMap(parseQty))
export const normQty = (q) => formatQty(parseQty(q))

// Räkna om en mängd för fler eller färre portioner
export function scaleQty(q, factor) {
  if (!q || factor === 1) return q || ''
  return formatQty(parseQty(q).map((p) => {
    if (p.text) return p
    let n = p.n * factor
    if (WHOLE.has(p.u)) n = Math.ceil(n * 2 - 0.001) / 2 // halva gurkor går bra, men inte 1,37
    else if (p.u === 'g') n = n >= 100 ? Math.round(n / 25) * 25 : Math.round(n)
    else n = Math.round(n * 4) / 4
    return { n, u: p.u }
  }))
}

const cap = (s) => { const i = s.search(/\p{L}/u); return i < 0 ? s : s.slice(0, i) + s.charAt(i).toUpperCase() + s.slice(i + 1) }

// En rad från ett recept: "ca 2 dl vispgrädde", "1 gul lök, finhackad", "1 burk krossade tomater (400 g)"
// -> { name: 'Vispgrädde', qty: '2 dl' }
export function parseIngredient(line) {
  let s = String(line || '').replace(/[\u00ad\u200b-\u200f\u2060\ufeff]/g, '').replace(/\u00a0/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/[•·*]/g, ' ').replace(/\s+/g, ' ').trim()
  s = s.replace(/^(ca\.?|cirka|ungefär|c:a)\s+/i, '')
  let qty = ''
  const m = s.match(new RegExp(`^(${NUM})(?:\\s*[-–]\\s*(${NUM}))?\\s+(.*)$`))
  if (m) {
    const n = toNum(m[2] || m[1])
    let rest = m[3]
    const [w, ...more] = rest.split(' ')
    const u = more.length ? unitOf(w) : null
    if (u) rest = more.join(' ') // "1 stor gul lök" -> 1 st Gul lök
    qty = formatQty([{ n, u: u && u !== 'liten' && u !== 'stor' ? u : 'st' }])
    s = rest
  }
  s = s.split(/,|\s+till\s+servering|\s+att\s+servera/i)[0].replace(/^(st|styck)\s+/i, '').replace(/[.:;]+$/, '').trim()
  return { name: cap(s), qty }
}

// Sådant som nästan alltid finns hemma. Kryssas inte i automatiskt när varorna läggs på listan.
export function isBasic(name) {
  const n = String(name || '').toLowerCase().trim()
  return /^(salt|flingsalt|havssalt|(svart|vit|cayenne)?peppar|nymald (svart)?peppar|salt och (svart)?peppar|(oliv|raps|mat|sesam|neutral )?olja|vatten|kallt vatten|ljummet vatten|kokande vatten|socker|strösocker|is)\b/.test(n) || /till stekning|att steka i/.test(n)
}

// En rätts varor med mängder. Gamla rader har bara namn (items), nya har lines med mängd.
export function linesOf(row, fallback = []) {
  if (row?.lines?.length) return row.lines.map((l) => ({ name: l.name, qty: l.qty || '' }))
  if (row?.items) return row.items.map((name) => ({ name, qty: '' }))
  return fallback.map((x) => (typeof x === 'string' ? parseIngredient(x) : x))
}

// Varor från flera rätter ihop, med summerade mängder. Två rätter med 1 st gurka -> Gurka 2 st.
export function combineLines(groups) {
  const by = new Map()
  for (const { dish, lines } of groups) for (const l of lines) {
    const k = itemKey(l.name)
    if (!k) continue
    const cur = by.get(k) || { name: l.name.trim(), qty: '', dishes: [] }
    cur.qty = addQty(cur.qty, l.qty)
    if (dish && !cur.dishes.includes(dish)) cur.dishes.push(dish)
    by.set(k, cur)
  }
  return [...by.values()]
}

// "2 gurkor" / "gurka 2" / "mjölk 1 l" i snabbinmatningen -> { name, qty }
export function splitTyped(text) {
  const s = text.trim()
  const front = parseIngredient(s)
  if (front.qty && front.name) return front
  const m = s.match(new RegExp(`^(.*\\S)\\s+(${NUM}(?:\\s*\\S+)?)$`))
  if (m) { const q = parseQty(m[2]); if (q.length === 1 && !q[0].text) return { name: cap(m[1]), qty: formatQty(q) } }
  return { name: cap(s), qty: '' }
}

// Lägg till en mängd på en vara som redan står på listan. En vara utan mängd räknas som 1 st
// om det som läggs till också räknas i styck (Gurka + 1 st gurka = 2 st).
export function addToItem(existing, q) {
  if (!q) return existing || ''
  if (!existing && parseQty(q).every((p) => p.u === 'st')) return addQty('1 st', q)
  return addQty(existing, q)
}

// Nyckel för att känna igen samma vara i ental och flertal: Gurka/Gurkor, Tomat/Tomater, Lök/Lökar
export function itemKey(name) {
  const n = String(name || '').trim().toLowerCase()
  const stem = n.replace(/(or|ar|er|a)$/, '')
  return stem.length >= 3 && stem !== n ? stem : n
}
