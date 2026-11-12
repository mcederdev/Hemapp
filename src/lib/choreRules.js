import { addDays, startOfWeek, nextDue, iso as localDay } from './dates.js'

// Syns på Idag: valt datum först den dagen. Återkommande utan datum ligger fritt hela veckan/månaden tills den bockas av.
export function showToday(c, t) {
  return !c.done && (!c.due_date || c.due_date <= t || (!!c.plan_id && !c.fixed_day))
}

// Sista dagen i perioden för en återkommande syssla utan valt datum
export function periodEnd(unit, t) {
  if (unit === 'week') return addDays(startOfWeek(t), 6)
  if (unit === 'month') { const d = new Date(t.slice(0, 7) + '-01T12:00'); d.setMonth(d.getMonth() + 1); d.setDate(0); return localDay(d) }
  return t
}

// Nästa förfallodag när en syssla med egen upprepning bockas av (idag = t).
// Samma veckodag/dag i nästa period, men aldrig idag eller bakåt i tiden.
// Räknas alltid från förfallodagen (inte steg för steg), så att en syssla den 31:a
// inte glider till den 28:e när den bockas av för sent efter februari.
export function nextChoreDue(c, t) {
  const from = c.due_date || t
  const n = Math.max(1, Number(c.repeat_every) || 1)
  for (let k = 1; k < 10000; k++) {
    const next = nextDue(from, k * n, c.repeat_unit)
    if (!next) return null
    if (next > t) return next
  }
  return null
}

// Finns nästa omgång redan (t.ex. efter bocka av, ångra, bocka av igen)?
export function hasNext(rows, c, due) {
  return (rows || []).some((x) => x.id !== c.id && !x.done && x.title === c.title && x.due_date === due &&
    (x.plan_id || null) === (c.plan_id || null) && (x.assigned_to || null) === (c.assigned_to || null))
}
