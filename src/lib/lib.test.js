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

import { expandEvents, onDay, timeLabel, dayList, shortLine } from './events.js'

test('händelse över midnatt visar bara sluttid dagen efter', () => {
  const e = { id: 'x', title: 'M1L494', starts_at: new Date(2026, 10, 4, 19, 23).toISOString(), ends_at: new Date(2026, 10, 5, 11, 5).toISOString(), all_day: false }
  const day = new Date(2026, 10, 5)
  const next = new Date(2026, 10, 6)
  const occ = expandEvents([e], day, next).filter((o) => onDay(o, day))
  assert.equal(occ.length, 1)
  assert.equal(timeLabel(occ[0], day).time, '→ 11:05')
  assert.equal(timeLabel(occ[0], day).note, 'Dag2')
  const dag2 = { id: 'y', title: 'Dag2', starts_at: new Date(2026, 10, 5).toISOString(), ends_at: new Date(2026, 10, 6).toISOString(), all_day: true }
  const list = dayList(expandEvents([e, dag2], day, next), day)
  assert.deepEqual(list.map((o) => o.title), ['M1L494'])
  assert.equal(shortLine({ start: new Date(2026, 10, 6, 13), end: new Date(2026, 10, 6, 20), title: 'Jobb', all_day: false }), '13:00–20:00 Jobb')
  const yday = new Date(2026, 10, 4)
  assert.equal(timeLabel(occ[0], yday).time, '19:23 →')
  const normal = { start: new Date(2026, 10, 5, 15), end: new Date(2026, 10, 5, 16, 30), all_day: false }
  assert.equal(timeLabel(normal, day).time, '15:00–16:30')
})

import { workTime, hoursBetween, sickDayNumber } from './vab.js'
test('vab: arbetstid från pass i kalendern', () => {
  const ev = [{ id: 'a', member_id: 'p', all_day: false, starts_at: new Date('2026-11-10T07:00').toISOString(), ends_at: new Date('2026-11-10T16:00').toISOString() },
    { id: 'b', member_id: 'x', all_day: false, starts_at: new Date('2026-11-10T05:00').toISOString(), ends_at: new Date('2026-11-10T20:00').toISOString() }]
  const w = workTime(ev, 'p', '2026-11-10')
  assert.equal(w.start, '07:00'); assert.equal(w.end, '16:00')
  assert.equal(workTime(ev, 'p', '2026-11-11'), null)
  assert.equal(hoursBetween('07:00', '16:00'), 9)
  assert.equal(hoursBetween('12:00', '16:30'), 4.5)
})
test('vab: dag i sjukperiod räknar med helg', () => {
  const rows = ['2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10'].map((day) => ({ child_id: 'c', day }))
  assert.equal(sickDayNumber(rows, 'c', '2026-11-05'), 1)
  assert.equal(sickDayNumber(rows, 'c', '2026-11-10'), 6)
})
test('vab: nattpass räknas till dagen det börjar', () => {
  const ev = [{ id: 'n', member_id: 'p', all_day: false, starts_at: new Date('2026-11-10T20:00').toISOString(), ends_at: new Date('2026-11-11T07:00').toISOString() }]
  assert.deepEqual([workTime(ev, 'p', '2026-11-10').start, workTime(ev, 'p', '2026-11-10').end], ['20:00', '07:00'])
  assert.equal(workTime(ev, 'p', '2026-11-11'), null)
  assert.equal(hoursBetween('20:00', '07:00'), 11)
})
import { planDue } from './plans.js'
test('återkommande sysslor', () => {
  // 2026-11-05 är en torsdag
  assert.equal(planDue({ unit: 'week', every: 1 }, '2026-11-05'), '2026-11-08')
  assert.equal(planDue({ unit: 'week', every: 1, last_added: '2026-11-05' }, '2026-11-08'), null)
  assert.equal(planDue({ unit: 'week', every: 1, last_added: '2026-11-05' }, '2026-11-09'), '2026-11-15')
  assert.equal(planDue({ unit: 'week', every: 2, last_added: '2026-11-05' }, '2026-11-09'), null)
  assert.equal(planDue({ unit: 'week', every: 2, last_added: '2026-11-05' }, '2026-11-16'), '2026-11-22')
  assert.equal(planDue({ unit: 'month', every: 1, last_added: '2026-11-05' }, '2026-11-30'), null)
  assert.equal(planDue({ unit: 'month', every: 1, last_added: '2026-11-05' }, '2026-12-01'), '2026-12-31')
  assert.equal(planDue({ unit: 'day', every: 2, last_added: '2026-11-05' }, '2026-11-06'), null)
  assert.equal(planDue({ unit: 'day', every: 2, last_added: '2026-11-05' }, '2026-11-07'), '2026-11-07')
})
import { guessCategory, rulePrefix } from './categories.js'
test('kategorier', () => {
  const rules = [{ prefix: 'M1L', category: 'jobb' }]
  assert.equal(guessCategory('M1L494', rules), 'jobb')
  assert.equal(guessCategory('Skola', rules), 'skola')
  assert.equal(guessCategory('Tandläkare', rules), 'vard')
  assert.equal(guessCategory('Fika', rules), null)
  assert.equal(rulePrefix('M1L494'), 'M1L')
  assert.equal(rulePrefix('M1LR09'), 'M1LR')
  assert.equal(rulePrefix('Skola'), null)
})
import { nextBirthday, advance } from './yearly.js'
test('födelsedagar och påminnelser', () => {
  assert.deepEqual(nextBirthday('2018-11-20', '2026-11-05'), { date: '2026-11-20', daysLeft: 15, age: 8 })
  assert.deepEqual(nextBirthday('2018-03-01', '2026-11-05'), { date: '2027-03-01', daysLeft: 116, age: 9 })
  assert.equal(nextBirthday('2016-02-29', '2027-01-01').date, '2027-02-28')
  assert.equal(advance('2026-01-31', 1), '2026-02-28')
  assert.equal(advance('2026-04-01', 12), '2027-04-01')
})
