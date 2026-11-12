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
export function nextChoreDue(c, t) {
  let next = nextDue(c.due_date || t, c.repeat_every, c.repeat_unit)
  while (next && next <= t) next = nextDue(next, c.repeat_every, c.repeat_unit)
  return next
}
