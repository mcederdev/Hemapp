// Ekonomi: räkningar fördelas efter inkomst, och den som betalat för lite swishar mellanskillnaden.
// Appen visar alla belopp avrundade till hela kronor (kr() i Finance.jsx), och Swish skickar hela kronor.
import { describe, it, expect } from 'vitest'
import { splitBills } from '../src/lib/finance.js'
import { swishUrl } from '../src/lib/swish.js'

const A = (income) => ({ id: 'a', name: 'Anna', income })
const B = (income) => ({ id: 'b', name: 'Bo', income })
const kr = Math.round // samma avrundning som i Finance.jsx
const sum = (xs) => xs.reduce((s, x) => s + x, 0)

describe('fördelning efter inkomst', () => {
  it('den som tjänar mer betalar mer', () => {
    const r = splitBills([A(30000), B(45000)], [{ amount: 15000, paidBy: 'a' }])
    expect(r.rows.map((x) => x.share)).toEqual([0.4, 0.6])
    expect(r.rows.map((x) => kr(x.shouldPay))).toEqual([6000, 9000])
    expect(r.transfers).toEqual([{ from: 'Bo', to: 'Anna', amount: 9000 }])
  })

  it('identiska inkomster ger exakt 50/50', () => {
    const r = splitBills([A(32000), B(32000)], [{ amount: 1000, paidBy: 'b' }])
    expect(r.rows.map((x) => x.shouldPay)).toEqual([500, 500])
    expect(r.transfers).toEqual([{ from: 'Anna', to: 'Bo', amount: 500 }])
  })

  it('en part med 0 kr i inkomst betalar ingenting', () => {
    const r = splitBills([A(0), B(40000)], [{ amount: 8000, paidBy: 'a' }])
    expect(r.rows[0].shouldPay).toBe(0)
    expect(r.rows[1].shouldPay).toBe(8000)
    expect(r.transfers).toEqual([{ from: 'Bo', to: 'Anna', amount: 8000 }])
  })

  it('ingen inkomst ifylld alls ger jämn fördelning', () => {
    const r = splitBills([A(0), B(0)], [{ amount: 1000, paidBy: 'b' }])
    expect(r.rows.map((x) => x.share)).toEqual([0.5, 0.5])
    expect(r.transfers).toEqual([{ from: 'Anna', to: 'Bo', amount: 500 }])
  })

  it('tomma eller felaktiga inkomster räknas som 0', () => {
    const r = splitBills([A(''), B(null)], [{ amount: 200, paidBy: 'a' }])
    expect(r.totalIncome).toBe(0)
    expect(r.transfers).toEqual([{ from: 'Bo', to: 'Anna', amount: 100 }])
  })

  it('belopp sparade som text räknas', () => {
    const r = splitBills([A('30000'), B('30000')], [{ amount: '333', paidBy: 'a' }])
    expect(r.totalBills).toBe(333)
  })

  it('ingen swish när var och en redan betalat sin del', () => {
    const r = splitBills([A(30000), B(45000)], [{ amount: 4000, paidBy: 'a' }, { amount: 6000, paidBy: 'b' }])
    expect(r.transfers).toEqual([])
  })

  it('inga räkningar alls ger inga swishar', () => {
    const r = splitBills([A(30000), B(45000)], [])
    expect(r.totalBills).toBe(0)
    expect(r.transfers).toEqual([])
  })

  it('kraschar inte utan personer', () => {
    expect(() => splitBills([], [{ amount: 100, paidBy: 'a' }])).not.toThrow()
  })

  it('Fixad bugg: negativ inkomst ger aldrig en andel under 0 % eller över 100 %', () => {
    const r = splitBills([A(-10000), B(30000)], [{ amount: 1000, paidBy: 'b' }])
    for (const row of r.rows) {
      expect(row.share).toBeGreaterThanOrEqual(0)
      expect(row.share).toBeLessThanOrEqual(1)
    }
  })
})

describe('öresbelopp och avrundning', () => {
  const cases = [
    ['333 kr delat 50/50', [A(30000), B(30000)], 333],
    ['333 kr delat 70/30', [A(70000), B(30000)], 333],
    ['100 kr delat i tredjedelar', [A(10000), B(20000)], 100],
    ['999,99 kr delat 55/45', [A(55000), B(45000)], 999.99],
    ['1 kr delat 50/50', [A(1), B(1)], 1]
  ]

  for (const [name, people, total] of cases) {
    it(`${name}: andelarna summerar exakt till totalen (före avrundning)`, () => {
      const r = splitBills(people, [{ amount: total, paidBy: 'a' }])
      expect(sum(r.rows.map((x) => x.shouldPay))).toBeCloseTo(total, 9)
      expect(sum(r.rows.map((x) => x.share))).toBeCloseTo(1, 12)
    })

    it(`${name}: swishen + det man själv betalat blir ens del (±0,50 kr)`, () => {
      const r = splitBills(people, [{ amount: total, paidBy: 'a' }])
      const bo = r.rows[1]
      const paidByBo = sum(r.transfers.filter((t) => t.from === 'Bo').map((t) => t.amount))
      expect(Math.abs(bo.paid + paidByBo - bo.shouldPay)).toBeLessThanOrEqual(0.5)
    })
  }

  it('333 kr delat 70/30: swishen blir 100 kr till rätt person', () => {
    const r = splitBills([A(70000), B(30000)], [{ amount: 333, paidBy: 'a' }])
    expect(r.transfers).toEqual([{ from: 'Bo', to: 'Anna', amount: 100 }])
  })

  it('333 kr delat 50/50: den extra kronan hamnar på den som redan betalat, så Bo swishar 166 kr', () => {
    const r = splitBills([A(30000), B(30000)], [{ amount: 333, paidBy: 'a' }])
    expect(r.rows.map((x) => x.shouldPayKr)).toEqual([167, 166])
    expect(r.transfers).toEqual([{ from: 'Bo', to: 'Anna', amount: 166 }])
  })

  it('swishen stämmer exakt med det som visas: visad del − betalt = swish', () => {
    for (const [people, total] of [[[A(30000), B(30000)], 333], [[A(70000), B(30000)], 333], [[A(10000), B(20000)], 100]]) {
      const r = splitBills(people, [{ amount: total, paidBy: 'a' }])
      expect(r.transfers[0].amount).toBe(r.rows[1].shouldPayKr)
    }
  })

  it('under 50 öre i skillnad blir ingen swish', () => {
    const r = splitBills([A(1), B(1)], [{ amount: 1, paidBy: 'a' }])
    expect(r.transfers).toEqual([])
  })

  it('Fixad bugg: de avrundade andelarna som visas summerar till totalen (333 kr delat 50/50)', () => {
    // Visades som "Ska stå för 167 kr" för båda = 334 kr fast räkningarna är 333 kr.
    // Finance.jsx visar nu shouldPayKr (hela kronor som alltid summerar till totalen).
    for (const [people, total] of [[[A(30000), B(30000)], 333], [[A(70000), B(30000)], 333], [[A(10000), B(20000)], 100], [[A(1), B(1), { id: 'c', name: 'C', income: 1 }], 100]]) {
      const r = splitBills(people, [{ amount: total, paidBy: 'a' }])
      expect(sum(r.rows.map((x) => x.shouldPayKr))).toBe(total)
    }
  })
})

describe('Swish-länk', () => {
  const data = (url) => JSON.parse(decodeURIComponent(url.split('data=')[1]))

  it('fyller i mottagare, belopp och meddelande', () => {
    const d = data(swishUrl('070-123 45 67', 167, 'Räkningar november 2026'))
    expect(d.payee.value).toBe('0701234567')
    expect(d.amount.value).toBe(167)
    expect(d.message.value).toBe('Räkningar november 2026')
  })

  it('+46 blir 0', () => {
    expect(data(swishUrl('+46 70 123 45 67', 1, '')).payee.value).toBe('0701234567')
  })

  it('beloppet avrundas till hela kronor', () => {
    expect(data(swishUrl('0701234567', 166.5, '')).amount.value).toBe(167)
    expect(data(swishUrl('0701234567', 99.9, '')).amount.value).toBe(100)
  })

  it('meddelandet kortas till 50 tecken', () => {
    expect(data(swishUrl('0701234567', 1, 'x'.repeat(80))).message.value).toHaveLength(50)
  })

  it('swish-beloppet är samma som det som visas', () => {
    const r = splitBills([A(70000), B(30000)], [{ amount: 333, paidBy: 'a' }])
    const t = r.transfers[0]
    expect(data(swishUrl('0701234567', t.amount, '')).amount.value).toBe(t.amount)
  })
})
