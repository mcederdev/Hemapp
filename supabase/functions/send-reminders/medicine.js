// Medicin: hur mycket som är kvar i flaskan. Samma fil används av servern.
// m = { household_id, bottle_size (mängd när flaskan öppnades/justerades), dose, doses_per_day, times, opened_on }
// c = barnets växelvisa boende (custody med exceptions) eller inget. Med c räknas medicinen bara ner
// de tider barnet är hos hushållet som äger medicinen: andra föräldern har en egen uppsättning.
import { withUs } from './custody.js'
const p = (s) => new Date(s + 'T12:00:00Z')
const fmt = (d) => d.toISOString().slice(0, 10)
const days = (a, b) => Math.round((p(b) - p(a)) / 86400000)
const plus = (s, n) => { const d = p(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d) }
const num = (x) => Number(String(x ?? '').replace(',', '.')) || 0

// Hur mycket som tas en viss dag i hushållet som äger medicinen
function usedOn(m, c, day) {
  const times = (m.times || []).filter((x) => x.time && num(x.amount) > 0)
  if (!c) return Number(m.dose) * Number(m.doses_per_day)
  if (!times.length) return withUs(c, m.household_id, day, '12:00') ? Number(m.dose) * Number(m.doses_per_day) : 0
  return times.reduce((a, x) => a + (withUs(c, m.household_id, day, x.time) ? num(x.amount) : 0), 0)
}

export function medicineStatus(m, today, c = null) {
  const full = Number(m.full_size || m.bottle_size) || 1
  const done = (left, daysLeft) => {
    const runsOut = Number.isFinite(daysLeft) ? plus(today, daysLeft) : null
    return { left: Math.round(left * 10) / 10, daysLeft, runsOut, share: Math.min(1, left / full) }
  }
  if (!c) {
    const perDay = Number(m.dose) * Number(m.doses_per_day)
    const left = Math.max(0, Number(m.bottle_size) - perDay * Math.max(0, days(m.opened_on, today)))
    return done(left, perDay > 0 ? Math.floor(left / perDay) : Infinity)
  }
  // Delad vårdnad: gå igenom dag för dag
  let left = Number(m.bottle_size)
  for (let d = m.opened_on; d < today; d = plus(d, 1)) left -= usedOn(m, c, d)
  left = Math.max(0, left)
  // Första dagen (från idag räknat) då det inte räcker: samma som floor(kvar / dygnsdos) utan delad vårdnad
  let rest = left, daysLeft = Infinity
  for (let i = 0; i < 730; i++) {
    rest -= usedOn(m, c, plus(today, i))
    if (rest < 0) { daysLeft = i; break }
  }
  return done(left, daysLeft)
}

// Barnets växelvisa boende ur listan, eller inget om barnet bara bor hos ett hushåll
export const custodyOf = (custody, memberId) => (custody || []).find((x) => x.child_id === memberId) || null

// Enheter: ml (flytande), st (tabletter), doser (nässpray, inhalator, droppar)
export const UNITS = [
  { v: 'ml', label: 'ml', hint: 'Flytande' },
  { v: 'st', label: 'Tabletter', hint: 'Tabletter, kapslar' },
  { v: 'doser', label: 'Doser', hint: 'Nässpray, inhalator' },
]
// "1 dos", "2 doser", "1 st", "5 ml"
export function unitText(unit, n) {
  if (unit === 'doser') return Number(n) === 1 ? 'dos' : 'doser'
  return unit
}
// Vad förpackningen heter: flaska, ask eller förpackning
export function packName(unit) {
  return unit === 'st' ? 'ask' : unit === 'doser' ? 'förpackning' : 'flaska'
}
