import { occurrences } from './rrule'

// Expanderar händelser (inkl. återkommande) till förekomster inom [from, to)
export function expandEvents(events, from, to) {
  const out = []
  for (const e of events) {
    const start = new Date(e.starts_at)
    const dur = e.ends_at ? new Date(e.ends_at) - start : 0
    // Heldagshändelser över flera dagar: räkna med dem om de överlappar
    const searchFrom = new Date(from.getTime() - Math.max(0, dur))
    for (const o of occurrences(start, e.rrule, searchFrom, to)) {
      const end = dur ? new Date(o.getTime() + dur) : null
      if ((end || o) < from && o < from) continue
      out.push({ ...e, start: o, end, key: `${e.id}-${o.getTime()}` })
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Är förekomsten på given dag (hanterar heldag över flera dagar)?
export function onDay(occ, day) {
  const d0 = new Date(day); d0.setHours(0, 0, 0, 0)
  const d1 = new Date(d0); d1.setDate(d1.getDate() + 1)
  const end = occ.end && occ.all_day ? new Date(occ.end.getTime() - 1) : occ.end || occ.start
  return occ.start < d1 && end >= d0
}

export const timeOf = (d) => d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
