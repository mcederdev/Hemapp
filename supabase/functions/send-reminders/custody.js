// Växelvis boende. Samma fil används av servern.
// c = { household_id, anchor: 'YYYY-MM-DD' (en dag barnet kommer till household_id), every_days, handover_time: 'HH:MM',
//       exceptions?: [{ from_date, to_date, with_anchor }] } (lov och semester: barnet är hos ankarhushållet eller inte, från from_date till to_date vid bytestiden)
const p = (s) => new Date(s + 'T12:00:00Z')
const fmt = (d) => d.toISOString().slice(0, 10)
const diff = (a, b) => Math.round((p(b) - p(a)) / 86400000)
const plus = (s, n) => { const d = p(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d) }
const hm = (c) => String(c.handover_time || '18:00').slice(0, 5)

function regular(c, date, time) {
  const e = c.every_days || 7
  const idx = diff(c.anchor, date) - (time < hm(c) ? 1 : 0)
  const k = Math.floor(idx / e)
  return ((k % 2) + 2) % 2 === 0
}

// Är barnet hos household_id vid denna tid? (time = 'HH:MM')
export function withAnchor(c, date, time = '12:00') {
  const t = hm(c)
  for (const x of c.exceptions || []) {
    const afterStart = date > x.from_date || (date === x.from_date && time >= t)
    const beforeEnd = date < x.to_date || (date === x.to_date && time < t)
    if (afterStart && beforeEnd) return !!x.with_anchor
  }
  return regular(c, date, time)
}

// Är det byte den här dagen?
export function isHandover(c, date) {
  return withAnchor(c, date, '00:00') !== withAnchor(c, date, '23:59')
}

// Nästa byte från och med nu: { date, time, toAnchor } (toAnchor = barnet kommer till household_id)
export function nextHandover(c, date, time = '00:00') {
  for (let i = 0; i < 400; i++) {
    const d = plus(date, i)
    if (i === 0 && time >= hm(c)) continue
    if (isHandover(c, d)) return { date: d, time: hm(c), toAnchor: withAnchor(c, d, '23:59') }
  }
  return { date: plus(date, c.every_days || 7), time: hm(c), toAnchor: withAnchor(c, plus(date, c.every_days || 7), '23:59') }
}

// Sett från ett visst hushåll: är barnet hos oss?
export const withUs = (c, myHousehold, date, time) => withAnchor(c, date, time) === (c.household_id === myHousehold)
