import { useState } from 'react'
import { useTable } from '../useTable'
import { today, prettyDay } from '../lib/dates'
import { medicineStatus } from '../lib/medicine'
import { MemberTag } from './MemberPicker'
import Sheet, { Fab } from './Sheet'

const blank = (memberId) => ({ name: '', member_id: memberId, unit: 'ml', full_size: 100, dose: 5, doses_per_day: 1, remind_days: 5, opened_on: today(), note: '' })

// Medicin: flaskans storlek och dosen ger hur länge den räcker. "Ny flaska" nollställer.
export default function Medicines({ householdId, members }) {
  const meds = useTable('medicines', householdId)
  const [edit, setEdit] = useState(null)
  const t = today()
  const byId = Object.fromEntries(members.map((m) => [m.id, m]))
  const kidsFirst = [...members].sort((a, b) => Number(b.role === 'child') - Number(a.role === 'child'))

  const save = async (e) => {
    e.preventDefault()
    if (!edit.name.trim()) return
    const full = Number(String(edit.full_size).replace(',', '.')) || 0
    const v = { name: edit.name.trim(), member_id: edit.member_id, unit: edit.unit, full_size: full, dose: Number(String(edit.dose).replace(',', '.')) || 0,
      doses_per_day: Number(String(edit.doses_per_day).replace(',', '.')) || 0, remind_days: Number(edit.remind_days) || 0, note: edit.note || null }
    if (edit.id) await meds.update(edit.id, v)
    else await meds.insert({ ...v, bottle_size: full, opened_on: edit.opened_on || t })
    setEdit(null)
  }
  const newBottle = (m) => confirm(`Öppna en ny flaska ${m.name} (${m.full_size || m.bottle_size} ${m.unit})?`) &&
    meds.update(m.id, { bottle_size: m.full_size || m.bottle_size, opened_on: t, notified_for: null, notified_by: {} })
  const adjust = (m) => {
    const v = prompt(`Hur mycket finns kvar i flaskan nu (${m.unit})?`, String(medicineStatus(m, t).left))
    if (v === null) return
    const n = Number(v.replace(',', '.'))
    if (Number.isFinite(n)) meds.update(m.id, { bottle_size: n, opened_on: t, notified_for: null, notified_by: {} })
  }

  return (
    <section>
      <h2>Medicin</h2>
      {meds.rows.length === 0 && <p className="muted">Lägg till en medicin med +. Appen räknar ut när flaskan tar slut och påminner i tid.</p>}
      <ul className="list">
        {meds.rows.map((m) => {
          const s = medicineStatus(m, t)
          const low = s.daysLeft <= m.remind_days
          return (
            <li key={m.id} className="col med">
              <div className="row between w100">
                <span className="row tap grow" onClick={() => setEdit({ ...m, full_size: m.full_size || m.bottle_size })}>
                  <span className="big-emoji">💊</span>
                  <span><strong>{m.name}</strong> <MemberTag member={byId[m.member_id]} size={20} />
                    <div className="muted small">{fmtN(m.dose)} {m.unit} × {fmtN(m.doses_per_day)} om dagen{m.note ? ` · ${m.note}` : ''}</div></span>
                </span>
              </div>
              <div className="med-bar"><i style={{ width: `${Math.round(s.share * 100)}%`, background: low ? 'var(--danger)' : 'var(--accent)' }} /></div>
              <div className="row between w100">
                <span className={`small ${low ? 'error' : 'muted'}`}>
                  {s.left <= 0 ? 'Slut!' : `Kvar ca ${fmtN(s.left)} ${m.unit} · räcker ${s.daysLeft === 0 ? 'idag ut' : `${s.daysLeft} dagar till`}`}
                  {s.runsOut && s.left > 0 && ` (${prettyDay(s.runsOut)})`}
                </span>
                <span className="row">
                  <button className="chip" onClick={() => adjust(m)}>Justera</button>
                  <button className="chip on" onClick={() => newBottle(m)}>Ny flaska</button>
                </span>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="muted small mt">Ni får en notis när det är så många dagar kvar som ni valt. Delas med andra hushållet om barnet har delad vårdnad.</p>
      <Fab onClick={() => setEdit(blank(members.find((m) => m.role === 'child')?.id || members[0]?.id))} label="Ny medicin" />
      {edit && (
        <Sheet title={edit.id ? edit.name : 'Ny medicin'} onClose={() => setEdit(null)}>
          <form className="stack" onSubmit={save}>
            <input placeholder="Namn (t.ex. Concerta, Desloratadin)" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus={!edit.id} />
            <label className="field"><span className="muted small">Till</span>
              <select value={edit.member_id} onChange={(e) => setEdit({ ...edit, member_id: e.target.value })}>
                {kidsFirst.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select></label>
            <div className="row">
              <label className="field"><span className="muted small">Flaskan/förpackningen</span><input inputMode="decimal" value={edit.full_size} onChange={(e) => setEdit({ ...edit, full_size: e.target.value })} /></label>
              <label className="field"><span className="muted small">Enhet</span>
                <select value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })}>
                  <option value="ml">ml</option><option value="st">tabletter</option><option value="doser">doser</option>
                </select></label>
            </div>
            <div className="row">
              <label className="field"><span className="muted small">Dos ({edit.unit})</span><input inputMode="decimal" value={edit.dose} onChange={(e) => setEdit({ ...edit, dose: e.target.value })} /></label>
              <label className="field"><span className="muted small">Gånger om dagen</span><input inputMode="decimal" value={edit.doses_per_day} onChange={(e) => setEdit({ ...edit, doses_per_day: e.target.value })} /></label>
            </div>
            {!edit.id && <label className="field"><span className="muted small">Flaskan öppnades</span><input type="date" value={edit.opened_on} max={today()} onChange={(e) => setEdit({ ...edit, opened_on: e.target.value })} /></label>}
            <label className="field"><span className="muted small">Påminn</span>
              <select value={edit.remind_days} onChange={(e) => setEdit({ ...edit, remind_days: e.target.value })}>
                {[2, 3, 5, 7, 10, 14].map((d) => <option key={d} value={d}>{d} dagar innan den tar slut</option>)}
              </select></label>
            <input placeholder="Anteckning (t.ex. tas med frukost, recept hos BVC)" value={edit.note || ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
            <button className="primary">Spara</button>
            {edit.id && <button type="button" className="danger" onClick={() => { if (confirm(`Ta bort ${edit.name}?`)) { meds.remove(edit.id); setEdit(null) } }}>Ta bort</button>}
          </form>
        </Sheet>
      )}
    </section>
  )
}

const fmtN = (n) => String(Math.round(Number(n) * 10) / 10).replace('.', ',')

// Medicin som snart tar slut, för "Snart" på Idag och köksskärmen
export function lowMedicines(rows, t = today()) {
  return rows.map((m) => ({ m, s: medicineStatus(m, t) })).filter(({ m, s }) => s.daysLeft <= m.remind_days)
}
