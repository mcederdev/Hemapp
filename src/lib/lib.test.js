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
