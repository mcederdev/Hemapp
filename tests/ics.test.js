// Kalenderimport (.ics) och återkommande händelser (RRULE).
// Testerna körs i svensk tid (Europe/Stockholm, se vitest.config.js).
import { describe, it, expect } from 'vitest'
import { parseIcs, parseIcsDate } from '../src/lib/ics.js'
import { occurrences, parseRrule, simpleRrule } from '../src/lib/rrule.js'

const cal = (...events) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events.flat(), 'END:VCALENDAR'].join('\r\n')
const ev = (...lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT']
const local = (y, m, d, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi)
const day = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const days = (list) => list.map(day)

describe('giltiga .ics-filer', () => {
  it('läser titel, plats, start, slut och UID', () => {
    const [e] = parseIcs(cal(ev('UID:abc@skolan', 'SUMMARY:Utvecklingssamtal', 'LOCATION:Rum 3\\, plan 2',
      'DTSTART:20261110T150000Z', 'DTEND:20261110T153000Z')))
    expect(e).toMatchObject({ uid: 'abc@skolan', title: 'Utvecklingssamtal', location: 'Rum 3, plan 2', allDay: false, rrule: null })
    expect(e.start.toISOString()).toBe('2026-11-10T15:00:00.000Z')
    expect(e.end.toISOString()).toBe('2026-11-10T15:30:00.000Z')
  })

  it('heldag med VALUE=DATE', () => {
    const [e] = parseIcs(cal(ev('UID:1', 'SUMMARY:Studiedag', 'DTSTART;VALUE=DATE:20261120', 'DTEND;VALUE=DATE:20261121')))
    expect(e.allDay).toBe(true)
    expect(e.start).toEqual(local(2026, 11, 20))
    expect(e.end).toEqual(local(2026, 11, 21))
  })

  it('tid med TZID tolkas som lokal tid', () => {
    const [e] = parseIcs(cal(ev('UID:1', 'DTSTART;TZID=Europe/Stockholm:20261110T160000')))
    expect(e.start).toEqual(local(2026, 11, 10, 16))
  })

  it('tid utan sekunder', () => {
    expect(parseIcsDate('20261110T1600').date).toEqual(local(2026, 11, 10, 16))
  })

  it('vikta rader (RFC 5545) sätts ihop', () => {
    const [e] = parseIcs(cal(ev('UID:1', 'SUMMARY:Föräldramöte för', '  årskurs 3', 'DTSTART:20261110T160000Z')))
    expect(e.title).toBe('Föräldramöte för årskurs 3')
  })

  it('escapade tecken och radbrytningar', () => {
    const [e] = parseIcs(cal(ev('UID:1', 'SUMMARY:Ta med: kläder\; frukt\\, vatten\\\\', 'DTSTART:20261110T160000Z')))
    expect(e.title).toBe('Ta med: kläder; frukt, vatten\\')
  })

  it('fungerar med bara \\n som radslut', () => {
    const text = cal(ev('UID:1', 'SUMMARY:A', 'DTSTART:20261110T160000Z')).replace(/\r\n/g, '\n')
    expect(parseIcs(text)).toHaveLength(1)
  })

  it('läser flera händelser och hoppar över VTIMEZONE', () => {
    const text = cal(['BEGIN:VTIMEZONE', 'TZID:Europe/Stockholm', 'BEGIN:STANDARD', 'DTSTART:19701025T030000', 'END:STANDARD', 'END:VTIMEZONE'],
      ev('UID:1', 'SUMMARY:A', 'DTSTART:20261110T160000Z'), ev('UID:2', 'SUMMARY:B', 'DTSTART:20261111T160000Z'))
    expect(parseIcs(text).map((e) => e.title)).toEqual(['A', 'B'])
  })

  it('sparar RRULE', () => {
    const [e] = parseIcs(cal(ev('UID:1', 'DTSTART:20261110T160000Z', 'RRULE:FREQ=WEEKLY;BYDAY=TU')))
    expect(e.rrule).toBe('FREQ=WEEKLY;BYDAY=TU')
  })
})

describe('trasiga och ofullständiga filer', () => {
  it('tom fil ger inga händelser', () => {
    expect(parseIcs('')).toEqual([])
  })

  it('skräptext ger inga händelser', () => {
    expect(parseIcs('hej hopp\ninte en kalender')).toEqual([])
  })

  it('kalender utan händelser', () => {
    expect(parseIcs(cal())).toEqual([])
  })

  it('händelse utan DTSTART hoppas över', () => {
    expect(parseIcs(cal(ev('UID:1', 'SUMMARY:Utan tid')))).toEqual([])
  })

  it('händelse med oläsligt datum hoppas över', () => {
    expect(parseIcs(cal(ev('UID:1', 'DTSTART:2026-11-10 16:00')))).toEqual([])
  })

  it('avklippt fil: den sista ofärdiga händelsen hoppas över, de hela läses', () => {
    const text = cal(ev('UID:1', 'SUMMARY:Hel', 'DTSTART:20261110T160000Z')) .replace('END:VCALENDAR', 'BEGIN:VEVENT\r\nUID:2\r\nDTSTART:2026')
    expect(parseIcs(text).map((e) => e.title)).toEqual(['Hel'])
  })

  it('utan titel och UID får händelsen en reservtitel och ett eget id', () => {
    const [e] = parseIcs(cal(ev('DTSTART:20261110T160000Z')))
    expect(e.title).toBe('(utan titel)')
    expect(e.uid).toBeTruthy()
  })

  it('rader utan kolon ignoreras', () => {
    const [e] = parseIcs(cal(ev('UID:1', 'trasig rad', 'DTSTART:20261110T160000Z')))
    expect(e.uid).toBe('1')
  })

  it('Fixad bugg: omöjligt datum (månad 13) ska inte bli januari nästa år', () => {
    expect(parseIcs(cal(ev('UID:1', 'DTSTART;VALUE=DATE:20261301')))).toEqual([])
  })

  it('Fixad bugg: SUMMARY i en påminnelse (VALARM) skriver inte över händelsens titel', () => {
    const [e] = parseIcs(cal(ev('UID:1', 'SUMMARY:Tandläkare', 'DTSTART:20261110T160000Z',
      'BEGIN:VALARM', 'ACTION:EMAIL', 'SUMMARY:Påminnelse', 'TRIGGER:-PT30M', 'END:VALARM')))
    expect(e.title).toBe('Tandläkare')
  })

  it('Fixad bugg: EXDATE (inställda tillfällen) läses in', () => {
    const [e] = parseIcs(cal(ev('UID:1', 'DTSTART:20261110T160000Z', 'RRULE:FREQ=WEEKLY', 'EXDATE:20261117T160000Z')))
    expect(e.exdates).toEqual([new Date('2026-11-17T16:00:00Z').toISOString()])
  })

  it('Fixad bugg: ett flyttat tillfälle (RECURRENCE-ID) får inte samma uid som serien', () => {
    // Samma uid två gånger i en upsert får Supabase att avvisa hela importen
    const events = parseIcs(cal(
      ev('UID:serie@x', 'SUMMARY:Simning', 'DTSTART:20261110T160000Z', 'RRULE:FREQ=WEEKLY'),
      ev('UID:serie@x', 'RECURRENCE-ID:20261117T160000Z', 'SUMMARY:Simning (flyttad)', 'DTSTART:20261118T160000Z')))
    expect(new Set(events.map((e) => e.uid)).size).toBe(events.length)
  })
})

describe('återkommande händelser (RRULE)', () => {
  it('veckovis över ett månadsskifte', () => {
    const start = local(2026, 10, 20, 16)
    const r = occurrences(start, 'FREQ=WEEKLY', local(2026, 10, 1), local(2026, 11, 20))
    expect(days(r)).toEqual(['2026-10-20', '2026-10-27', '2026-11-03', '2026-11-10', '2026-11-17'])
  })

  it('tisdagar och torsdagar över ett månadsskifte', () => {
    const r = occurrences(local(2026, 10, 27, 17), 'FREQ=WEEKLY;BYDAY=TU,TH', local(2026, 10, 1), local(2026, 11, 7))
    expect(days(r)).toEqual(['2026-10-27', '2026-10-29', '2026-11-03', '2026-11-05'])
  })

  it('dagligen över årsskiftet', () => {
    const r = occurrences(local(2026, 12, 30, 8), 'FREQ=DAILY', local(2026, 12, 1), local(2027, 1, 3))
    expect(days(r)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
  })

  it('varannan vecka över årsskiftet', () => {
    const r = occurrences(local(2026, 12, 14, 18), 'FREQ=WEEKLY;INTERVAL=2', local(2026, 12, 1), local(2027, 2, 1))
    expect(days(r)).toEqual(['2026-12-14', '2026-12-28', '2027-01-11', '2027-01-25'])
  })

  it('varannan vecka med BYDAY börjar inte en vecka för tidigt', () => {
    const r = occurrences(local(2026, 11, 11, 18), 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE', local(2026, 11, 1), local(2026, 12, 1))
    expect(days(r)).toEqual(['2026-11-11', '2026-11-23', '2026-11-25'])
  })

  it('dagligen genom skottdagen 29 feb 2028', () => {
    const r = occurrences(local(2028, 2, 27, 9), 'FREQ=DAILY', local(2028, 2, 1), local(2028, 3, 2))
    expect(days(r)).toEqual(['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01'])
  })

  it('veckovis på en skottdag', () => {
    const r = occurrences(local(2028, 2, 22, 9), 'FREQ=WEEKLY', local(2028, 2, 1), local(2028, 3, 10))
    expect(days(r)).toEqual(['2028-02-22', '2028-02-29', '2028-03-07'])
  })

  it('månadsvis den 15:e', () => {
    const r = occurrences(local(2026, 11, 15, 12), 'FREQ=MONTHLY', local(2026, 11, 1), local(2027, 2, 1))
    expect(days(r)).toEqual(['2026-11-15', '2026-12-15', '2027-01-15'])
  })

  it('COUNT räknas från första tillfället även om visningen börjar senare', () => {
    const r = occurrences(local(2026, 12, 28, 9), 'FREQ=DAILY;COUNT=5', local(2027, 1, 1), local(2027, 2, 1))
    expect(days(r)).toEqual(['2027-01-01'])
  })

  it('UNTIL med bara datum tar med hela sista dagen', () => {
    const r = occurrences(local(2026, 11, 2, 18), 'FREQ=WEEKLY;UNTIL=20261116', local(2026, 11, 1), local(2026, 12, 31))
    expect(days(r)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16'])
  })

  it('UNTIL i UTC', () => {
    const r = occurrences(new Date('2026-11-02T17:00:00Z'), 'FREQ=DAILY;UNTIL=20261104T170000Z', local(2026, 11, 1), local(2026, 12, 1))
    expect(r).toHaveLength(3)
  })

  it('klockslaget står still över sommartidens slut (25 okt 2026)', () => {
    const r = occurrences(local(2026, 10, 23, 16), 'FREQ=DAILY', local(2026, 10, 23), local(2026, 10, 27))
    expect(r.map((d) => d.getHours())).toEqual([16, 16, 16, 16])
  })

  it('borttagna tillfällen (exdates) visas inte', () => {
    const start = local(2026, 11, 2, 18)
    const r = occurrences(start, 'FREQ=WEEKLY', local(2026, 11, 1), local(2026, 11, 30), [local(2026, 11, 9, 18).toISOString()])
    expect(days(r)).toEqual(['2026-11-02', '2026-11-16', '2026-11-23'])
  })

  it('utan RRULE syns händelsen bara en gång', () => {
    expect(occurrences(local(2026, 11, 2), null, local(2026, 11, 1), local(2026, 12, 1))).toHaveLength(1)
    expect(occurrences(local(2026, 11, 2), null, local(2026, 12, 1), local(2027, 1, 1))).toHaveLength(0)
  })

  it('okänd FREQ ger bara första tillfället (kraschar inte)', () => {
    expect(() => occurrences(local(2026, 11, 2), 'FREQ=HOURLY', local(2026, 11, 1), local(2026, 12, 1))).not.toThrow()
  })

  it('läser regeln med och utan RRULE:-prefix', () => {
    expect(parseRrule('RRULE:FREQ=WEEKLY;INTERVAL=2')).toEqual({ FREQ: 'WEEKLY', INTERVAL: '2' })
    expect(parseRrule('INTERVAL=2')).toBeNull()
    expect(parseRrule('')).toBeNull()
  })

  it('appens egna val blir rätt RRULE', () => {
    expect(simpleRrule('biweekly')).toBe('FREQ=WEEKLY;INTERVAL=2')
    expect(simpleRrule('weekly', '2026-12-31')).toBe('FREQ=WEEKLY;UNTIL=20261231T235959')
    expect(simpleRrule(null)).toBeNull()
  })

  it('Fixad bugg: månadsvis den 31:a hoppar över månader som saknar den 31:a', () => {
    // RFC 5545: inget tillfälle de månaderna. Nu blir det 3 mars, 1 maj osv.
    const r = occurrences(local(2027, 1, 31, 12), 'FREQ=MONTHLY', local(2027, 1, 1), local(2027, 6, 1))
    expect(days(r)).toEqual(['2027-01-31', '2027-03-31', '2027-05-31'])
  })

  it('Fixad bugg: årligen den 29 feb visas bara på skottår', () => {
    const r = occurrences(local(2028, 2, 29, 12), 'FREQ=YEARLY', local(2028, 1, 1), local(2033, 1, 1))
    expect(days(r)).toEqual(['2028-02-29', '2032-02-29'])
  })

  it('Fixad bugg: månadsvis "första måndagen" (BYDAY=1MO)', () => {
    const r = occurrences(local(2026, 11, 2, 18), 'FREQ=MONTHLY;BYDAY=1MO', local(2026, 11, 1), local(2027, 2, 1))
    expect(days(r)).toEqual(['2026-11-02', '2026-12-07', '2027-01-04'])
  })

  it('Fixad bugg: en daglig händelse som startade för länge sedan syns fortfarande', () => {
    // Loopen stannar efter 5000 varv, alltså cirka 13,7 år för dagliga händelser
    const r = occurrences(local(2010, 1, 1, 8), 'FREQ=DAILY', local(2026, 11, 10), local(2026, 11, 11))
    expect(days(r)).toEqual(['2026-11-10'])
  })
})
