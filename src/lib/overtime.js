// Övertid enligt kollektivavtalet (Mom 7):
// Vardag mån–fre 06–20 (ej helgdag): fast månadslön / 94 per timme. Annan tid: lön / 72.
// Arbetsfria vardagar samt midsommar-, jul- och nyårsafton räknas som annan tid. Under 15 minuter i följd ersätts inte.
const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(y, month - 1, day, 12)
}
const plus = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return ymd(x) }
const satBetween = (y, m, from) => { for (let d = from; d < from + 7; d++) { const x = new Date(y, m - 1, d, 12); if (x.getDay() === 6) return ymd(x) } }

const cache = {}
// Svenska helgdagar och aftnar som räknas som annan tid
export function redDays(y) {
  if (cache[y]) return cache[y]
  const e = easter(y)
  const midsommardag = satBetween(y, 6, 20)
  const set = new Set([`${y}-01-01`, `${y}-01-06`, `${y}-05-01`, `${y}-06-06`, `${y}-12-24`, `${y}-12-25`, `${y}-12-26`, `${y}-12-31`,
    plus(e, -2), plus(e, 1), plus(e, 39), midsommardag, plus(new Date(midsommardag + 'T12:00'), -1), satBetween(y, 10, 31)])
  return (cache[y] = set)
}
export const isRed = (dayStr) => redDays(Number(dayStr.slice(0, 4))).has(dayStr)

// Delar upp ett pass i minuter "vardag 06–20" och "annan tid"
export function splitOvertime(start, end, { freeDay = false } = {}) {
  let day = 0, other = 0
  for (let t = new Date(start); t < end;) {
    const next = new Date(t); next.setSeconds(0, 0)
    const h = t.getHours()
    // nästa gräns: 06:00, 20:00 eller midnatt
    if (h < 6) next.setHours(6, 0) ; else if (h < 20) next.setHours(20, 0); else { next.setDate(next.getDate() + 1); next.setHours(0, 0) }
    const stop = next < end ? next : end
    const mins = Math.round((stop - t) / 60000)
    const wd = t.getDay(), ds = ymd(t)
    const weekday = wd >= 1 && wd <= 5 && !isRed(ds) && !freeDay
    if (weekday && h >= 6 && h < 20) day += mins; else other += mins
    t = stop
  }
  if (day + other < 15) return { day: 0, other: 0, total: 0, short: true }
  return { day, other, total: day + other }
}

export const rates = (s) => ({ day: Number(s?.salary) / Number(s?.div_day || 94), other: Number(s?.salary) / Number(s?.div_other || 72) })
export function overtimePay(split, s) {
  if (!Number(s?.salary)) return 0
  const r = rates(s)
  return (split.day / 60) * r.day + (split.other / 60) * r.other
}
export const fmtH = (mins) => { const h = Math.floor(mins / 60), m = mins % 60; return h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min` }

// Näst sista dagen i månaden
export function reportDay(dayStr) {
  const [y, m] = dayStr.split('-').map(Number)
  return ymd(new Date(y, m, -1, 12))
}
