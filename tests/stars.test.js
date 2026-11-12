// Barnens stjärnor och veckopeng (Kids.jsx använder src/lib/stars.js).
// Testerna körs i svensk tid (Europe/Stockholm, se vitest.config.js).
import { describe, it, expect } from 'vitest'
import { sumStars, weekStars, goalSaved, doneByKid } from '../src/lib/stars.js'

const H = 'hem1'
const WEEK = '2026-11-09' // måndag
let n = 0
const c = (stars, done_at, extra = {}) => ({ id: 'c' + n++, household_id: H, assigned_to: 'kid', stars, done: !!done_at, done_at, ...extra })
const at = (local) => new Date(local).toISOString() // som done_at sparas: new Date().toISOString()

describe('stjärnor och veckopeng', () => {
  it('summerar veckans stjärnor', () => {
    const rows = [c(2, at('2026-11-09T08:00')), c(3, at('2026-11-12T18:00')), c(1, at('2026-11-15T20:00'))]
    const { thisWeek } = weekStars(rows, 'kid', H, WEEK)
    expect(sumStars(thisWeek)).toBe(6)
  })

  it('förra veckan räknas för sig', () => {
    const rows = [c(5, at('2026-11-05T12:00')), c(2, at('2026-11-10T12:00'))]
    const w = weekStars(rows, 'kid', H, WEEK)
    expect(sumStars(w.thisWeek)).toBe(2)
    expect(sumStars(w.lastWeek)).toBe(5)
  })

  it('ej avbockade sysslor ger inga stjärnor', () => {
    const { thisWeek } = weekStars([c(3, null)], 'kid', H, WEEK)
    expect(sumStars(thisWeek)).toBe(0)
  })

  it('sysslor utan stjärnor (0, null, saknas) ger 0 och inte NaN', () => {
    expect(sumStars([{ stars: 0 }, { stars: null }, {}])).toBe(0)
  })

  it('ångra tar bort stjärnorna igen, och det blir aldrig minus', () => {
    const rows = [c(3, at('2026-11-10T12:00')), c(2, at('2026-11-11T12:00'))]
    const before = sumStars(weekStars(rows, 'kid', H, WEEK).thisWeek)
    Object.assign(rows[0], { done: false, done_at: null, done_by: null }) // Ångra
    const after = sumStars(weekStars(rows, 'kid', H, WEEK).thisWeek)
    expect(before).toBe(5)
    expect(after).toBe(2)
    Object.assign(rows[1], { done: false, done_at: null, done_by: null })
    Object.assign(rows[1], { done: false, done_at: null, done_by: null }) // ångra två gånger
    expect(sumStars(weekStars(rows, 'kid', H, WEEK).thisWeek)).toBe(0)
  })

  it('bocka av och ångra många gånger ger samma summa som en gång', () => {
    const row = c(3, null)
    for (let i = 0; i < 10; i++) {
      Object.assign(row, { done: true, done_at: at('2026-11-10T12:00') })
      Object.assign(row, { done: false, done_at: null })
    }
    Object.assign(row, { done: true, done_at: at('2026-11-10T12:00') })
    expect(sumStars(weekStars([row], 'kid', H, WEEK).thisWeek)).toBe(3)
  })

  it('räknas för den som gjorde sysslan, inte den den var tilldelad', () => {
    const rows = [c(4, at('2026-11-10T12:00'), { assigned_to: 'syster', done_by: 'kid' }), c(2, at('2026-11-10T12:00'), { done_by: 'syster' })]
    expect(sumStars(weekStars(rows, 'kid', H, WEEK).thisWeek)).toBe(4)
  })

  it('Testläge och det andra hushållets sysslor räknas inte', () => {
    const rows = [c(5, at('2026-11-10T12:00'), { is_test: true }), c(5, at('2026-11-10T12:00'), { household_id: 'hem2' }), c(1, at('2026-11-10T12:00'))]
    expect(doneByKid(rows, 'kid', H)).toHaveLength(1)
  })

  it('söndag kväll räknas till veckan som slutar', () => {
    const { thisWeek } = weekStars([c(2, at('2026-11-15T22:30'))], 'kid', H, WEEK)
    expect(sumStars(thisWeek)).toBe(2)
  })

  it('BUGG: måndag strax efter midnatt räknas till den nya veckan', () => {
    // done_at sparas i UTC: 00:30 svensk tid = 23:30 UTC söndag, så stjärnorna hamnar på förra veckan
    const { thisWeek } = weekStars([c(2, at('2026-11-16T00:30'))], 'kid', H, '2026-11-16')
    expect(sumStars(thisWeek)).toBe(2)
  })

  it('BUGG: i sommartid gäller samma sak fram till 02:00', () => {
    const { thisWeek } = weekStars([c(1, at('2026-06-15T01:30'))], 'kid', H, '2026-06-15')
    expect(sumStars(thisWeek)).toBe(1)
  })
})

describe('sparmål', () => {
  const kid = { id: 'kid', goal_title: 'Lego', goal_amount: 300, goal_since: '2026-11-01' }

  it('stjärnor sedan målet sattes gånger kronor per stjärna', () => {
    const rows = [c(3, at('2026-10-30T12:00')), c(4, at('2026-11-02T12:00')), c(2, at('2026-11-10T12:00'))]
    expect(goalSaved(rows, kid, H, 5)).toBe(30)
  })

  it('inget mål ger 0', () => {
    expect(goalSaved([c(3, at('2026-11-10T12:00'))], { id: 'kid' }, H, 5)).toBe(0)
    expect(goalSaved([c(3, at('2026-11-10T12:00'))], { ...kid, goal_amount: 0 }, H, 5)).toBe(0)
  })

  it('0 kr per stjärna ger 0 kr', () => {
    expect(goalSaved([c(3, at('2026-11-10T12:00'))], kid, H, 0)).toBe(0)
  })
})
