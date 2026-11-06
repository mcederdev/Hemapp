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

import { withAnchor, isHandover, nextHandover, withUs } from './custody.js'
test('växelvis boende: söndagar kl 18 varannan vecka', () => {
  const c = { household_id: 'A', anchor: '2026-11-01', every_days: 7, handover_time: '18:00:00' } // sön 1 nov kommer barnet till A
  assert.equal(withAnchor(c, '2026-11-01', '17:00'), false)
  assert.equal(withAnchor(c, '2026-11-01', '18:30'), true)
  assert.equal(withAnchor(c, '2026-11-05'), true)
  assert.equal(withAnchor(c, '2026-11-08', '17:59'), true)
  assert.equal(withAnchor(c, '2026-11-09'), false)
  assert.equal(withAnchor(c, '2026-10-28'), false)
  assert.equal(isHandover(c, '2026-11-15'), true)
  assert.equal(isHandover(c, '2026-11-14'), false)
  assert.deepEqual(nextHandover(c, '2026-11-05', '10:00'), { date: '2026-11-08', time: '18:00', toAnchor: false })
  assert.deepEqual(nextHandover(c, '2026-11-08', '10:00'), { date: '2026-11-08', time: '18:00', toAnchor: false })
  assert.deepEqual(nextHandover(c, '2026-11-08', '19:00'), { date: '2026-11-15', time: '18:00', toAnchor: true })
  assert.equal(withUs(c, 'B', '2026-11-10'), true)
})

import { carBalance } from './car.js'
test('bil: delade kostnader och reglering', () => {
  const car = { household_id: 'A', owner_share: 50 }
  const costs = [
    { amount: 6000, shared: true, paid_by_household: 'A' }, // försäkring: B ska betala 3000
    { amount: 800, shared: false, paid_by_household: 'A' }, // bensin delas inte
    { amount: 400, shared: true, paid_by_household: 'B' } // parkering: A ska betala 200
  ]
  assert.equal(carBalance(car, costs), 2800)
  assert.equal(carBalance(car, costs, [{ amount: 2800, from_household: 'B' }]), 0)
  assert.equal(carBalance({ ...car, owner_share: 70 }, [{ amount: 1000, shared: true, paid_by_household: null }]), -700)
})

test('växelvis boende: lov ändrar schemat', () => {
  // Jullov: barnet är hos A från sön 20 dec 18:00 till sön 3 jan 18:00 trots att 27 dec vore B:s vecka
  const c = { household_id: 'A', anchor: '2026-11-01', every_days: 7, handover_time: '18:00', exceptions: [{ from_date: '2026-12-20', to_date: '2027-01-03', with_anchor: true }] }
  assert.equal(withAnchor(c, '2026-12-29'), true)
  assert.equal(isHandover(c, '2026-12-27'), false)
  assert.equal(nextHandover(c, '2026-12-21').date, '2027-01-03')
  assert.equal(withAnchor(c, '2027-01-04'), false)
})

import { medicineStatus } from './medicine.js'
test('medicin: räcker till', () => {
  const m = { bottle_size: 100, full_size: 100, dose: 5, doses_per_day: 2, opened_on: '2026-11-01' }
  assert.deepEqual(medicineStatus(m, '2026-11-05'), { left: 60, daysLeft: 6, runsOut: '2026-11-11', share: 0.6 })
  assert.equal(medicineStatus(m, '2026-12-01').left, 0)
})

import { suggestWeek, expiringSoon } from './suggest.js'
test('veckoförslag undviker det som ätits nyligen och använder det som går ut', () => {
  const all = [{ name: 'Tacos', category: 'kott' }, { name: 'Lax', category: 'fisk' }, { name: 'Pannkakor', category: 'veg' }, { name: 'Lasagne', category: 'kott' }]
  const plan = [{ day: '2026-11-01', dish: 'Tacos' }]
  const pantry = [{ name: 'Mjölk', best_before: '2026-11-06' }, { name: 'Ris', best_before: '2027-05-01' }]
  const dishItems = [{ dish: 'Pannkakor', items: ['mjölk', 'ägg', 'mjöl'] }]
  assert.deepEqual(expiringSoon(pantry, '2026-11-05').map((x) => x.name), ['Mjölk'])
  const r = suggestWeek({ all, plan, days: ['2026-11-05', '2026-11-06', '2026-11-07'], today: '2026-11-05', pantry, dishItems, random: () => 0 })
  assert.equal(r[0].dish, 'Pannkakor')
  assert.deepEqual(r[0].uses, ['Mjölk'])
  assert.ok(!r.some((x) => x.dish === 'Tacos'))
  assert.equal(new Set(r.map((x) => x.dish)).size, r.length)
})

import { pantryPlace } from './refill.js'
test('avbockade varor hamnar på rätt ställe hemma', () => {
  assert.equal(pantryPlace({ name: 'Mjölk' }).place, 'kyl')
  assert.equal(pantryPlace({ name: 'Pasta' }).place, 'skafferi')
  assert.equal(pantryPlace({ name: 'Frysta ärtor' }).place, 'frys')
  assert.equal(pantryPlace({ name: 'Bananer' }), null)
  assert.equal(pantryPlace({ name: 'Tandkräm', section: 'Hygien' }), null)
  assert.equal(pantryPlace({ name: 'Nötfärs', section: 'Kött & fisk' }).days, 2)
})

import { freeParent } from './pickup.js'
test('hämta/lämna förväljs till den som är ledig', () => {
  const at = new Date('2026-11-06T15:00')
  const job = (id, s, e) => ({ id: 'j' + id + s, member_id: id, category: 'jobb', all_day: false, starts_at: new Date(`2026-11-06T${s}`).toISOString(), ends_at: new Date(`2026-11-06T${e}`).toISOString() })
  const P = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]
  assert.equal(freeParent([job('a', '08:00', '17:00')], P, at).id, 'b')
  assert.equal(freeParent([], P, at), null)
  assert.equal(freeParent([job('a', '08:00', '17:00'), job('b', '07:00', '16:00')], P, at), null)
})

import { test as t2 } from 'node:test'
t2('syssla med fast dag syns först den dagen, fri syns hela veckan', async () => {
  const { showToday } = await import('./choreRules.js')
  assert.equal(showToday({ plan_id: 'p', fixed_day: true, due_date: '2026-11-12' }, '2026-11-09'), false)
  assert.equal(showToday({ plan_id: 'p', fixed_day: true, due_date: '2026-11-12' }, '2026-11-12'), true)
  assert.equal(showToday({ plan_id: 'p', fixed_day: false, due_date: '2026-11-15' }, '2026-11-09'), true)
  assert.equal(showToday({ due_date: '2026-11-12' }, '2026-11-09'), false)
})

import { taxMonths, inspectionDue, carPlan } from './car.js'
test('fordonsskatt: slutsiffran styr månaden, över 3600 kr tre månader', () => {
  assert.deepEqual(taxMonths('ABC121', 1500), [4])
  assert.deepEqual(taxMonths('ABC12D', 1500), [5])
  assert.deepEqual(taxMonths('ABC120', 5000), [3, 7, 11])
  assert.deepEqual(taxMonths('XYZ998', 4000), [1, 5, 9])
})
test('besiktning 36-24-14 månader', () => {
  assert.equal(inspectionDue({ in_traffic: '2024-05-10' }), '2027-05-31')
  assert.equal(inspectionDue({ in_traffic: '2020-05-10', last_inspection: '2023-04-02' }), '2025-04-30')
  assert.equal(inspectionDue({ in_traffic: '2015-05-10', last_inspection: '2026-03-20' }), '2027-05-31')
  assert.equal(inspectionDue({}), null)
})
test('bilplanen lägger bara till det som saknas', () => {
  const car = { id: 'c', reg_nr: 'ABC121', tax_per_year: 1000, in_traffic: '2015-01-01', last_inspection: '2026-03-01' }
  const p = carPlan(car, [{ car_id: 'c', done: false, title: 'Byta till vinterdäck' }], '2026-11-06')
  assert.deepEqual(p.map((x) => x.title.split(' ')[0]), ['Besiktiga', 'Fordonsskatt', 'Byta'])
  assert.equal(p[1].due_date, '2027-04-30')
  assert.equal(p[0].due_date, '2027-04-30')
})
import { remindersToChores } from './car.js'
test('bilpåminnelser blir sysslor utan dubbletter', () => {
  const car = { id: 'c' }
  const out = remindersToChores(car, [{ car_id: 'c', title: 'Bilbesiktning', due_date: '2027-01-30', repeat_months: 12 }, { car_id: 'c', title: 'Bilförsäkringen förnyas', due_date: '2027-03-01', repeat_months: 12 }],
    [{ car_id: 'c', done: false, title: 'Besiktiga (senast 31 jan. 2027)' }])
  assert.deepEqual(out.map((x) => x.title), ['Bilförsäkringen förnyas'])
  assert.equal(out[0].repeat_unit, 'month')
})
import { taxPayments, upcomingCosts } from './car.js'
test('skatten blir kostnader och syns bland kommande', () => {
  const car = { reg_nr: 'FTJ48A', tax_per_year: 360 }
  assert.deepEqual(taxPayments(car, '2026-11-06', '2027-11-06'), [{ day: '2027-01-31', amount: 360 }])
  const up = upcomingCosts(car, [{ kind: 'forsakring', day: '2026-02-10', amount: 4000, shared: true }, { kind: 'service', day: '2026-12-01', amount: 2500 }], '2026-11-06')
  assert.deepEqual(up.map((c) => `${c.kind} ${c.day}`), ['service 2026-12-01', 'skatt 2027-01-31', 'forsakring 2027-02-10'])
})
import { splitOvertime, overtimePay, isRed, reportDay } from './overtime.js'
test('övertid enligt kollektivavtalet', () => {
  const s = { salary: 43670 }
  // tisdag 10 nov 2026 16:00–21:30: 4 h vardag + 1,5 h annan tid
  const a = splitOvertime(new Date('2026-11-10T16:00'), new Date('2026-11-10T21:30'))
  assert.deepEqual(a, { day: 240, other: 90, total: 330 })
  assert.equal(Math.round(overtimePay(a, s)), Math.round(4 * 43670 / 94 + 1.5 * 43670 / 72))
  assert.equal(splitOvertime(new Date('2026-11-10T16:00'), new Date('2026-11-10T16:10')).total, 0)
  // lördag = annan tid, julafton = annan tid, arbetsfri vardag = annan tid
  assert.equal(splitOvertime(new Date('2026-11-14T10:00'), new Date('2026-11-14T11:00')).other, 60)
  assert.equal(splitOvertime(new Date('2026-12-24T10:00'), new Date('2026-12-24T11:00')).other, 60)
  assert.equal(splitOvertime(new Date('2026-11-10T10:00'), new Date('2026-11-10T11:00'), { freeDay: true }).other, 60)
  assert.ok(isRed('2026-04-03') && isRed('2026-06-19') && isRed('2026-05-14') && !isRed('2026-11-10'))
  assert.equal(reportDay('2026-11-06'), '2026-11-29')
  assert.equal(reportDay('2027-02-10'), '2027-02-27')
})
test('övertid under 15 min med undantag', () => {
  assert.equal(splitOvertime(new Date('2026-11-10T16:00'), new Date('2026-11-10T16:10'), { minMinutes: 0 }).total, 10)
})

test('dolda undersidor', async () => {
  const { setMenuState, shows, pickSub, isHidden } = await import('./menu.js')
  setMenuState({ hidden: ['finance.overtime', 'car'] })
  assert.equal(shows('finance'), true)
  assert.equal(shows('finance.overtime'), false)
  assert.equal(shows('car.todo'), false)
  assert.equal(pickSub('finance', 'overtime'), 'bills')
  assert.equal(pickSub('shopping', 'list', ['list'], 'list'), 'list')
  assert.equal(isHidden('stats.food', []), false)
  setMenuState(null)
})
