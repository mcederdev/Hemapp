// Återkommande sysslor: nästa datum när en syssla bockas av, och när planerna lägger till nya.
// Testerna körs i svensk tid (Europe/Stockholm, se vitest.config.js).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextChoreDue, showToday, periodEnd } from '../src/lib/choreRules.js'
import { nextDue, repeatLabel } from '../src/lib/dates.js'
import { planDue, planLabel } from '../src/lib/plans.js'

vi.mock('../src/supabase', () => ({ supabase: { rpc: vi.fn() } }))
const { completeChore } = await import('../src/components/Chores.jsx')

const weekday = (s) => new Date(s + 'T12:00').toLocaleDateString('sv-SE', { weekday: 'long' })
const chore = (due_date, repeat_every, repeat_unit) => ({ due_date, repeat_every, repeat_unit })

describe('nästa datum när en syssla bockas av', () => {
  describe('dagligen', () => {
    it('i tid: imorgon', () => expect(nextChoreDue(chore('2026-11-12', 1, 'day'), '2026-11-12')).toBe('2026-11-13'))
    it('för sent: aldrig bakåt i tiden', () => expect(nextChoreDue(chore('2026-11-05', 1, 'day'), '2026-11-12')).toBe('2026-11-13'))
    it('i förväg: dagen efter förfallodagen', () => expect(nextChoreDue(chore('2026-11-14', 1, 'day'), '2026-11-12')).toBe('2026-11-15'))
    it('varannan dag, för sent: håller takten', () => expect(nextChoreDue(chore('2026-11-01', 2, 'day'), '2026-11-12')).toBe('2026-11-13'))
    it('var 3:e dag, på förfallodagen', () => expect(nextChoreDue(chore('2026-11-12', 3, 'day'), '2026-11-12')).toBe('2026-11-15'))
    it('över årsskiftet', () => expect(nextChoreDue(chore('2026-12-31', 1, 'day'), '2026-12-31')).toBe('2027-01-01'))
    it('genom skottdagen', () => expect(nextChoreDue(chore('2028-02-28', 1, 'day'), '2028-02-28')).toBe('2028-02-29'))
  })

  describe('veckovis', () => {
    it('i tid: samma veckodag nästa vecka', () => {
      const next = nextChoreDue(chore('2026-11-09', 1, 'week'), '2026-11-09')
      expect(next).toBe('2026-11-16')
      expect(weekday(next)).toBe('måndag')
    })
    it('för sent (torsdag): nästa måndag, inte förra', () => expect(nextChoreDue(chore('2026-11-09', 1, 'week'), '2026-11-12')).toBe('2026-11-16'))
    it('tre veckor för sent: hoppar fram till nästa kommande', () => expect(nextChoreDue(chore('2026-10-19', 1, 'week'), '2026-11-12')).toBe('2026-11-16'))
    it('i förväg: veckan efter förfallodagen', () => expect(nextChoreDue(chore('2026-11-16', 1, 'week'), '2026-11-12')).toBe('2026-11-23'))
    it('lördagssyssla bockad på söndagen: nästa lördag', () => {
      const next = nextChoreDue(chore('2026-11-14', 1, 'week'), '2026-11-15')
      expect(next).toBe('2026-11-21')
      expect(weekday(next)).toBe('lördag')
    })
    it('söndagssyssla bockad på lördagen innan: söndagen veckan efter', () => expect(nextChoreDue(chore('2026-11-15', 1, 'week'), '2026-11-14')).toBe('2026-11-22'))
    it('över årsskiftet', () => expect(nextChoreDue(chore('2026-12-28', 1, 'week'), '2026-12-28')).toBe('2027-01-04'))
    it('över sommartidens slut', () => expect(nextChoreDue(chore('2026-10-21', 1, 'week'), '2026-10-21')).toBe('2026-10-28'))
  })

  describe('varannan vecka', () => {
    it('i tid', () => expect(nextChoreDue(chore('2026-11-09', 2, 'week'), '2026-11-09')).toBe('2026-11-23'))
    it('en vecka för sent: håller sig i sin rytm', () => expect(nextChoreDue(chore('2026-11-02', 2, 'week'), '2026-11-12')).toBe('2026-11-16'))
    it('tre veckor för sent: hoppar över en hel omgång', () => expect(nextChoreDue(chore('2026-10-19', 2, 'week'), '2026-11-12')).toBe('2026-11-16'))
    it('på helgen', () => expect(nextChoreDue(chore('2026-11-15', 2, 'week'), '2026-11-15')).toBe('2026-11-29'))
    it('över årsskiftet', () => expect(nextChoreDue(chore('2026-12-27', 2, 'week'), '2026-12-27')).toBe('2027-01-10'))
  })

  describe('månadsvis', () => {
    it('den 15:e', () => expect(nextChoreDue(chore('2026-11-15', 1, 'month'), '2026-11-15')).toBe('2026-12-15'))
    it('den 31 jan: sista februari', () => expect(nextChoreDue(chore('2026-01-31', 1, 'month'), '2026-01-31')).toBe('2026-02-28'))
    it('den 31 jan på skottår: 29 feb', () => expect(nextChoreDue(chore('2028-01-31', 1, 'month'), '2028-01-31')).toBe('2028-02-29'))
    it('Fixad bugg: sysslan den 31:a glider inte till den 28:e efter februari', () => {
      // Bockad för sent den 1 mars: 31 jan → 28 feb (passerat) → 28 mar. Borde bli 31 mar.
      expect(nextChoreDue(chore('2026-01-31', 1, 'month'), '2026-03-01')).toBe('2026-03-31')
    })
  })

  it('utan datum räknas nästa gång från idag', () => expect(nextChoreDue(chore(null, 1, 'week'), '2026-11-12')).toBe('2026-11-19'))
  it('ogiltigt intervall (0, tomt, negativt) räknas som 1', () => {
    expect(nextChoreDue(chore('2026-11-12', 0, 'day'), '2026-11-12')).toBe('2026-11-13')
    expect(nextChoreDue(chore('2026-11-12', '', 'day'), '2026-11-12')).toBe('2026-11-13')
    expect(nextChoreDue(chore('2026-11-12', -3, 'day'), '2026-11-12')).toBe('2026-11-13')
  })
  it('ingen upprepning ger inget nästa datum', () => {
    expect(nextChoreDue(chore('2026-11-12', 1, null), '2026-11-12')).toBeNull()
    expect(nextDue('2026-11-12', 1, 'year')).toBeNull()
  })
  it('etiketter', () => {
    expect(repeatLabel(1, 'day')).toBe('varje dag')
    expect(repeatLabel(2, 'week')).toBe('varannan vecka')
    expect(repeatLabel(3, 'month')).toBe('var 3:e månad')
  })
})

describe('bocka av och ångra (completeChore)', () => {
  const table = (rows) => ({
    rows,
    update: vi.fn((id, v) => Object.assign(rows.find((r) => r.id === id), v)),
    insert: vi.fn((v) => { rows.push({ id: 'n' + rows.length, done: false, ...v }) })
  })
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-12T10:00:00+01:00')) })
  afterEach(() => vi.useRealTimers())

  it('veckosyssla bockad för sent: nästa omgång läggs till på rätt dag', () => {
    const t = table([{ id: 'c1', title: 'Dammsuga', due_date: '2026-11-09', repeat_every: 1, repeat_unit: 'week', stars: 2, assigned_to: 'kid', done: false }])
    completeChore(t, t.rows[0], 'mamma')
    expect(t.rows[0]).toMatchObject({ done: true, done_by: 'kid' })
    expect(t.insert).toHaveBeenCalledTimes(1)
    expect(t.insert.mock.calls[0][0]).toMatchObject({ title: 'Dammsuga', due_date: '2026-11-16', stars: 2, assigned_to: 'kid' })
  })

  it('otilldelad syssla räknas som gjord av den som bockade', () => {
    const t = table([{ id: 'c1', title: 'Diska', done: false }])
    completeChore(t, t.rows[0], 'pappa')
    expect(t.rows[0].done_by).toBe('pappa')
    expect(t.insert).not.toHaveBeenCalled()
  })

  it('plansyssla utan valt datum: planen lägger till nästa, inte avbockningen', () => {
    const t = table([{ id: 'c1', title: 'Byta lakan', plan_id: 'p1', fixed_day: false, repeat_every: 2, repeat_unit: 'week', done: false }])
    completeChore(t, t.rows[0], 'mamma')
    expect(t.insert).not.toHaveBeenCalled()
  })

  it('Fixad bugg: bocka av, ångra och bocka av igen skapar inte två nästa-omgångar', () => {
    const t = table([{ id: 'c1', title: 'Dammsuga', due_date: '2026-11-12', repeat_every: 1, repeat_unit: 'week', done: false }])
    completeChore(t, t.rows[0], 'mamma')
    t.update('c1', { done: false, done_at: null, done_by: null }) // Ångra, som i Chores.jsx
    completeChore(t, t.rows[0], 'mamma')
    expect(t.rows.filter((r) => r.title === 'Dammsuga' && !r.done)).toHaveLength(1)
  })
})

describe('planer som lägger till sysslor automatiskt', () => {
  it('ny daglig plan läggs till idag', () => expect(planDue({ unit: 'day' }, '2026-11-12')).toBe('2026-11-12'))
  it('daglig: inte två gånger samma dag', () => expect(planDue({ unit: 'day', last_added: '2026-11-12' }, '2026-11-12')).toBeNull())
  it('varannan dag', () => {
    expect(planDue({ unit: 'day', every: 2, last_added: '2026-11-11' }, '2026-11-12')).toBeNull()
    expect(planDue({ unit: 'day', every: 2, last_added: '2026-11-10' }, '2026-11-12')).toBe('2026-11-12')
  })
  it('veckovis: på måndagen, ska vara klar på söndagen', () => {
    expect(planDue({ unit: 'week', last_added: '2026-11-09' }, '2026-11-15')).toBeNull()
    expect(planDue({ unit: 'week', last_added: '2026-11-09' }, '2026-11-16')).toBe('2026-11-22')
  })
  it('veckovis: tillagd mitt i veckan räknas som den veckan', () => {
    expect(planDue({ unit: 'week', last_added: '2026-11-12' }, '2026-11-16')).toBe('2026-11-22')
  })
  it('veckovis: appen öppnad först på onsdagen får ändå söndagen som sista dag', () => {
    expect(planDue({ unit: 'week', last_added: '2026-11-09' }, '2026-11-18')).toBe('2026-11-22')
  })
  it('varannan vecka', () => {
    expect(planDue({ unit: 'week', every: 2, last_added: '2026-11-02' }, '2026-11-09')).toBeNull()
    expect(planDue({ unit: 'week', every: 2, last_added: '2026-11-02' }, '2026-11-16')).toBe('2026-11-22')
  })
  it('varannan vecka över årsskiftet', () => {
    expect(planDue({ unit: 'week', every: 2, last_added: '2026-12-21' }, '2027-01-04')).toBe('2027-01-10')
  })
  it('månadsvis: den 1:a, klar sista dagen i månaden', () => {
    expect(planDue({ unit: 'month', last_added: '2026-11-01' }, '2026-11-30')).toBeNull()
    expect(planDue({ unit: 'month', last_added: '2026-11-01' }, '2026-12-01')).toBe('2026-12-31')
  })
  it('månadsvis över årsskiftet och i februari på skottår', () => {
    expect(planDue({ unit: 'month', last_added: '2027-12-01' }, '2028-01-01')).toBe('2028-01-31')
    expect(planDue({ unit: 'month', last_added: '2028-01-15' }, '2028-02-01')).toBe('2028-02-29')
  })
  it('okänd enhet gör ingenting', () => expect(planDue({ unit: 'year' }, '2026-11-12')).toBeNull())
  it('etiketter', () => {
    expect(planLabel({ unit: 'week', every: 2 })).toBe('varannan vecka')
    expect(planLabel({ unit: 'day', every: 4 })).toBe('var 4:e dag')
  })
})

describe('vad som syns på Idag', () => {
  it('syssla med datum syns först den dagen', () => {
    expect(showToday({ due_date: '2026-11-13' }, '2026-11-12')).toBe(false)
    expect(showToday({ due_date: '2026-11-12' }, '2026-11-12')).toBe(true)
    expect(showToday({ due_date: '2026-11-10' }, '2026-11-12')).toBe(true)
  })
  it('återkommande utan valt datum syns hela perioden', () => {
    expect(showToday({ due_date: '2026-11-15', plan_id: 'p', fixed_day: false }, '2026-11-12')).toBe(true)
  })
  it('avbockad syns inte', () => expect(showToday({ done: true }, '2026-11-12')).toBe(false))
  it('periodens sista dag', () => {
    expect(periodEnd('week', '2026-11-12')).toBe('2026-11-15')
    expect(periodEnd('month', '2028-02-10')).toBe('2028-02-29')
    expect(periodEnd('day', '2026-11-12')).toBe('2026-11-12')
  })
})
