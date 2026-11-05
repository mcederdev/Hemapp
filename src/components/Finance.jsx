import { useState } from 'react'
import { useTable } from '../useTable'
import { splitBills } from '../lib/finance'
import MemberPicker from './MemberPicker'

const kr = (n) => Math.round(n).toLocaleString('sv-SE') + ' kr'

export default function Finance({ householdId, members, membersTable }) {
  const bills = useTable('bills', householdId)
  const parents = members.filter((m) => m.role === 'parent')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState(null)

  const result = splitBills(
    parents.map((p) => ({ id: p.id, name: p.name, income: p.monthly_income })),
    bills.rows.map((b) => ({ amount: b.amount, paidBy: b.paid_by }))
  )
  const byId = Object.fromEntries(members.map((m) => [m.id, m]))

  const add = (e) => {
    e.preventDefault()
    if (!name.trim() || !amount) return
    bills.insert({ name: name.trim(), amount: Number(amount), paid_by: paidBy || parents[0]?.id })
    setName(''); setAmount('')
  }

  return (
    <section>
      <h2>Ekonomi</h2>
      <div className="card stack">
        <h3>Inkomst per månad (netto)</h3>
        {parents.map((p) => (
          <label key={p.id} className="row between">
            <span>{p.name}</span>
            <input type="number" inputMode="numeric" defaultValue={p.monthly_income || ''} placeholder="0" style={{ maxWidth: 140 }}
              onBlur={(e) => membersTable.update(p.id, { monthly_income: Number(e.target.value) || 0 })} />
          </label>
        ))}
        {parents.length < 2 && <p className="muted small">Bjud in den andra föräldern under Familj för att fördela räkningarna.</p>}
      </div>

      <div className="card stack">
        <h3>Räkningar per månad</h3>
        <form className="stack" onSubmit={add}>
          <div className="row">
            <input placeholder="T.ex. Hyra, el, försäkring" value={name} onChange={(e) => setName(e.target.value)} />
            <input type="number" inputMode="numeric" placeholder="Belopp" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ maxWidth: 110 }} />
          </div>
          <div className="row">
            <span className="muted nowrap">Betalas av</span>
            <MemberPicker members={parents} value={paidBy || parents[0]?.id} onChange={setPaidBy} emptyLabel="Välj" />
            <button className="primary">Lägg till</button>
          </div>
        </form>
        <ul className="list">
          {bills.rows.map((b) => (
            <li key={b.id}>
              <span>{b.name}<span className="muted small"> · {byId[b.paid_by]?.name || '?'} betalar</span></span>
              <span className="meta">
                <strong>{kr(b.amount)}</strong>
                <button className="icon-btn" onClick={() => bills.remove(b.id)} aria-label="Ta bort">✕</button>
              </span>
            </li>
          ))}
        </ul>
        <div className="row between"><strong>Totalt</strong><strong>{kr(result.totalBills)}</strong></div>
      </div>

      {result.totalBills > 0 && parents.length > 0 && (
        <div className="card stack result">
          <h3>Fördelning</h3>
          {result.rows.map((r) => (
            <div key={r.id}>
              <strong>{r.name} ({Math.round(r.share * 100)} %)</strong>
              <div className="muted small">Ska stå för {kr(r.shouldPay)}, betalar själv {kr(r.paid)}</div>
            </div>
          ))}
          {result.transfers.length === 0
            ? <p className="swish">Ni är kvitt, ingen behöver swisha. 👍</p>
            : result.transfers.map((t, i) => (
              <p key={i} className="swish">📲 {t.from} swishar <strong>{kr(t.amount)}</strong> till {t.to} varje månad</p>
            ))}
        </div>
      )}
    </section>
  )
}
