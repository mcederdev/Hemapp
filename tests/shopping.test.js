// Inköpslistan: inga dubbletter när basvaror snabbläggs, och avdelningar som faller tillbaka på Övrigt.
import { describe, it, expect } from 'vitest'
import { findActive, sectionFor, sectionOf, bySection } from '../src/lib/shopping.js'
import { guessSection, SECTIONS, DEFAULT_STAPLES } from '../src/lib/sections.js'
import { itemKey, addToItem, splitTyped } from '../src/lib/qty.js'

const LIST = 'vecka'
const item = (name, extra = {}) => ({ id: name, name, list_id: LIST, done: false, ...extra })

// Samma regel som add() i Shopping.jsx: lägg bara till om varan inte redan ligger aktiv
function quickAdd(rows, name, qty = '') {
  const existing = findActive(rows, LIST, name)
  if (existing) { if (qty) existing.qty = addToItem(existing.qty, qty); return rows }
  rows.push(item(name.trim(), { section: sectionFor(name.trim()), ...(qty ? { qty } : {}) }))
  return rows
}
const active = (rows) => rows.filter((r) => !r.done && r.list_id === LIST)

describe('snabblägga basvaror utan dubbletter', () => {
  it('samma vara två gånger blir en rad', () => {
    const rows = quickAdd(quickAdd([], 'Mjölk'), 'Mjölk')
    expect(active(rows)).toHaveLength(1)
  })

  it('stora/små bokstäver och mellanslag spelar ingen roll', () => {
    const rows = quickAdd(quickAdd([], 'Mjölk'), '  mJÖLK ')
    expect(active(rows)).toHaveLength(1)
  })

  it('singular och plural räknas som samma vara', () => {
    for (const [a, b] of [['Gurka', 'Gurkor'], ['Banan', 'Bananer'], ['Tomat', 'Tomater'], ['Paprika', 'Paprikor'], ['Lök', 'Lökar']]) {
      expect(active(quickAdd(quickAdd([], a), b)), `${a} / ${b}`).toHaveLength(1)
    }
  })

  it('mängden läggs till på raden som redan finns', () => {
    const rows = quickAdd(quickAdd([], 'Gurka', '1 st'), 'Gurkor', '2 st')
    expect(active(rows)).toHaveLength(1)
    expect(rows[0].qty).toBe('3 st')
  })

  it('en avbockad vara hindrar inte att den läggs till igen', () => {
    const rows = quickAdd([item('Mjölk', { done: true })], 'Mjölk')
    expect(active(rows)).toHaveLength(1)
    expect(rows).toHaveLength(2)
  })

  it('samma vara på en annan lista räknas inte', () => {
    expect(findActive([item('Mjölk', { list_id: 'kalas' })], LIST, 'Mjölk')).toBeUndefined()
  })

  it('alla standard-basvaror två gånger i rad ger en rad var', () => {
    let rows = []
    for (const n of [...DEFAULT_STAPLES, ...DEFAULT_STAPLES]) rows = quickAdd(rows, n)
    expect(active(rows)).toHaveLength(DEFAULT_STAPLES.length)
  })

  it('"2 gurkor" och "mjölk 1 l" delas i namn och mängd', () => {
    expect(splitTyped('2 gurkor')).toMatchObject({ name: 'Gurkor', qty: '2 st' })
    expect(splitTyped('mjölk 1 l').name.toLowerCase()).toBe('mjölk')
  })

  it('korta ord slås inte ihop med andra', () => {
    expect(itemKey('Te')).not.toBe(itemKey('Tea'))
    expect(itemKey('Ost')).not.toBe(itemKey('Os'))
  })

  it('Fixad bugg: "Äpple" och standardvaran "Äpplen" räknas som samma vara', () => {
    expect(active(quickAdd(quickAdd([], 'Äpplen'), 'Äpple'))).toHaveLength(1)
  })

  it('Fixad bugg: "Morot" och "Morötter" räknas som samma vara', () => {
    expect(active(quickAdd(quickAdd([], 'Morötter'), 'Morot'))).toHaveLength(1)
  })
})

describe('avdelning i butiken', () => {
  it('kända varor hamnar rätt', () => {
    expect(guessSection('Mjölk')).toBe('Mejeri')
    expect(guessSection('Bananer')).toBe('Frukt & grönt')
    expect(guessSection('Köttfärs')).toBe('Kött & fisk')
    expect(guessSection('Toapapper')).toBe('Hushåll')
    expect(guessSection('Te')).toBe('Skafferi')
  })

  it('okända varor faller tillbaka på Övrigt', () => {
    for (const n of ['Kattmat', 'Present till Ella', 'xyz', '123', '🎈']) expect(guessSection(n), n).toBe('Övrigt')
  })

  it('tomt namn ger Övrigt och kraschar inte', () => {
    expect(guessSection('')).toBe('Övrigt')
    expect(guessSection('   ')).toBe('Övrigt')
  })

  it('korta ord matchar bara hela ord ("te" finns inte i "kostym")', () => {
    expect(guessSection('Kostym')).toBe('Övrigt')
    expect(guessSection('Ostbågar')).not.toBe('Mejeri')
  })

  it('gissningen är alltid en av butikens avdelningar', () => {
    for (const n of [...DEFAULT_STAPLES, 'Kattmat', '']) expect(SECTIONS).toContain(guessSection(n))
  })

  it('hushållets egen katalog vinner över gissningen', () => {
    expect(sectionFor('Havredryck', { havredryck: { section: 'Dryck' } })).toBe('Dryck')
    expect(sectionFor('Havredryck', {})).toBe('Mejeri')
  })

  it('katalograd utan avdelning faller tillbaka på gissningen', () => {
    expect(sectionFor('Mjölk', { mjölk: { section: null } })).toBe('Mejeri')
  })

  it('rader med okänd, borttagen eller saknad avdelning visas under Övrigt', () => {
    expect(sectionOf({ section: 'Mejeri' })).toBe('Mejeri')
    expect(sectionOf({ section: 'Gammal avdelning' })).toBe('Övrigt')
    expect(sectionOf({ section: null })).toBe('Övrigt')
    expect(sectionOf({})).toBe('Övrigt')
  })

  it('grupperingen följer butikens ordning och tappar inga varor', () => {
    const rows = [item('Kattmat', { section: 'Övrigt' }), item('Mjölk', { section: 'Mejeri' }), item('Äpplen', { section: 'Frukt & grönt' }), item('X', { section: 'Påhittad' })]
    const groups = bySection(rows)
    expect(groups.map(([s]) => s)).toEqual(['Frukt & grönt', 'Mejeri', 'Övrigt'])
    expect(groups.flatMap(([, v]) => v)).toHaveLength(rows.length)
  })

  it('Fixad bugg: chips, juice och fiskpinnar hamnar på rätt avdelning', () => {
    // Första träffen vinner: "potatis" i Frukt & grönt, "apelsin" i Frukt & grönt, "fisk" i Kött & fisk
    expect(guessSection('Potatischips')).toBe('Godis & snacks')
    expect(guessSection('Apelsinjuice')).toBe('Dryck')
    expect(guessSection('Fiskpinnar')).toBe('Frys')
  })

  it('Fixad bugg: tepåsar är inte hushållspåsar', () => {
    expect(guessSection('Tepåsar')).toBe('Skafferi')
  })
})
