// Enkel läsare för .ics-filer (kalenderexport från iPhone, Google, skolan m.m.)
// Läser VEVENT med titel, start, slut, plats och UID. Återkommande händelser
// (RRULE) sparas och visas i kalendern.

function unfold(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
}

function unescape(v) {
  return v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1')
}

// Finns dagen? (t.ex. inte månad 13 eller 31 april)
const validDay = (y, m, d) => m >= 0 && m <= 11 && d >= 1 && d <= new Date(y, m + 1, 0).getDate()

export function parseIcsDate(value, params = '') {
  const v = value.trim()
  if (/VALUE=DATE(?!-)/i.test(params) || /^\d{8}$/.test(v)) {
    if (!/^\d{8}$/.test(v)) return null
    const y = +v.slice(0, 4), m = +v.slice(4, 6) - 1, d = +v.slice(6, 8)
    if (!validDay(y, m, d)) return null
    return { date: new Date(y, m, d), allDay: true }
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/)
  if (!m) return null
  const [, y, mo, d, h, mi, s = '0', z] = m
  if (!validDay(+y, +mo - 1, +d) || +h > 23 || +mi > 59 || +s > 60) return null
  const date = z
    ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s))
    : new Date(+y, +mo - 1, +d, +h, +mi, +s) // TZID/flytande tid tolkas som lokal tid
  return { date, allDay: false }
}

export function parseIcs(text) {
  const lines = unfold(text || '').split('\n').map((l) => l.replace(/\s+$/, ''))
  const events = []
  let cur = null
  let nested = 0 // inne i t.ex. VALARM i en händelse: deras SUMMARY m.m. hör inte till händelsen
  for (const line of lines) {
    const up = line.toUpperCase()
    if (up === 'BEGIN:VEVENT') { cur = { exdates: [] }; nested = 0; continue }
    if (up === 'END:VEVENT') {
      if (cur && cur.start) {
        events.push({
          uid: cur.uid || `${cur.title}-${cur.start.date.toISOString()}`,
          title: cur.title || '(utan titel)',
          location: cur.location || null,
          allDay: cur.start.allDay,
          start: cur.start.date,
          end: cur.end ? cur.end.date : null,
          rrule: cur.rrule || null,
          exdates: cur.exdates,
          recurrenceId: cur.recurrenceId || null,
          cancelled: cur.cancelled || false
        })
      }
      cur = null
      continue
    }
    if (!cur) continue
    if (up.startsWith('BEGIN:')) { nested++; continue }
    if (up.startsWith('END:')) { nested = Math.max(0, nested - 1); continue }
    if (nested) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const left = line.slice(0, idx)
    const value = line.slice(idx + 1)
    const [name, ...paramParts] = left.split(';')
    const params = paramParts.join(';')
    switch (name.toUpperCase()) {
      case 'SUMMARY': cur.title = unescape(value); break
      case 'LOCATION': cur.location = unescape(value); break
      case 'UID': cur.uid = value.trim(); break
      case 'DTSTART': cur.start = parseIcsDate(value, params); break
      case 'DTEND': cur.end = parseIcsDate(value, params); break
      case 'RRULE': cur.rrule = value.trim(); break
      case 'STATUS': cur.cancelled = /^CANCELLED$/i.test(value.trim()); break
      case 'EXDATE':
        for (const v of value.split(',')) { const d = parseIcsDate(v, params); if (d) cur.exdates.push(d.date.toISOString()) }
        break
      case 'RECURRENCE-ID': { const d = parseIcsDate(value, params); if (d) cur.recurrenceId = d.date.toISOString(); break }
    }
  }
  return resolveOverrides(events)
}

// Ett ändrat tillfälle i en serie (RECURRENCE-ID) har samma UID som serien. Det ursprungliga
// tillfället tas bort ur serien, och det ändrade blir en egen händelse med eget id.
// Inställda tillfällen (STATUS:CANCELLED) tas bara bort.
function resolveOverrides(events) {
  const masters = new Map(events.filter((e) => !e.recurrenceId).map((e) => [e.uid, e]))
  const out = []
  for (const e of events) {
    if (!e.recurrenceId) { if (!e.cancelled) out.push(e); continue }
    const master = masters.get(e.uid)
    if (master && !master.exdates.includes(e.recurrenceId)) master.exdates.push(e.recurrenceId)
    if (!e.cancelled) out.push({ ...e, uid: `${e.uid}/${e.recurrenceId}` })
  }
  return out
}
