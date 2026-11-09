// Återkommande kostnader: varje månad, kvartal eller år (every_months = 1, 3 eller 12)
import { addMonths } from './dates.js'

export const REPEATS = [{ n: null, label: 'Nej' }, { n: 1, label: 'Månad' }, { n: 3, label: 'Kvartal' }, { n: 12, label: 'År' }]
export const repeatText = (n) => ({ 1: 'varje månad', 3: 'varje kvartal', 12: 'varje år' })[n] || ''
export const perText = (n) => ({ 1: '/mån', 3: '/kvartal', 12: '/år' })[n] || ''

// Antal månader mellan två datum (bara år och månad räknas)
export const monthsBetween = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7))

// Abonnemang: hur ofta det dras. Äldre rader har bara period (month/year).
export const subMonths = (s) => Number(s.every_months) || (s.period === 'year' ? 12 : 1)

// Räkningar: hur ofta en fast räkning kommer. Äldre fasta räkningar saknar every_months och gäller varje månad.
export const billMonths = (b) => (b.kind === 'once' ? 0 : Number(b.every_months) || 1)
// Syns räkningen i månaden (första dagen i månaden)?
export function billInMonth(b, month) {
  if (b.kind === 'once') return b.month === month
  const n = billMonths(b)
  if (!b.month) return n === 1
  const d = monthsBetween(b.month, month)
  return d >= 0 && d % n === 0
}

// Bilkostnader: nästa datum för en återkommande kostnad, och alla datum som passerats till och med t
export const nextDay = (c) => addMonths(c.day, Number(c.every_months))
export function dueDays(c, t) {
  const out = []
  if (!Number(c.every_months)) return out
  let d = nextDay(c)
  while (d <= t && out.length < 60) { out.push(d); d = addMonths(d, Number(c.every_months)) }
  return out
}
// Kommande datum efter t till och med end
export function futureDays(c, t, end) {
  const out = []
  if (!Number(c.every_months)) return out
  let d = nextDay(c)
  while (d <= end && out.length < 60) { if (d > t) out.push(d); d = addMonths(d, Number(c.every_months)) }
  return out
}
