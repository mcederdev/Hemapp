// Datumhjälp. Datum utan tid hanteras som 'YYYY-MM-DD' i lokal tid.

export function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function parseDay(s) { return new Date(s + 'T00:00') }
export function today() { return iso(new Date()) }
export function addDays(s, n) { const d = parseDay(s); d.setDate(d.getDate() + n); return iso(d) }
export function addMonths(s, n) {
  const d = parseDay(s); const day = d.getDate()
  d.setDate(1); d.setMonth(d.getMonth() + n)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return iso(d)
}
export function startOfWeek(s) { const d = parseDay(s); const wd = (d.getDay() + 6) % 7; return addDays(s, -wd) }
export function monthStart(s) { return s.slice(0, 7) + '-01' }
export function weekdayName(s, style = 'long') { return parseDay(s).toLocaleDateString('sv-SE', { weekday: style }) }
export function prettyDay(s) { return parseDay(s).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' }) }
export function monthName(s) { return parseDay(s).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' }) }

// Nästa förfallodag för en återkommande syssla
export function nextDue(due, every, unit) {
  const n = Math.max(1, Number(every) || 1)
  if (unit === 'day') return addDays(due, n)
  if (unit === 'week') return addDays(due, 7 * n)
  if (unit === 'month') return addMonths(due, n)
  return null
}

export function repeatLabel(every, unit) {
  if (!unit) return ''
  const n = Number(every) || 1
  const names = { day: ['varje dag', 'dag'], week: ['varje vecka', 'vecka'], month: ['varje månad', 'månad'] }
  if (n === 1) return names[unit][0]
  if (n === 2) return { day: 'varannan dag', week: 'varannan vecka', month: 'varannan månad' }[unit]
  return `var ${n}:e ${names[unit][1]}`
}

// Lokal dag ('YYYY-MM-DD') för en tidsstämpel som sparats i UTC (t.ex. done_at).
// slice(0, 10) på ISO-strängen ger UTC-dagen, som är fel strax efter midnatt i Sverige.
export function dayOf(ts) { return ts ? iso(new Date(ts)) : null }
