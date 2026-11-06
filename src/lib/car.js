// Bilens kostnader och hur de delas mellan två hushåll
export const CAR_KINDS = [
  { id: 'bransle', label: 'Bensin & laddning', emoji: '⛽', shared: false, quick: true },
  { id: 'forsakring', label: 'Försäkring', emoji: '🛡️', shared: true, quick: true },
  { id: 'parkering', label: 'Parkering', emoji: '🅿️', shared: true, quick: true },
  { id: 'service', label: 'Service & reparation', emoji: '🔧', shared: true, quick: true },
  { id: 'skatt', label: 'Skatt', emoji: '🏛️', shared: true },
  { id: 'besiktning', label: 'Besiktning', emoji: '✅', shared: true },
  { id: 'dack', label: 'Däck', emoji: '🛞', shared: true },
  { id: 'tvatt', label: 'Tvätt', emoji: '🧽', shared: false },
  { id: 'ovrigt', label: 'Övrigt', emoji: '📦', shared: true }
]
export const kindOf = (id) => CAR_KINDS.find((k) => k.id === id) || CAR_KINDS[CAR_KINDS.length - 1]

// Hur mycket det andra hushållet är skyldigt ägarhushållet (negativt = ägaren är skyldig).
// paid_by_household / from_household null betyder det andra (ej kopplade) hushållet.
export function carBalance(car, costs, settlements = []) {
  const share = Number(car.owner_share) / 100
  const byOwner = (h) => h === car.household_id
  let owed = 0
  for (const c of costs) {
    if (!c.shared) continue
    const a = Number(c.amount)
    owed += byOwner(c.paid_by_household) ? a * (1 - share) : -a * share
  }
  for (const s of settlements) owed += byOwner(s.from_household) ? Number(s.amount) : -Number(s.amount)
  return Math.round(owed * 100) / 100
}

// ---- Bilens fakta och automatisk planering ----
const pad = (n) => String(n).padStart(2, '0')
const monthEnd = (y, m) => { const d = new Date(y, m, 0); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` } // m = 1–12
const addMonthsYM = (s, n) => { const [y, m] = s.split('-').map(Number); const k = y * 12 + (m - 1) + n; return [Math.floor(k / 12), (k % 12) + 1] }

// Skatteverket: sista siffran i regnumret styr betalningsmånaden. Över 3 600 kr/år delas skatten på tre månader.
const TAX_MONTH = { 0: 3, 1: 4, 2: 5, 3: 6, 4: 8, 5: 10, 6: 11, 7: 12, 8: 1, 9: 2 }
export function taxMonths(reg, perYear) {
  const digits = String(reg || '').replace(/\D/g, '')
  if (!digits) return []
  const m = TAX_MONTH[digits[digits.length - 1]]
  return Number(perYear) > 3600 ? [m, ((m + 3) % 12) + 1, ((m + 7) % 12) + 1].sort((a, b) => a - b) : [m]
}

// Transportstyrelsen: första besiktningen senast 36 månader efter att bilen togs i trafik,
// andra senast 24 månader efter den första, sedan senast 14 månader efter den förra. Räknas till månadens slut.
export function inspectionDue({ in_traffic: first, last_inspection: last }) {
  if (last) {
    const wasFirst = first && (() => { const [y, m] = addMonthsYM(first, 36); return last <= monthEnd(y, m) })()
    const [y, m] = addMonthsYM(last, wasFirst ? 24 : 14)
    return monthEnd(y, m)
  }
  if (first) { const [y, m] = addMonthsYM(first, 36); return monthEnd(y, m) }
  return null
}

// Nästa gång en viss dag i en månad infaller från och med idag
const nextYearly = (t, month, day) => { const y = Number(t.slice(0, 4)); const s = `${y}-${pad(month)}-${pad(day)}`; return s >= t ? s : `${y + 1}-${pad(month)}-${pad(day)}` }

export const INSPECT_RE = /^besiktiga/i
// Sysslor som saknas för bilen: besiktning, fordonsskatt och däckbyten. Rör inte sådant som redan finns.
export function carPlan(car, chores, t) {
  const open = chores.filter((c) => c.car_id === car.id && !c.done)
  const has = (re) => open.some((c) => re.test(c.title))
  const out = []
  const base = { car_id: car.id, shared: true }
  const due = inspectionDue(car)
  if (due && !has(INSPECT_RE) && !has(/^boka besiktning/i)) {
    const [y, m] = addMonthsYM(due, -1)
    const early = monthEnd(y, m)
    out.push({ ...base, title: `Besiktiga (senast ${new Date(due + 'T12:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })})`, due_date: early < t ? t : early })
  }
  if (!has(/^fordonsskatt/i)) {
    for (const m of taxMonths(car.reg_nr, car.tax_per_year)) {
      const y = Number(t.slice(0, 4)); let d = monthEnd(y, m); if (d < t) d = monthEnd(y + 1, m)
      out.push({ ...base, title: 'Fordonsskatt', due_date: d, fixed_day: true, repeat_every: 12, repeat_unit: 'month' })
    }
  }
  if (!has(/vinterdäck/i)) out.push({ ...base, title: 'Byta till vinterdäck', due_date: nextYearly(t, 10, 15), fixed_day: true, repeat_every: 12, repeat_unit: 'month' })
  if (!has(/sommardäck/i)) out.push({ ...base, title: 'Byta till sommardäck', due_date: nextYearly(t, 4, 1), fixed_day: true, repeat_every: 12, repeat_unit: 'month' })
  return out
}
