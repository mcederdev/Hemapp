// Snabbinmatningen (pluset på Idag): dag, tid, person och upprepning läses ut ur texten.
import { describe, it, expect } from 'vitest'
import { parseQuick, guessKind } from '../src/lib/quickadd.js'

const today = '2026-11-12' // torsdag
const members = [{ id: 'j', name: 'Juhani' }, { id: 'm', name: 'Magnus' }]
const q = (text) => parseQuick(text, { today, members })

describe('datum', () => {
  it('"4 dec" och "4 december"', () => {
    expect(q('Möte 4 dec').date).toBe('2026-12-04')
    expect(q('Möte 4 december').date).toBe('2026-12-04')
  })
  it('passerat datum blir nästa år', () => expect(q('Kalas 3 jan').date).toBe('2027-01-03'))
  it('"4/12"', () => expect(q('Pass 4/12').date).toBe('2026-12-04'))
  it('idag, imorgon, i övermorgon', () => {
    expect(q('Fika idag').date).toBe('2026-11-12')
    expect(q('Fika imorgon').date).toBe('2026-11-13')
    expect(q('Fika i övermorgon').date).toBe('2026-11-14')
  })
  it('veckodag: närmaste kommande, idag räknas', () => {
    expect(q('Simning tis').date).toBe('2026-11-17')
    expect(q('Simning torsdag').date).toBe('2026-11-12')
    expect(q('Simning nästa torsdag').date).toBe('2026-11-19')
  })
  it('Fixad bugg: "4e dec", "4:e dec" och "1a dec" känns igen som datum', () => {
    expect(q('Nytt pass den 4e dec kl 14:50').date).toBe('2026-12-04')
    expect(q('Nytt pass 4:e dec').date).toBe('2026-12-04')
    expect(q('Möte 1a dec').date).toBe('2026-12-01')
  })
})

describe('klockslag', () => {
  it('"kl 14", "14:50", "14.50"', () => {
    expect(q('Pass 4 dec kl 14').time).toBe('14:00')
    expect(q('Pass 4 dec 14:50').time).toBe('14:50')
    expect(q('Pass 4 dec 14.50').time).toBe('14:50')
  })
  it('tidsintervall', () => {
    expect(q('Tandläkare tis 15–16')).toMatchObject({ time: '15:00', endTime: '16:00' })
    expect(q('Möte 10-12:30')).toMatchObject({ time: '10:00', endTime: '12:30' })
  })
  it('omöjlig tid ignoreras', () => expect(q('Pass kl 25').time).toBeNull())
  it('Fixad bugg: "kl 14:0" blir 14:00 och inte en del av titeln', () => {
    const r = q('Nytt pass den 4 dec kl 14:0')
    expect(r.time).toBe('14:00')
    expect(r.title).not.toMatch(/14/)
  })
})

describe('titel, person och upprepning', () => {
  it('dag och tid tas bort ur titeln', () => expect(q('Tandläkare Juhani tis 15–16').title).toBe('Tandläkare'))
  it('namn i familjen blir person', () => expect(q('Tandläkare Juhani tis 15–16').member).toBe('j'))
  it('"varannan vecka" blir upprepning', () => expect(q('Städa varannan vecka').repeat).toBe('biweekly'))
  it('stor bokstav först', () => expect(q('fika idag').title).toBe('Fika'))
  it('Fixad bugg: utfyllnadsordet "den" tas bort ur titeln', () => {
    expect(q('Nytt pass den 4 dec kl 14:50').title).toBe('Nytt pass')
  })
})

describe('vad det blir', () => {
  it('händelse när det finns dag eller tid', () => {
    const t = 'Nytt pass den 4 dec kl 14:50'
    expect(guessKind(t, q(t))).toBe('event')
  })
  it('vara vid uppräkning eller "köp"', () => {
    expect(q('mjölk, ägg och bröd').items).toEqual(['Mjölk', 'Ägg', 'Bröd'])
    expect(guessKind('köp mjölk', q('köp mjölk'))).toBe('item')
  })
  it('syssla annars', () => expect(guessKind('Dammsuga', q('Dammsuga'))).toBe('chore'))
})
