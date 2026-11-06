import { useState } from 'react'
import { useTable } from '../useTable'
import { splitBills } from '../lib/finance'
import { swishUrl } from '../lib/swish'
import { monthStart, addMonths, monthName, today } from '../lib/dates'
import MemberPicker from './MemberPicker'
import SwipeRow from './Swipe'
import Sheet, { Fab } from './Sheet'
import Subscriptions from './Subscriptions'
import Overtime from './Overtime'

const kr = (n) => Math.round(n).toLocaleString('sv-SE') + ' kr'

export default function Finance(props) {
  const [view, setView] = useState(() => { try { return localStorage.getItem('financeView') || 'bills' } catch { return 'bills' } })
  const pick = (v) => { setView(v); try { localStorage.setItem('financeView', v) } catch { /* */ } }
  return (
    <>
      <div className="seg mb fin-seg">
        <button className={view === 'bills' ? 'active' : ''} onClick={() => pick('bills')}>Räkningar</button>
        <button className={view === 'subs' ? 'active' : ''} onClick={() => pick('subs')}>Abonnemang</button>
        {props.me?.role !== 'child' && <button className={view === 'overtime' ? 'active' : ''} onClick={() => pick('overtime')}>Övertid</button>}
      </div>
      {view === 'bills' && <Bills {...props} />}
      {view === 'subs' && <section><h2>Abonnemang</h2><Subscriptions householdId={props.householdId} members={props.members} household={props.household} households={props.households} /></section>}
      {view === 'overtime' && <Overtime householdId={props.householdId} me={props.me} />}
    </>
  )
}

function Bills({ householdId, members, membersTable, go }) {
  const bills = useTable('bills', householdId)
  const settlements = useTable('settlements', householdId, 'month')
  const parents = members.filter((m) => m.role === 'parent')
  const [month, setMonth] = useState(monthStart(today()))
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState(null)
  const [kind, setKind] = useState('fixed')
  const [adding, setAdding] = useState(false)

  const monthBills = bills.rows.filter((b) => b.kind === 'fixed' || b.month === month)
  const fixed = monthBills.filter((b) => b.kind === 'fixed')
  const once = monthBills.filter((b) => b.kind === 'once')
  const result = splitBills(
    parents.map((p) => ({ id: p.id, name: p.name, income: p.monthly_income })),
    monthBills.map((b) => ({ amount: b.amount, paidBy: b.paid_by }))
  )
  const byId = Object.fromEntries(members.map((m) => [m.id, m]))
  const byName = Object.fromEntries(parents.map((m) => [m.name, m]))
  const settled = settlements.rows.find((s) => s.month === month)
  const history = [...settlements.rows].sort((a, b) => b.month.localeCompare(a.month))

  const add = (e) => {
    e.preventDefault()
    if (!name.trim() || !amount) return
    bills.insert({ name: name.trim(), amount: Number(amount), paid_by: paidBy || parents[0]?.id, kind, month: kind === 'once' ? month : null })
    setName(''); setAmount(''); setAdding(false)
  }
  const markPaid = async (t) => {
    const row = { month, from_member: byName[t.from]?.id, to_member: byName[t.to]?.id, amount: t.amount, total_bills: result.totalBills, paid: true, paid_at: new Date().toISOString() }
    if (settled) await settlements.update(settled.id, row)
    else await settlements.insert(row)
  }

  return (
    <section>
      <div className="row between">
        <button onClick={() => setMonth(addMonths(month, -1))} aria-label="Förra månaden">‹</button>
        <h2 className="cap center-text">{monthName(month)}</h2>
        <button onClick={() => setMonth(addMonths(month, 1))} aria-label="Nästa månad">›</button>
      </div>

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
        <h3>Räkningar</h3>
        <Fab onClick={() => setAdding(true)} label="Ny räkning" />
        {adding && (
        <Sheet title="Ny räkning" onClose={() => setAdding(false)}>
        <form className="stack" onSubmit={add}>
          <div className="seg">
            <button type="button" className={kind === 'fixed' ? 'active' : ''} onClick={() => setKind('fixed')}>Fast varje månad</button>
            <button type="button" className={kind === 'once' ? 'active' : ''} onClick={() => setKind('once')}>Bara {monthName(month).split(' ')[0]}</button>
          </div>
          <div className="row">
            <input placeholder={kind === 'fixed' ? 'T.ex. Hyra, el, försäkring' : 'T.ex. Tandläkare, bilreparation'} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <input type="number" inputMode="numeric" placeholder="Belopp" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ maxWidth: 110 }} />
          </div>
          <div className="row">
            <span className="muted nowrap">Betalas av</span>
            <MemberPicker members={parents} value={paidBy || parents[0]?.id} onChange={setPaidBy} emptyLabel="Välj" />
          </div>
          <button className="primary">Spara</button>
        </form>
        </Sheet>
        )}
        {monthBills.length === 0 && <p className="muted">Inga räkningar än. Tryck på + för att lägga till.</p>}
        <BillList title="Fasta" rows={fixed} byId={byId} onRemove={(id) => bills.remove(id)} />
        <BillList title="Bara denna månad" rows={once} byId={byId} onRemove={(id) => bills.remove(id)} />
        <div className="row between"><strong>Totalt</strong><strong>{kr(result.totalBills)}</strong></div>
      </div>

      {result.totalBills > 0 && parents.length > 0 && (
        <div className="card stack">
          <h3>Fördelning</h3>
          {result.rows.map((r) => (
            <div key={r.id}>
              <strong>{r.name} ({Math.round(r.share * 100)} %)</strong>
              <div className="muted small">Ska stå för {kr(r.shouldPay)}, betalar själv {kr(r.paid)}</div>
            </div>
          ))}
          {result.transfers.length === 0
            ? <p className="swish">Ni är kvitt, ingen behöver swisha.</p>
            : result.transfers.map((t, i) => {
              const to = byName[t.to]
              return (
                <div key={i} className="swish stack">
                  <span>{t.from} swishar <strong>{kr(t.amount)}</strong> till {t.to}</span>
                  {settled?.paid
                    ? <span className="ok">✓ Swishat {new Date(settled.paid_at).toLocaleDateString('sv-SE')}</span>
                    : (
                      <div className="row wrap">
                        {to?.phone
                          ? <a className="button primary" href={swishUrl(to.phone, t.amount, `Räkningar ${monthName(month)}`)}>Öppna Swish</a>
                          : <button className="link" onClick={() => go('family')}>Lägg in {t.to}s mobilnummer för Swish-knapp</button>}
                        <button onClick={() => markPaid(t)}>Markera som swishat</button>
                      </div>
                    )}
                </div>
              )
            })}
        </div>
      )}

      {history.length > 0 && (
        <>
          <h3>Historik</h3>
          <ul className="list">
            {history.map((s) => (
              <li key={s.id} className="tap" onClick={() => setMonth(s.month)}>
                <span className="cap">{monthName(s.month)}<div className="muted small">Räkningar {kr(s.total_bills)}</div></span>
                <span className="small">{byId[s.from_member]?.name} → {byId[s.to_member]?.name}: <strong>{kr(s.amount)}</strong> {s.paid && '✓'}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function BillList({ title, rows, byId, onRemove }) {
  if (!rows.length) return null
  return (
    <>
      <h4 className="day">{title}</h4>
      <ul className="list">
        {rows.map((b) => (
          <SwipeRow key={b.id} onDelete={() => confirm(`Ta bort ${b.name}?`) && onRemove(b.id)}>
            <span>{b.name}<span className="muted small"> · {byId[b.paid_by]?.name || '?'} betalar</span></span>
            <span className="meta">
              <strong>{kr(b.amount)}</strong>
              <button className="icon-btn del" onClick={() => confirm(`Ta bort ${b.name}?`) && onRemove(b.id)} aria-label="Ta bort">✕</button>
            </span>
          </SwipeRow>
        ))}
      </ul>
    </>
  )
}
