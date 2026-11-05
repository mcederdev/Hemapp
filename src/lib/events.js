import { occurrences } from './rrule.js'

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

// Tidstext för en förekomst sedd från en viss dag.
// Händelser som började en tidigare dag visar bara när de slutar.
export function timeLabel(occ, day) {
  if (occ.all_day) return { time: 'Heldag', note: '' }
  const d0 = new Date(day); d0.setHours(0, 0, 0, 0)
  const d1 = new Date(d0); d1.setDate(d1.getDate() + 1)
  const startedBefore = occ.start < d0
  const endsAfter = occ.end && occ.end >= d1
  if (startedBefore && endsAfter) return { time: 'Hela dagen', note: 'pågår' }
  if (startedBefore) return { time: `→ ${timeOf(occ.end)}`, note: 'Dag2' }
  if (endsAfter) return { time: `${timeOf(occ.start)} →`, note: `slutar ${occ.end.toLocaleDateString('sv-SE', { weekday: 'short' })} ${timeOf(occ.end)}` }
  return { time: occ.end ? `${timeOf(occ.start)}–${timeOf(occ.end)}` : timeOf(occ.start), note: '' }
}

// Förekomster för en dag. En heldagspost som heter "Dag2" döljs om samma dag
// redan har en händelse som fortsätter från dagen innan (den visas då som Dag2).
export function dayList(occs, day) {
  const d0 = new Date(day); d0.setHours(0, 0, 0, 0)
  const list = occs.filter((o) => onDay(o, d0))
  const hasContinuation = list.some((o) => !o.all_day && o.start < d0)
  return list.filter((o) => !(hasContinuation && o.all_day && o.title.trim().toLowerCase() === 'dag2'))
}

// "13:00–20:00 Jobb" för korta sammanfattningar
export function shortLine(o) {
  if (o.all_day) return o.title
  return `${timeOf(o.start)}${o.end ? '–' + timeOf(o.end) : ''} ${o.title}`
}
