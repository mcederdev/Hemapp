// Medicin: hur mycket som är kvar i flaskan. Samma fil används av servern.
// m = { bottle_size (mängd när flaskan öppnades/justerades), dose, doses_per_day, opened_on }
const p = (s) => new Date(s + 'T12:00:00Z')
const fmt = (d) => d.toISOString().slice(0, 10)
const days = (a, b) => Math.round((p(b) - p(a)) / 86400000)

export function medicineStatus(m, today) {
  const perDay = Number(m.dose) * Number(m.doses_per_day)
  const used = perDay * Math.max(0, days(m.opened_on, today))
  const left = Math.max(0, Number(m.bottle_size) - used)
  const daysLeft = perDay > 0 ? Math.floor(left / perDay) : Infinity
  const d = p(today); if (Number.isFinite(daysLeft)) d.setUTCDate(d.getUTCDate() + daysLeft)
  const full = Number(m.full_size || m.bottle_size) || 1
  return { left: Math.round(left * 10) / 10, daysLeft, runsOut: Number.isFinite(daysLeft) ? fmt(d) : null, share: Math.min(1, left / full) }
}
