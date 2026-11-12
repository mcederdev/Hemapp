// Fördelar hushållets räkningar efter inkomst.
// Den som tjänar mer betalar en större andel. Resultatet säger vem som ska
// swisha vem och hur mycket, utifrån vem som faktiskt betalat räkningarna.
// Allt som visas och swishas är hela kronor, och delarna summerar alltid till totalen.

const num = (v) => Number(v) || 0

// Fördelar ett heltal kronor efter andelar så att summan blir exakt rätt (största rest).
// Lika rest: den som redan betalat mest tar kronan, så att det blir så lite att swisha som möjligt.
function allocateKr(total, rows) {
  const parts = rows.map((r, i) => ({ i, exact: total * r.share, prio: r.paid - r.shouldPay }))
  for (const p of parts) p.kr = Math.floor(p.exact + 1e-9)
  let left = total - parts.reduce((s, p) => s + p.kr, 0)
  const order = [...parts].sort((a, b) => (b.exact - b.kr) - (a.exact - a.kr) || b.prio - a.prio || a.i - b.i)
  for (const p of order) { if (left <= 0) break; p.kr++; left-- }
  return parts.map((p) => p.kr)
}

export function splitBills(people, bills) {
  // Negativ inkomst räknas som 0, annars blir andelarna under 0 % eller över 100 %
  const incomeOf = (p) => Math.max(0, num(p.income))
  const totalIncome = people.reduce((s, p) => s + incomeOf(p), 0)
  const totalBills = bills.reduce((s, b) => s + num(b.amount), 0)

  const rows = people.map((p) => {
    const share = totalIncome > 0 ? incomeOf(p) / totalIncome : 1 / people.length
    const shouldPay = totalBills * share
    const paid = bills.filter((b) => b.paidBy === p.id).reduce((s, b) => s + num(b.amount), 0)
    return { id: p.id, name: p.name, share, shouldPay, paid, balance: paid - shouldPay }
  })
  const krs = allocateKr(Math.round(totalBills), rows)
  rows.forEach((r, i) => { r.shouldPayKr = krs[i]; r.balanceKr = r.paid - krs[i] })

  // Matcha de som betalat för lite mot de som betalat för mycket (i hela kronor)
  const debtors = rows.filter((r) => r.balanceKr < -0.5).map((r) => ({ ...r, left: -r.balanceKr }))
  const creditors = rows.filter((r) => r.balanceKr > 0.5).map((r) => ({ ...r, left: r.balanceKr }))
  const transfers = []
  for (const d of debtors) {
    for (const c of creditors) {
      if (d.left <= 0.5) break
      if (c.left <= 0.5) continue
      const amount = Math.min(d.left, c.left)
      transfers.push({ from: d.name, to: c.name, amount: Math.round(amount) })
      d.left -= amount
      c.left -= amount
    }
  }
  return { totalIncome, totalBills, rows, transfers }
}
