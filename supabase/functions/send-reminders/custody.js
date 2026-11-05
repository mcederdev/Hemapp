// Växelvis boende. Samma fil används av servern.
// c = { household_id, anchor: 'YYYY-MM-DD' (en dag barnet kommer till household_id), every_days, handover_time: 'HH:MM' }
const p = (s) => new Date(s + 'T12:00:00Z')
const fmt = (d) => d.toISOString().slice(0, 10)
const diff = (a, b) => Math.round((p(b) - p(a)) / 86400000)
const plus = (s, n) => { const d = p(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d) }
const hm = (c) => String(c.handover_time || '18:00').slice(0, 5)

// Är barnet hos household_id vid denna tid? (time = 'HH:MM')
export function withAnchor(c, date, time = '12:00') {
  const e = c.every_days || 7
  const idx = diff(c.anchor, date) - (time < hm(c) ? 1 : 0)
  const k = Math.floor(idx / e)
  return ((k % 2) + 2) % 2 === 0
}

// Är det byte den här dagen?
export function isHandover(c, date) {
  const e = c.every_days || 7
  return ((diff(c.anchor, date) % e) + e) % e === 0
}

// Nästa byte från och med nu: { date, time, toAnchor } (toAnchor = barnet kommer till household_id)
export function nextHandover(c, date, time = '00:00') {
  const e = c.every_days || 7
  const r = ((diff(c.anchor, date) % e) + e) % e
  const d = r === 0 && time < hm(c) ? date : plus(date, r === 0 ? e : e - r)
  return { date: d, time: hm(c), toAnchor: withAnchor(c, d, '23:59') }
}

// Sett från ett visst hushåll: är barnet hos oss?
export const withUs = (c, myHousehold, date, time) => withAnchor(c, date, time) === (c.household_id === myHousehold)
