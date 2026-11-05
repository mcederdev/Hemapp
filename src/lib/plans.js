// Återkommande sysslor: avgör när en ny syssla ska läggas till.
// Samma fil används av servern (supabase/functions/send-reminders/plans.js).
// Dagliga läggs till varje (n:e) dag, veckovisa på måndagen, månadsvisa den 1:a.

const p = (s) => new Date(s + 'T12:00:00Z')
const fmt = (d) => d.toISOString().slice(0, 10)
const add = (s, n) => { const d = p(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d) }
const monday = (s) => { const d = p(s); return add(s, -((d.getUTCDay() + 6) % 7)) }
const days = (a, b) => Math.round((p(b) - p(a)) / 86400000)
const months = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7))
const lastOfMonth = (s) => { const d = p(s.slice(0, 7) + '-01'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return fmt(d) }

// Returnerar förfallodag för en ny syssla om planen ska läggas till idag, annars null
export function planDue(plan, today) {
  const n = Math.max(1, Number(plan.every) || 1)
  const last = plan.last_added
  if (plan.unit === 'day') return !last || days(last, today) >= n ? today : null
  if (plan.unit === 'week') return !last || days(monday(last), monday(today)) >= 7 * n ? add(monday(today), 6) : null
  if (plan.unit === 'month') return !last || months(last, today) >= n ? lastOfMonth(today) : null
  return null
}

export function planLabel(plan) {
  const n = Math.max(1, Number(plan.every) || 1)
  const w = { day: ['varje dag', 'varannan dag', 'dag'], week: ['varje vecka', 'varannan vecka', 'vecka'], month: ['varje månad', 'varannan månad', 'månad'] }[plan.unit]
  if (!w) return ''
  return n === 1 ? w[0] : n === 2 ? w[1] : `var ${n}:e ${w[2]}`
}

export const PLAN_SUGGESTIONS = [
  { title: 'Dammsuga', unit: 'week' }, { title: 'Torka golven', unit: 'week' }, { title: 'Städa badrummet', unit: 'week' },
  { title: 'Byta lakan', unit: 'week', every: 2 }, { title: 'Tvätta', unit: 'week' }, { title: 'Gå ut med soporna', unit: 'week' },
  { title: 'Panta', unit: 'week', every: 2 }, { title: 'Vattna blommorna', unit: 'week' }, { title: 'Rensa kylen', unit: 'month' },
  { title: 'Rengöra diskmaskinens filter', unit: 'month' }, { title: 'Torka av lister och lampor', unit: 'month' }, { title: 'Byta handdukar', unit: 'week' }
]
