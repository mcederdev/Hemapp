// Barnens stjärnor och veckopeng. Räknas från avbockade sysslor:
// en syssla räknas för den som gjorde den (done_by), annars den den var tilldelad.
// Testsysslor (Testläge) och andra hushålls sysslor räknas inte.
import { addDays } from './dates.js'

export const sumStars = (list) => list.reduce((s, c) => s + (c.stars || 0), 0)

export function doneByKid(chores, kidId, householdId) {
  return chores.filter((c) => (c.done_by || c.assigned_to) === kidId && !c.is_test && c.household_id === householdId)
}

// Avbockade sysslor med done_at inom [from, to) (datum som 'YYYY-MM-DD')
export function doneIn(list, from, to) {
  return list.filter((c) => c.done && c.done_at && c.done_at.slice(0, 10) >= from && c.done_at.slice(0, 10) < to)
}

// Stjärnor den här och förra veckan. week = måndagen i veckan.
export function weekStars(chores, kidId, householdId, week) {
  const mine = doneByKid(chores, kidId, householdId)
  return { thisWeek: doneIn(mine, week, addDays(week, 7)), lastWeek: doneIn(mine, addDays(week, -7), week) }
}

// Kronor sparade mot sparmålet: stjärnor sedan målet sattes gånger kronor per stjärna
export function goalSaved(chores, kid, householdId, perStar) {
  if (!(kid.goal_title && kid.goal_amount > 0)) return 0
  const mine = doneByKid(chores, kid.id, householdId)
  return sumStars(mine.filter((c) => c.done && c.done_at && c.done_at.slice(0, 10) >= (kid.goal_since || '0'))) * perStar
}
