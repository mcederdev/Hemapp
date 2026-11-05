import { expandEvents } from './events.js'
import { addDays } from './dates.js'

export const ILLNESSES = ['Feber', 'Förkylning', 'Magsjuka', 'Vinterkräksjuka', 'Öroninflammation', 'Halsfluss', 'Hosta', 'Vattkoppor', 'Ögoninflammation', 'Annat']

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

// Förälderns arbetstid en viss dag, utifrån förälderns pass i kalendern som börjar den dagen.
// Ett nattpass som började dagen innan räknas till den dagen. Null om inget pass finns.
export function workTime(events, parentId, dayStr) {
  const d0 = new Date(dayStr + 'T00:00'), d1 = new Date(d0); d1.setDate(d1.getDate() + 1)
  let occ = expandEvents(events.filter((e) => e.member_id === parentId && !e.all_day), d0, d1)
    .filter((o) => o.start >= d0 && o.start < d1)
  // Finns pass med kategori jobb används bara de
  if (occ.some((o) => o.category === 'jobb')) occ = occ.filter((o) => o.category === 'jobb')
  if (!occ.length) return null
  const start = new Date(Math.min(...occ.map((o) => o.start)))
  const end = new Date(Math.max(...occ.map((o) => (o.end || o.start).getTime())))
  return { start: hhmm(start), end: hhmm(end), titles: occ.map((o) => o.title) }
}

export function hoursBetween(start, end) {
  if (!start || !end) return null
  const [a, b] = [start, end].map((t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m })
  const mins = b >= a ? b - a : b + 1440 - a
  return Math.round((mins / 60) * 4) / 4 // kvartar
}

// Hur många dagar i rad barnet har varit sjukt fram till och med en viss dag
// (helger räknas med, som hos Försäkringskassan, men en helg utan VAB bryter inte perioden)
export function sickDayNumber(rows, childId, dayStr) {
  const days = new Set(rows.filter((r) => r.child_id === childId).map((r) => r.day))
  if (!days.has(dayStr)) return 0
  let n = 1, cur = dayStr
  for (;;) {
    let prev = addDays(cur, -1), gap = 1
    // hoppa över lördag/söndag utan VAB
    while (!days.has(prev) && gap <= 2 && [0, 6].includes(new Date(prev + 'T00:00').getDay())) { prev = addDays(prev, -1); gap++ }
    if (!days.has(prev)) break
    n += Math.round((new Date(cur + 'T00:00') - new Date(prev + 'T00:00')) / 86400000)
    cur = prev
  }
  return n
}

export const daysSince = (dayStr, today) => Math.round((new Date(today + 'T00:00') - new Date(dayStr + 'T00:00')) / 86400000)

// Vilka föräldrar har ett jobbpass som krockar med barnets skoltid?
export function workConflicts(events, parentIds, from, to) {
  if (!from || !to) return []
  const pad = new Date(from); pad.setDate(pad.getDate() - 1)
  const occ = expandEvents(events.filter((e) => parentIds.includes(e.member_id) && e.category === 'jobb' && !e.all_day), pad, to)
  return occ.filter((o) => o.start < to && (o.end || o.start) > from)
}
