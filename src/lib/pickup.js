// Hämta och lämna samt krockar med jobb
import { expandEvents } from './events.js'

const isSchool = (o) => o.category === 'skola' || /^(för)?skola|fritids/i.test(o.title || '')
const hm = (d) => d.toTimeString().slice(0, 5)

// Skolans tider för barnet en dag (första start, sista slut), eller null
export function schoolDay(events, childId, dayStr) {
  const d0 = new Date(dayStr + 'T00:00'), d1 = new Date(d0); d1.setDate(d1.getDate() + 1)
  const occ = expandEvents(events.filter((e) => e.member_id === childId && !e.all_day), d0, d1).filter((o) => o.start >= d0 && isSchool(o))
  if (!occ.length) return null
  const start = occ.reduce((a, o) => (o.start < a ? o.start : a), occ[0].start)
  const end = occ.reduce((a, o) => ((o.end || o.start) > a ? o.end || o.start : a), occ[0].end || occ[0].start)
  return { start, end, startHM: hm(start), endHM: hm(end) }
}

// Jobbar personen vid tidpunkten (Date)?
export function busyAt(events, personId, at) {
  const from = new Date(at.getTime() - 86400000), to = new Date(at.getTime() + 1)
  return expandEvents(events.filter((e) => e.member_id === personId && e.category === 'jobb' && !e.all_day), from, to)
    .some((o) => o.start <= at && (o.end || o.start) > at)
}

// Varningar för en dag: ingen ledig att lämna/hämta, vald person jobbar, bytet krockar med jobb
export function dayWarnings({ events, kids, parents, pickups, dayStr, here, handover, nameOf }) {
  const out = []
  for (const kid of kids) {
    if (here && !here(kid.id)) continue
    const s = schoolDay(events, kid.id, dayStr)
    if (!s) continue
    for (const [kind, at, label] of [['lamna', s.start, 'lämna'], ['hamta', s.end, 'hämta']]) {
      const p = pickups.find((x) => x.child_id === kid.id && x.day === dayStr && x.kind === kind)
      if (p?.person_id) {
        if (busyAt(events, p.person_id, at)) out.push({ kid, kind, text: `${nameOf(p.person_id)} ska ${label} ${kid.name} kl ${hm(at)} men jobbar då` })
      } else if (!p?.person_name && parents.length && parents.every((m) => busyAt(events, m.id, at))) {
        out.push({ kid, kind, text: `Alla jobbar när ${kid.name} ska ${label}s kl ${hm(at)}` })
      }
    }
  }
  for (const h of handover || []) {
    const busy = parents.filter((m) => busyAt(events, m.id, h.at))
    if (busy.length && busy.length === parents.length) out.push({ kid: h.kid, kind: 'byte', text: `Bytet kl ${hm(h.at)} krockar med jobb för ${busy.map((m) => m.name).join(' och ')}` })
  }
  return out
}

// Förval enligt kalendern: är bara en förälder ledig vid tiden blir det den. Är båda (eller ingen) lediga: null, man väljer själv.
export function freeParent(events, parents, at) {
  const free = parents.filter((m) => !busyAt(events, m.id, at))
  return free.length === 1 ? free[0] : null
}
