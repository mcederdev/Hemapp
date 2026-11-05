// Visar återkommande kalenderhändelser (RRULE från .ics eller från appen)
// inom ett datumintervall. Stöder FREQ=DAILY/WEEKLY/MONTHLY/YEARLY med
// INTERVAL, COUNT, UNTIL och BYDAY (för veckor).

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

// Returnerar starttider (Date) för alla förekomster som börjar inom [from, to)
export function occurrences(start, rruleStr, from, to) {
  const rule = parseRrule(rruleStr)
  const first = new Date(start)
  if (!rule) return first >= from && first < to ? [first] : []
  const interval = Math.max(1, parseInt(rule.INTERVAL || '1', 10))
  const count = rule.COUNT ? parseInt(rule.COUNT, 10) : Infinity
  const until = rule.UNTIL ? untilDate(rule.UNTIL) : null
  const byday = rule.BYDAY ? rule.BYDAY.split(',').map((d) => DAYS[d.slice(-2)]).filter((d) => d !== undefined) : null
  const out = []
  let n = 0
  const push = (d) => {
    if (until && d > until) return false
    if (n >= count) return false
    n++
    if (d >= from && d < to) out.push(d)
    return d < to
  }
  const step = (d, k) => {
    const x = new Date(d)
    if (rule.FREQ === 'DAILY') x.setDate(x.getDate() + k)
    else if (rule.FREQ === 'WEEKLY') x.setDate(x.getDate() + 7 * k)
    else if (rule.FREQ === 'MONTHLY') x.setMonth(x.getMonth() + k)
    else if (rule.FREQ === 'YEARLY') x.setFullYear(x.getFullYear() + k)
    else return null
    return x
  }
  for (let i = 0; i < 5000; i++) {
    const base = step(first, i * interval)
    if (!base) break
    if (rule.FREQ === 'WEEKLY' && byday) {
      const monday = new Date(base); monday.setDate(base.getDate() - ((base.getDay() + 6) % 7))
      let cont = true
      for (const wd of [1, 2, 3, 4, 5, 6, 0]) {
        if (!byday.includes(wd)) continue
        const d = new Date(monday); d.setDate(monday.getDate() + ((wd + 6) % 7))
        if (d < first) continue
        if (!push(d)) { cont = false; break }
      }
      if (!cont) break
    } else if (!push(base)) break
  }
  return out
}

// Bygger en enkel RRULE från appens val
export function simpleRrule(freq) {
  return { weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', weekly: 'FREQ=WEEKLY', biweekly: 'FREQ=WEEKLY;INTERVAL=2', monthly: 'FREQ=MONTHLY', daily: 'FREQ=DAILY', yearly: 'FREQ=YEARLY' }[freq] || null
}
