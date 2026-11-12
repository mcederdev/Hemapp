// Visar återkommande kalenderhändelser (RRULE från .ics eller från appen)
// inom ett datumintervall. Stöder FREQ=DAILY/WEEKLY/MONTHLY/YEARLY med
// INTERVAL, COUNT, UNTIL, BYDAY (veckor och månader, t.ex. 1MO) och BYMONTHDAY.

const DAYS = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 }

export function parseRrule(s) {
  if (!s) return null
  const out = {}
  for (const part of s.replace(/^RRULE:/i, '').split(';')) {
    const [k, v] = part.split('=')
    if (k && v) out[k.toUpperCase()] = v
  }
  return out.FREQ ? out : null
}

function untilDate(v) {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/)
  if (!m) return null
  const [, y, mo, d, h = '23', mi = '59', s = '59', z] = m
  return z ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)) : new Date(+y, +mo - 1, +d, +h, +mi, +s)
}

// Returnerar starttider (Date) för alla förekomster som börjar inom [from, to).
// exdates = tillfällen som tagits bort (ISO-strängar eller Date).
export function occurrences(start, rruleStr, from, to, exdates) {
  const all = occurrencesAll(start, rruleStr, from, to)
  if (!exdates?.length) return all
  const skip = new Set(exdates.map((d) => new Date(d).getTime()))
  return all.filter((d) => !skip.has(d.getTime()))
}

const DAY_MS = 86400000
// Längsta möjliga period, så att framhoppet aldrig hoppar förbi ett tillfälle
const PERIOD = { DAILY: DAY_MS, WEEKLY: 7 * DAY_MS, MONTHLY: 31 * DAY_MS, YEARLY: 366 * DAY_MS }
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate()

// Dagar i en månad som matchar BYDAY (t.ex. 1MO, -1FR, TU) och/eller BYMONTHDAY (t.ex. 15, -1)
function monthDays(y, m, byday, bymonthday) {
  const len = daysIn(y, m)
  let out = null
  if (bymonthday) out = bymonthday.map((d) => (d < 0 ? len + d + 1 : d)).filter((d) => d >= 1 && d <= len)
  if (byday) {
    const hits = []
    for (const { wd, nth } of byday) {
      const all = []
      for (let d = 1; d <= len; d++) if (new Date(y, m, d).getDay() === wd) all.push(d)
      if (!nth) hits.push(...all)
      else { const d = nth > 0 ? all[nth - 1] : all[all.length + nth]; if (d) hits.push(d) }
    }
    out = out ? out.filter((d) => hits.includes(d)) : hits
  }
  return [...new Set(out)].sort((a, b) => a - b)
}

function occurrencesAll(start, rruleStr, from, to) {
  const rule = parseRrule(rruleStr)
  const first = new Date(start)
  if (!rule) return first >= from && first < to ? [first] : []
  if (!PERIOD[rule.FREQ]) return first >= from && first < to ? [first] : []
  const interval = Math.max(1, parseInt(rule.INTERVAL || '1', 10))
  const count = rule.COUNT ? parseInt(rule.COUNT, 10) : Infinity
  const until = rule.UNTIL ? untilDate(rule.UNTIL) : null
  const bydayRaw = rule.BYDAY ? rule.BYDAY.split(',').map((d) => ({ wd: DAYS[d.slice(-2).toUpperCase()], nth: parseInt(d.slice(0, -2), 10) || 0 })).filter((d) => d.wd !== undefined) : null
  const byday = bydayRaw && bydayRaw.length ? bydayRaw : null
  const bymonthday = rule.BYMONTHDAY ? rule.BYMONTHDAY.split(',').map(Number).filter((d) => d && Math.abs(d) <= 31) : null
  const out = []
  let n = 0
  const push = (d) => {
    if (until && d > until) return false
    if (n >= count) return false
    n++
    if (d >= from && d < to) out.push(d)
    return d < to
  }
  const at = (y, m, d) => new Date(y, m, d, first.getHours(), first.getMinutes(), first.getSeconds())
  // Utan COUNT kan vi hoppa fram till strax före visningen, så att gamla serier inte tar slut
  const skip = count === Infinity && from > first ? Math.max(0, Math.floor((from - first) / (PERIOD[rule.FREQ] * interval)) - 1) : 0
  for (let i = skip; i < skip + 5000; i++) {
    const k = i * interval
    let cands
    if (rule.FREQ === 'DAILY') cands = [at(first.getFullYear(), first.getMonth(), first.getDate() + k)]
    else if (rule.FREQ === 'WEEKLY') {
      const base = at(first.getFullYear(), first.getMonth(), first.getDate() + 7 * k)
      if (!byday) cands = [base]
      else {
        const monday = (base.getDay() + 6) % 7
        cands = [1, 2, 3, 4, 5, 6, 0].filter((wd) => byday.some((b) => b.wd === wd))
          .map((wd) => at(base.getFullYear(), base.getMonth(), base.getDate() - monday + ((wd + 6) % 7)))
      }
    } else {
      const y = rule.FREQ === 'YEARLY' ? first.getFullYear() + k : first.getFullYear() + Math.floor((first.getMonth() + k) / 12)
      const m = rule.FREQ === 'YEARLY' ? first.getMonth() : (first.getMonth() + k) % 12
      // Månader utan dagen (31:a, 29 feb) hoppas över, enligt RFC 5545
      const days = rule.FREQ === 'MONTHLY' && (byday || bymonthday) ? monthDays(y, m, byday, bymonthday)
        : first.getDate() <= daysIn(y, m) ? [first.getDate()] : []
      cands = days.map((d) => at(y, m, d))
      if (!cands.length) {
        if (until && new Date(y, m, 1) > until) break
        if (new Date(y, m, 1) >= to) break
        continue
      }
    }
    let cont = true
    for (const d of cands) {
      if (d < first) continue
      if (!push(d)) { cont = false; break }
    }
    if (!cont) break
  }
  return out
}

// Bygger en enkel RRULE från appens val, ev. med slutdatum (YYYY-MM-DD)
export function simpleRrule(freq, until) {
  const base = simpleBase(freq)
  return base && until ? `${base};UNTIL=${until.replaceAll('-', '')}T235959` : base
}
function simpleBase(freq) {
  return { weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', weekdays2: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TU,WE,TH,FR', weekly: 'FREQ=WEEKLY', biweekly: 'FREQ=WEEKLY;INTERVAL=2', monthly: 'FREQ=MONTHLY', daily: 'FREQ=DAILY', yearly: 'FREQ=YEARLY' }[freq] || null
}
