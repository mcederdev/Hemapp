import { useState } from 'react'
import { useTable } from '../useTable'
import { today, prettyDay } from '../lib/dates'
import { daysUntil } from '../lib/yearly'
import { MemberTag } from './MemberPicker'
import Sheet, { Fab } from './Sheet'

const kr = (n) => Math.round(n).toLocaleString('sv-SE') + ' kr'
const blank = (paidBy) => ({ name: '', amount: '', period: 'month', renews_on: '', cancel_by: '', paid_by: paidBy, note: '' })
export const SUB_SUGGESTIONS = ['Netflix', 'Spotify', 'Disney+', 'HBO Max', 'Viaplay', 'YouTube Premium', 'iCloud', 'Storytel', 'Gym', 'Mobil', 'Bredband', 'Tidning']

// Abonnemang: vad familjen betalar för varje månad, och när något ska sägas upp
export default function Subscriptions({ householdId, members }) {
  const subs = useTable('subscriptions', householdId, 'name')
  const [edit, setEdit] = useState(null)
  const parents = members.filter((m) => m.role === 'parent' && m.household_id === householdId)
  const byId = Object.fromEntries(members.map((m) => [m.id, m]))
  const t = today()
  const monthly = (s) => (s.period === 'year' ? Number(s.amount) / 12 : Number(s.amount))
  const total = subs.rows.reduce((a, s) => a + monthly(s), 0)

  const save = async (e) => {
    e.preventDefault()
    if (!edit.name.trim()) return
    const v = { name: edit.name.trim(), amount: Number(String(edit.amount).replace(',', '.')) || 0, period: edit.period, renews_on: edit.renews_on || null, cancel_by: edit.cancel_by || null, paid_by: edit.paid_by || null, note: edit.note || null }
    if (edit.id) await subs.update(edit.id, v); else await subs.insert(v)
    setEdit(null)
  }

  return (
    <div>
      <div className="stat-tiles">
        <div className="stat-tile"><strong>{kr(total)}</strong><span>i månaden</span></div>
        <div className="stat-tile"><strong>{kr(total * 12)}</strong><span>om året</span></div>
        <div className="stat-tile"><strong>{subs.rows.length}</strong><span>abonnemang</span></div>
      </div>
      {subs.rows.length === 0 && <p className="muted mt">Lägg in era abonnemang med +. Sätt ett datum för uppsägning så påminner appen i tid, t.ex. när en provperiod går ut.</p>}
      <ul className="list mt">
        {[...subs.rows].sort((a, b) => monthly(b) - monthly(a)).map((s) => {
          const cancel = s.cancel_by ? daysUntil(t, s.cancel_by) : null
          return (
            <li key={s.id} className="tap" onClick={() => setEdit({ ...s, amount: String(s.amount), renews_on: s.renews_on || '', cancel_by: s.cancel_by || '', note: s.note || '' })}>
              <span className="grow">
                <strong>{s.name}</strong>
                <div className={`small ${cancel !== null && cancel <= 7 ? 'error' : 'muted'}`}>
                  {cancel !== null ? (cancel < 0 ? `Skulle sägas upp ${prettyDay(s.cancel_by)}` : `Säg upp senast ${prettyDay(s.cancel_by)}`) : s.renews_on ? `Förnyas ${prettyDay(s.renews_on)}` : s.period === 'year' ? 'Per år' : 'Per månad'}
                  {s.note ? ` · ${s.note}` : ''}
                </div>
              </span>
              <span className="row">{byId[s.paid_by] && <MemberTag member={byId[s.paid_by]} size={22} />}<strong>{kr(s.amount)}</strong>{s.period === 'year' && <span className="muted small">/år</span>}</span>
            </li>
          )
        })}
      </ul>
      <Fab onClick={() => setEdit(blank(parents[0]?.id))} label="Nytt abonnemang" />
      {edit && (
        <Sheet title={edit.id ? edit.name : 'Nytt abonnemang'} onClose={() => setEdit(null)}>
          <form className="stack" onSubmit={save}>
            <input placeholder="Namn" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus={!edit.id} list="sub-sugg" />
            <datalist id="sub-sugg">{SUB_SUGGESTIONS.map((x) => <option key={x} value={x} />)}</datalist>
            <div className="row">
              <label className="field"><span className="muted small">Kostar</span><input inputMode="decimal" placeholder="kr" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></label>
              <label className="field"><span className="muted small">Per</span>
                <select value={edit.period} onChange={(e) => setEdit({ ...edit, period: e.target.value })}><option value="month">månad</option><option value="year">år</option></select></label>
            </div>
            {parents.length > 1 && (
              <label className="field"><span className="muted small">Betalas av</span>
                <select value={edit.paid_by || ''} onChange={(e) => setEdit({ ...edit, paid_by: e.target.value || null })}>
                  <option value="">Gemensamt</option>{parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></label>
            )}
            <div className="row">
              <label className="field"><span className="muted small">Förnyas (valfritt)</span><input type="date" value={edit.renews_on} onChange={(e) => setEdit({ ...edit, renews_on: e.target.value })} /></label>
              <label className="field"><span className="muted small">Säg upp senast</span><input type="date" value={edit.cancel_by} onChange={(e) => setEdit({ ...edit, cancel_by: e.target.value })} /></label>
            </div>
            <input placeholder="Anteckning (t.ex. provperiod, delas med mormor)" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
            <button className="primary">Spara</button>
            {edit.id && <button type="button" className="danger" onClick={() => { if (confirm(`Ta bort ${edit.name}?`)) { subs.remove(edit.id); setEdit(null) } }}>Ta bort</button>}
          </form>
        </Sheet>
      )}
    </div>
  )
}
