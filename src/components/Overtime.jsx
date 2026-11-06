import { useState } from 'react'
import { supabase } from '../supabase'
import { useTable } from '../useTable'
import { today, prettyDay } from '../lib/dates'
import { splitOvertime, overtimePay, rates, fmtH, reportDay } from '../lib/overtime'
import Sheet from './Sheet'

const kr = (n) => Math.round(n).toLocaleString('sv-SE') + ' kr'
const krx = (n) => n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr'
const hm = (iso) => new Date(iso).toTimeString().slice(0, 5)
const minOf = (s) => (s?.min_minutes ?? 15)
const split = (r, s) => splitOvertime(new Date(r.starts_at), new Date(r.ends_at), { freeDay: r.free_day, minMinutes: minOf(s) })
// Från- och tilltid samma dag, tilltid före fråntid = över midnatt
export function toRange(day, from, to) {
  const s = new Date(`${day}T${from}`), e = new Date(`${day}T${to}`)
  if (e <= s) e.setDate(e.getDate() + 1)
  return [s, e]
}
export function useOvertimeSettings(householdId, me) {
  const t = useTable('overtime_settings', householdId)
  const s = t.rows.find((r) => r.member_id === me.id)
  const save = async (v) => { const { error } = await supabase.from('overtime_settings').upsert({ member_id: me.id, household_id: householdId, ...v }); if (error) alert(error.message); t.reload() }
  return { s, save }
}

// Ekonomi → Övertid: allt som ska rapporteras, kalkylator och lön. Syns bara för den inloggade.
export default function Overtime({ householdId, me }) {
  const ot = useTable('overtime', householdId, 'starts_at')
  const { s, save } = useOvertimeSettings(householdId, me)
  const [salary, setSalary] = useState('')
  const [editSalary, setEditSalary] = useState(false)
  const [form, setForm] = useState(null)
  const [showOld, setShowOld] = useState(false)
  const t = today()
  const mine = ot.rows.filter((r) => r.member_id === me.id)
  const open = mine.filter((r) => !r.reported_at).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const done = mine.filter((r) => r.reported_at).sort((a, b) => b.starts_at.localeCompare(a.starts_at))
  const sum = (list) => list.reduce((a, r) => { const x = split(r, s); return { day: a.day + x.day, other: a.other + x.other, pay: a.pay + overtimePay(x, s) } }, { day: 0, other: 0, pay: 0 })
  const tot = sum(open)
  const r = rates(s)
  const report = async () => {
    if (!confirm('Har du lagt in övertiden i arbetsgivarens system?')) return
    const at = new Date().toISOString()
    for (const x of open) await ot.update(x.id, { reported_at: at })
  }
  const saveForm = async (e) => {
    e.preventDefault()
    const [st, en] = toRange(form.day, form.from, form.to)
    const v = { member_id: me.id, day: form.day, starts_at: st.toISOString(), ends_at: en.toISOString(), free_day: form.free, note: form.note || null }
    if (form.id) await ot.update(form.id, v); else await ot.insert(v)
    setForm(null)
  }
  const preview = form?.from && form?.to ? (() => { const [st, en] = toRange(form.day, form.from, form.to); return splitOvertime(st, en, { freeDay: form.free, minMinutes: minOf(s) }) })() : null
  const rd = reportDay(t)

  if (!s?.salary || editSalary) {
    return (
      <section>
        <h2>Övertid</h2>
        <form className="card stack" onSubmit={(e) => { e.preventDefault(); const n = Number(String(salary || s?.salary || '').replace(/\D/g, '')); if (n) { save({ salary: n }); setEditSalary(false) } }}>
          <p>Fyll i din fasta kontanta månadslön (uppräknad till heltid). Den syns bara för dig.</p>
          <input inputMode="numeric" placeholder="T.ex. 43 670" defaultValue={s?.salary || ''} onChange={(e) => setSalary(e.target.value)} autoFocus />
          <button className="primary">Spara</button>
        </form>
      </section>
    )
  }
  return (
    <section>
      <h2>Övertid</h2>
      <div className="card stack ot-sum">
        <span className="muted small">Att rapportera{open.length ? ` · ${open.length} pass` : ''}</span>
        <strong className="big-num">{kr(tot.pay)}</strong>
        <span className="small">{fmtH(tot.day + tot.other)}{tot.day ? ` · vardag 06–20 ${fmtH(tot.day)}` : ''}{tot.other ? ` · annan tid ${fmtH(tot.other)}` : ''}</span>
        <span className="muted small">Lägg in den i arbetsgivarens system senast {prettyDay(rd).replace(/\.$/, '')}. Du får en påminnelse den dagen.</span>
        {open.length > 0 && <button className="primary" onClick={report}>✓ Inlagt i arbetsgivarens system</button>}
      </div>
      <ul className="list">
        {open.map((x) => <Row key={x.id} x={x} s={s} onOpen={() => setForm({ id: x.id, day: x.day, from: hm(x.starts_at), to: hm(x.ends_at), free: x.free_day, note: x.note || '' })} />)}
      </ul>
      {open.length === 0 && <p className="muted">Ingen övertid att rapportera. Tryck på ett jobbpass i kalendern och fyll i när du faktiskt slutade, eller lägg till här nedan.</p>}
      <button className="wide" onClick={() => setForm({ day: t, from: '', to: '', free: false, note: '' })}>➕ Lägg till / räkna ut övertid</button>

      <div className="card small mt">
        <div className="row between"><span>Vardag 06–20</span><strong>{krx(r.day)}/h</strong></div>
        <div className="row between"><span>Annan tid, helg, ledig dag, aftnar</span><strong>{krx(r.other)}/h</strong></div>
        <p className="muted small">Lön {kr(s.salary)} / {s.div_day || 94} och / {s.div_other || 72}. Semestertillägg ingår. {minOf(s) ? 'Under 15 minuter i följd ersätts inte.' : 'Även korta stunder under 15 minuter räknas (undantag).'} <button className="link small" onClick={() => setEditSalary(true)}>Ändra lön</button></p>
        <label className="row small"><input type="checkbox" checked={minOf(s) === 0} onChange={(e) => save({ min_minutes: e.target.checked ? 0 : 15 })} /> Undantag: ersätt även under 15 minuter</label>
      </div>

      {done.length > 0 && <button className="link small mt" onClick={() => setShowOld(!showOld)}>{showOld ? 'Dölj rapporterad' : `Visa rapporterad övertid (${done.length})`}</button>}
      {showOld && <ul className="list">{done.map((x) => <Row key={x.id} x={x} s={s} onOpen={() => {}} />)}</ul>}

      {form && (
        <Sheet title={form.id ? 'Ändra övertid' : 'Övertid'} onClose={() => setForm(null)}>
          <form className="stack" onSubmit={saveForm}>
            <label className="field"><span className="muted small">Dag</span><input type="date" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} required /></label>
            <div className="row">
              <label className="field"><span className="muted small">Från</span><input type="time" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} required /></label>
              <label className="field"><span className="muted small">Till</span><input type="time" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} required /></label>
            </div>
            <label className="row small"><input type="checkbox" checked={form.free} onChange={(e) => setForm({ ...form, free: e.target.checked })} /> Det var en arbetsfri dag för mig (räknas som annan tid)</label>
            <input placeholder="Anteckning (valfritt)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            {preview && (
              <div className="card small">
                {preview.short ? <span className="muted">Under {minOf(s)} minuter ersätts inte.</span> : <>
                  {preview.day > 0 && <div className="row between"><span>Vardag 06–20: {fmtH(preview.day)}</span><span>{kr(preview.day / 60 * r.day)}</span></div>}
                  {preview.other > 0 && <div className="row between"><span>Annan tid: {fmtH(preview.other)}</span><span>{kr(preview.other / 60 * r.other)}</span></div>}
                  <div className="row between"><strong>Totalt {fmtH(preview.total)}</strong><strong>{kr(overtimePay(preview, s))}</strong></div>
                </>}
              </div>
            )}
            <button className="primary">Spara</button>
            {form.id && <button type="button" className="danger" onClick={() => { ot.remove(form.id); setForm(null) }}>Ta bort</button>}
          </form>
        </Sheet>
      )}
    </section>
  )
}

function Row({ x, s, onOpen }) {
  const sp = split(x, s)
  return (
    <li className="tap" onClick={onOpen}>
      <span>{prettyDay(x.day)} · {hm(x.starts_at)}–{hm(x.ends_at)}
        <div className="muted small">{fmtH(sp.total)}{sp.other && sp.day ? ` (${fmtH(sp.other)} annan tid)` : sp.other ? ' · annan tid' : ''}{x.note ? ` · ${x.note}` : ''}{x.reported_at ? ' · ✓ rapporterad' : ''}</div></span>
      <strong>{kr(overtimePay(sp, s))}</strong>
    </li>
  )
}

// I kalendern: tryck på ett jobbpass och fyll i när du faktiskt slutade
export function EventOvertime({ occ, householdId, me }) {
  const ot = useTable('overtime', householdId, 'starts_at')
  const { s } = useOvertimeSettings(householdId, me)
  const planned = occ.end || occ.start
  const dayStr = `${occ.start.getFullYear()}-${String(occ.start.getMonth() + 1).padStart(2, '0')}-${String(occ.start.getDate()).padStart(2, '0')}`
  const row = ot.rows.find((r) => r.event_id === occ.id && r.day === dayStr)
  const [end, setEnd] = useState(row ? hm(row.ends_at) : '')
  const range = end ? (() => { const e = new Date(planned); const [h, m] = end.split(':').map(Number); e.setHours(h, m, 0, 0); if (e < planned && (planned - e) > 12 * 3600000) e.setDate(e.getDate() + 1); return e })() : null
  const sp = range && range > planned ? splitOvertime(planned, range, { minMinutes: minOf(s) }) : null
  const save = async () => {
    if (!sp || sp.short) { if (row) await ot.remove(row.id); return }
    const v = { member_id: me.id, day: dayStr, starts_at: planned.toISOString(), ends_at: range.toISOString(), event_id: occ.id }
    if (row) await ot.update(row.id, v); else await ot.insert(v)
  }
  return (
    <div className="card stack ot-event">
      <strong>⏱️ Övertid</strong>
      <div className="row">
        <span className="muted small grow">Planerat slut {hm(planned.toISOString())}. Faktiskt slut:</span>
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={{ maxWidth: 120 }} />
      </div>
      {sp && <span className="small">{sp.short ? `Under ${minOf(s)} minuter ersätts inte.` : `${fmtH(sp.total)} övertid${s?.salary ? ` ≈ ${kr(overtimePay(sp, s))}` : ''}`}</span>}
      {end && <button className="primary" onClick={save}>{row ? 'Uppdatera övertid' : 'Spara övertid'}</button>}
      {row && <span className="muted small">✓ Sparad{row.reported_at ? ' och rapporterad' : ', samlas under Ekonomi → Övertid'}</span>}
    </div>
  )
}
