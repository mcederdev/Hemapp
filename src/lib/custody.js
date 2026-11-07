// Växelvis boende. Samma fil används av servern.
// c = { household_id, anchor: 'YYYY-MM-DD' (en dag barnet kommer till household_id), every_days, handover_time: 'HH:MM',
//       exceptions?: [{ from_date, to_date, with_anchor, from_time?, to_time? }] } (lov och semester eller ett flyttat byte: barnet är hos
//       ankarhushållet eller inte, från from_date kl from_time till to_date kl to_time; utan klockslag gäller bytestiden)
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
    const afterStart = date > x.from_date || (date === x.from_date && time >= (x.from_time || t))
    const beforeEnd = date < x.to_date || (date === x.to_date && time < (x.to_time || t))
    if (afterStart && beforeEnd) return !!x.with_anchor
  }
  return regular(c, date, time)
}

// Är det byte den här dagen?
export function isHandover(c, date) {
  return withAnchor(c, date, '00:00') !== withAnchor(c, date, '23:59')
}

// Klockslaget för bytet en viss dag: ett flyttat byte har egen tid, annars vanliga bytestiden
export function handoverTime(c, date) {
  const t = hm(c)
  const times = []
  for (const x of c.exceptions || []) {
    if (x.from_date === date) times.push(x.from_time || t)
    if (x.to_date === date) times.push(x.to_time || t)
  }
  if (!times.length) return t
  // Den tid då barnet faktiskt byter hem
  const before = withAnchor(c, date, '00:00')
  return [...times, t].sort().find((x) => withAnchor(c, date, x) !== before) || times[0]
}

// Nästa byte från och med nu: { date, time, toAnchor } (toAnchor = barnet kommer till household_id)
export function nextHandover(c, date, time = '00:00') {
  for (let i = 0; i < 400; i++) {
    const d = plus(date, i)
    if (!isHandover(c, d)) continue
    const at = handoverTime(c, d)
    if (i === 0 && time >= at) continue
    return { date: d, time: at, toAnchor: withAnchor(c, d, '23:59') }
  }
  return { date: plus(date, c.every_days || 7), time: hm(c), toAnchor: withAnchor(c, plus(date, c.every_days || 7), '23:59') }
}

// Sett från ett visst hushåll: är barnet hos oss?
export const withUs = (c, myHousehold, date, time) => withAnchor(c, date, time) === (c.household_id === myHousehold)

// Flytta ett byte en gång: regular = { date, time } för det vanliga bytet, to = { date, time } för det nya.
// Ger avvikelsen att spara i custody_exceptions.
export function moveHandover(c, regular, to) {
  const earlier = to.date < regular.date || (to.date === regular.date && to.time < regular.time)
  const a = earlier ? to : regular, b = earlier ? regular : to
  // Tidigare: barnet är redan där det skulle hamna. Senare: barnet stannar där det var.
  const with_anchor = earlier ? withAnchor(c, regular.date, '23:59') : withAnchor(c, regular.date, '00:00')
  return { from_date: a.date, from_time: a.time, to_date: b.date, to_time: b.time, with_anchor }
}
