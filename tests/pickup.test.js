// Lämna och hämta: VAB gör att hämtningen (och oftast lämningen) inte behövs.
// Testerna körs i svensk tid (Europe/Stockholm, se vitest.config.js).
import { describe, it, expect } from 'vitest'
import { vabCover, dayWarnings } from '../src/lib/pickup.js'

const DAY = '2026-11-20' // fredag
const school = { startHM: '08:15', endHM: '14:00' }
const vab = (extra) => ({ kind: 'vab', child_id: 'juhani', day: DAY, parent_id: 'magnus', full_day: true, ...extra })

describe('vabCover', () => {
  it('ingen VAB: inget döljs', () => expect(vabCover([], 'juhani', DAY, school)).toBeNull())
  it('heldag: varken lämna eller hämta', () => {
    const c = vabCover([vab()], 'juhani', DAY, school)
    expect([...c.skip].sort()).toEqual(['hamta', 'lamna'])
    expect(c.parentIds).toEqual(['magnus'])
  })
  it('VAB från 07:00 (före skolstart): varken lämna eller hämta', () => {
    expect(vabCover([vab({ full_day: false, start_time: '07:00:00' })], 'juhani', DAY, school).skip.has('lamna')).toBe(true)
  })
  it('VAB från 11:00 (hämtades tidigt): lämna finns kvar, hämta döljs', () => {
    const c = vabCover([vab({ full_day: false, start_time: '11:00:00' })], 'juhani', DAY, school)
    expect(c.skip.has('lamna')).toBe(false)
    expect(c.skip.has('hamta')).toBe(true)
    expect(c.from).toBe('11:00')
  })
  it('delad dag (förmiddag + eftermiddag): båda föräldrarna, inget lämna', () => {
    const c = vabCover([vab({ full_day: false, start_time: '07:00' }), vab({ full_day: false, start_time: '12:00', parent_id: 'kim' })], 'juhani', DAY, school)
    expect(c.parentIds).toEqual(['magnus', 'kim'])
    expect(c.skip.has('lamna')).toBe(true)
  })
  it('egen sjukdag räknas inte', () => expect(vabCover([vab({ kind: 'sick', child_id: null })], 'juhani', DAY, school)).toBeNull())
  it('annat barn eller annan dag räknas inte', () => {
    expect(vabCover([vab({ child_id: 'annan' })], 'juhani', DAY, school)).toBeNull()
    expect(vabCover([vab({ day: '2026-11-19' })], 'juhani', DAY, school)).toBeNull()
  })
})

describe('varningar när någon vabbar', () => {
  const kid = { id: 'juhani', name: 'Juhani' }
  const parents = [{ id: 'magnus', name: 'Magnus' }]
  const events = [
    { id: 's', member_id: 'juhani', title: 'Skola', category: 'skola', starts_at: `${DAY}T08:15:00`, ends_at: `${DAY}T14:00:00` },
    { id: 'j', member_id: 'magnus', title: 'Jobb', category: 'jobb', starts_at: `${DAY}T07:00:00`, ends_at: `${DAY}T16:00:00` },
  ]
  const base = { events, kids: [kid], parents, pickups: [], dayStr: DAY, nameOf: () => 'Magnus' }
  it('utan VAB: varnar att alla jobbar', () => expect(dayWarnings(base).length).toBe(2))
  it('med VAB: inga varningar om lämna/hämta', () => expect(dayWarnings({ ...base, vab: [vab()] })).toEqual([]))
})
