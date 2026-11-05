// Enkel läsare för .ics-filer (kalenderexport från iPhone, Google, skolan m.m.)
// Läser VEVENT med titel, start, slut, plats och UID. Återkommande händelser
// (RRULE) sparas och visas i kalendern.

function unfold(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
}

function unescape(v) {
  return v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1')
}

export function parseIcsDate(value, params = '') {
  const v = value.trim()
  if (/VALUE=DATE(?!-)/i.test(params) || /^\d{8}$/.test(v)) {
    const y = +v.slice(0, 4), m = +v.slice(4, 6) - 1, d = +v.slice(6, 8)
    return { date: new Date(y, m, d), allDay: true }
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/)
  if (!m) return null
  const [, y, mo, d, h, mi, s = '0', z] = m
  const date = z
    ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s))
    : new Date(+y, +mo - 1, +d, +h, +mi, +s) // TZID/flytande tid tolkas som lokal tid
  return { date, allDay: false }
}

export function parseIcs(text) {
  const lines = unfold(text).split('\n')
  const events = []
  let cur = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue }
    if (line === 'END:VEVENT') {
      if (cur && cur.start) {
        events.push({
          uid: cur.uid || `${cur.title}-${cur.start.date.toISOString()}`,
          title: cur.title || '(utan titel)',
          location: cur.location || null,
          allDay: cur.start.allDay,
          start: cur.start.date,
          end: cur.end ? cur.end.date : null,
          rrule: cur.rrule || null
        })
      }
      cur = null
      continue
    }
    if (!cur) continue
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
    }
  }
  return events
}
