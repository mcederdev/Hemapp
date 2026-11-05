// Fördelar hushållets räkningar efter inkomst.
// Den som tjänar mer betalar en större andel. Resultatet säger vem som ska
// swisha vem och hur mycket, utifrån vem som faktiskt betalat räkningarna.

export function splitBills(people, bills) {
  const totalIncome = people.reduce((s, p) => s + (Number(p.income) || 0), 0)
  const totalBills = bills.reduce((s, b) => s + (Number(b.amount) || 0), 0)

  const rows = people.map((p) => {
    const share = totalIncome > 0 ? (Number(p.income) || 0) / totalIncome : 1 / people.length
    const shouldPay = totalBills * share
    const paid = bills
      .filter((b) => b.paidBy === p.id)
      .reduce((s, b) => s + (Number(b.amount) || 0), 0)
    return { id: p.id, name: p.name, share, shouldPay, paid, balance: paid - shouldPay }
  })

  // Matcha de som betalat för lite mot de som betalat för mycket
  const debtors = rows.filter((r) => r.balance < -0.5).map((r) => ({ ...r, left: -r.balance }))
  const creditors = rows.filter((r) => r.balance > 0.5).map((r) => ({ ...r, left: r.balance }))
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
