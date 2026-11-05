// Födelsedagar och årliga påminnelser. Samma fil används av servern.
const p = (s) => new Date(s + 'T12:00:00Z')
const fmt = (d) => d.toISOString().slice(0, 10)
export const daysUntil = (from, to) => Math.round((p(to) - p(from)) / 86400000)

// Nästa födelsedag från och med idag: { date, daysLeft, age }
export function nextBirthday(day, today) {
  const y = +today.slice(0, 4)
  const md = day.slice(5)
  const make = (yy) => {
    // 29 feb firas 28 feb vanliga år
    const leap = (yy % 4 === 0 && yy % 100 !== 0) || yy % 400 === 0
    return `${yy}-${md === '02-29' && !leap ? '02-28' : md}`
  }
  let date = make(y)
  if (date < today) date = make(y + 1)
  return { date, daysLeft: daysUntil(today, date), age: +date.slice(0, 4) - +day.slice(0, 4) }
}

// Nästa förfallodag efter att en påminnelse markerats som klar
export function advance(due, months) {
  const d = p(due); const day = d.getUTCDate()
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return fmt(d)
}

export const REMINDER_SUGGESTIONS = [
  { emoji: '🚗', title: 'Bilbesiktning', months: 12 },
  { emoji: '🛞', title: 'Byta till sommardäck', months: 12, md: '04-01' },
  { emoji: '❄️', title: 'Byta till vinterdäck', months: 12, md: '10-15' },
  { emoji: '🏠', title: 'Hemförsäkringen förnyas', months: 12 },
  { emoji: '🚙', title: 'Bilförsäkringen förnyas', months: 12 },
  { emoji: '🔋', title: 'Testa brandvarnare och byta batteri', months: 12, md: '12-01' },
  { emoji: '🦷', title: 'Tandläkare', months: 12 },
  { emoji: '🛂', title: 'Pass eller ID-kort går ut', months: 0 },
  { emoji: '📺', title: 'Abonnemang: säga upp eller förhandla', months: 12 }
]
