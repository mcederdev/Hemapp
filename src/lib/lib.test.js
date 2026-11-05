import test from 'node:test'
import assert from 'node:assert/strict'
import { splitBills } from './finance.js'
import { parseIcs } from './ics.js'

test('den som tjänar mer betalar mer och swishar den som betalat allt', () => {
  const people = [{ id: 'a', name: 'Anna', income: 30000 }, { id: 'b', name: 'Bo', income: 45000 }]
  const bills = [{ amount: 10000, paidBy: 'a' }, { amount: 5000, paidBy: 'a' }]
  const r = splitBills(people, bills)
  assert.equal(r.totalBills, 15000)
  assert.equal(Math.round(r.rows[0].shouldPay), 6000)
  assert.equal(Math.round(r.rows[1].shouldPay), 9000)
  assert.deepEqual(r.transfers, [{ from: 'Bo', to: 'Anna', amount: 9000 }])
})

test('jämnt fördelat om ingen inkomst är ifylld', () => {
  const people = [{ id: 'a', name: 'A', income: 0 }, { id: 'b', name: 'B', income: 0 }]
  const r = splitBills(people, [{ amount: 1000, paidBy: 'b' }])
  assert.deepEqual(r.transfers, [{ from: 'A', to: 'B', amount: 500 }])
})

test('läser händelser från ics', () => {
  const ics = [
    'BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:1@x', 'SUMMARY:Fotboll\\, träning',
    'DTSTART:20261110T160000Z', 'DTEND:20261110T170000Z', 'LOCATION:Plan 2', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:2@x', 'SUMMARY:Studiedag', 'DTSTART;VALUE=DATE:20261120',
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n')
  const ev = parseIcs(ics)
  assert.equal(ev.length, 2)
  assert.equal(ev[0].title, 'Fotboll, träning')
  assert.equal(ev[0].start.toISOString(), '2026-11-10T16:00:00.000Z')
  assert.equal(ev[1].allDay, true)
  assert.equal(ev[1].start.getDate(), 20)
})

import { occurrences } from './rrule.js'
import { nextDue, repeatLabel, startOfWeek } from './dates.js'
import { guessSection } from './sections.js'
import { swishUrl } from './swish.js'

test('återkommande händelse varje tisdag och torsdag', () => {
  const start = new Date(2026, 10, 3, 17, 0) // tis 3 nov
  const occ = occurrences(start, 'FREQ=WEEKLY;BYDAY=TU,TH', new Date(2026, 10, 1), new Date(2026, 10, 15))
  assert.deepEqual(occ.map((d) => d.getDate()), [3, 5, 10, 12])
  assert.equal(occ[0].getHours(), 17)
})

test('återkommande med COUNT och INTERVAL', () => {
  const start = new Date(2026, 0, 1, 9)
  const occ = occurrences(start, 'FREQ=WEEKLY;INTERVAL=2;COUNT=3', new Date(2025, 0, 1), new Date(2027, 0, 1))
  assert.deepEqual(occ.map((d) => d.getDate()), [1, 15, 29])
})

test('återkommande med UNTIL', () => {
  const occ = occurrences(new Date(2026, 10, 1, 8), 'FREQ=DAILY;UNTIL=20261103T235959Z', new Date(2026, 9, 1), new Date(2026, 11, 1))
  assert.equal(occ.length, 3)
})

test('icke återkommande händelse', () => {
  assert.equal(occurrences(new Date(2026, 10, 5), null, new Date(2026, 10, 1), new Date(2026, 10, 30)).length, 1)
  assert.equal(occurrences(new Date(2026, 10, 5), null, new Date(2026, 11, 1), new Date(2026, 11, 30)).length, 0)
})

test('nästa datum för återkommande syssla', () => {
  assert.equal(nextDue('2026-11-07', 1, 'week'), '2026-11-14')
  assert.equal(nextDue('2026-11-07', 2, 'day'), '2026-11-09')
  assert.equal(nextDue('2026-01-31', 1, 'month'), '2026-02-28')
  assert.equal(repeatLabel(2, 'week'), 'varannan vecka')
  assert.equal(startOfWeek('2026-11-05'), '2026-11-02')
})

test('gissar avdelning', () => {
  assert.equal(guessSection('Mellanmjölk'), 'Mejeri')
  assert.equal(guessSection('Bananer'), 'Frukt & grönt')
  assert.equal(guessSection('Nötfärs'), 'Kött & fisk')
  assert.equal(guessSection('Något konstigt'), 'Övrigt')
  assert.equal(guessSection('Våtservetter'), 'Hushåll')
  assert.equal(guessSection('Ris'), 'Skafferi')
})

test('swish-länk', () => {
  const url = swishUrl('+46 70-123 45 67', 1234.4, 'Räkningar november')
  const data = JSON.parse(decodeURIComponent(url.split('data=')[1]))
  assert.equal(data.payee.value, '0701234567')
  assert.equal(data.amount.value, 1234)
})
