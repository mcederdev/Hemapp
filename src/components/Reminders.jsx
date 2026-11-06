import { useState } from 'react'
import { useTable } from '../useTable'
import { today, prettyDay } from '../lib/dates'
import { nextBirthday, advance, daysUntil, REMINDER_SUGGESTIONS } from '../lib/yearly'
import Sheet, { Fab } from './Sheet'
import { pickSub, shows } from '../lib/menu'

const when = (n) => (n === 0 ? 'idag' : n === 1 ? 'imorgon' : n < 0 ? `${-n} dagar sen` : `om ${n} dagar`)

export default function Reminders({ householdId }) {
  const [rawView, setView] = useState('reminders')
  const view = pickSub('reminders', rawView, [])
  return (
    <section>
      <h2>Påminnelser</h2>
      <div className="seg mb">
        {shows('reminders.reminders') && <button className={view === 'reminders' ? 'active' : ''} onClick={() => setView('reminders')}>Årliga saker</button>}
        {shows('reminders.birthdays') && <button className={view === 'birthdays' ? 'active' : ''} onClick={() => setView('birthdays')}>Födelsedagar</button>}
      </div>
      {view === 'reminders' ? <YearlyList householdId={householdId} /> : <Birthdays householdId={householdId} />}
    </section>
  )
}

// Årliga saker. Med carId visas bilens påminnelser (på bilsidan) i stället.
export function YearlyList({ householdId, carId = null, suggestionList = REMINDER_SUGGESTIONS, placeholder = 'T.ex. Tandläkare' }) {
  const rows = useTable('reminders', householdId, 'due_date', carId ? ['car_id', carId] : null)
  const [edit, setEdit] = useState(null)
  const t = today()
  const mine = rows.rows.filter((r) => (carId ? r.car_id === carId : !r.car_id))
  const list = [...mine].sort((a, b) => a.due_date.localeCompare(b.due_date))
  const existing = new Set(mine.map((r) => r.title.toLowerCase()))
  const suggestions = suggestionList.filter((s) => !existing.has(s.title.toLowerCase()))
  const done = (r) => {
    if (r.repeat_months > 0) rows.update(r.id, { due_date: advance(r.due_date, r.repeat_months), notified_for: null, notified_by: {} })
    else if (confirm(`Ta bort "${r.title}"?`)) rows.remove(r.id)
  }
  const fromSuggestion = (s) => {
    let due = s.md ? `${t.slice(0, 4)}-${s.md}` : ''
    if (due && due < t) due = `${+t.slice(0, 4) + 1}-${s.md}`
    setEdit({ title: s.title, emoji: s.emoji, repeat_months: s.months, due_date: due, remind_days: 14, note: '' })
  }
  const save = async (e) => {
    e.preventDefault()
    if (!edit.title.trim() || !edit.due_date) return
    const v = { title: edit.title.trim(), emoji: edit.emoji || '🔔', due_date: edit.due_date, repeat_months: Number(edit.repeat_months) || 0, remind_days: Number(edit.remind_days) || 0, note: edit.note || null }
    if (edit.id) await rows.update(edit.id, edit.due_date === edit.orig ? v : { ...v, notified_for: null, notified_by: {} })
    else await rows.insert({ ...v, household_id: householdId, car_id: carId })
    setEdit(null)
  }

  return (
    <>
      {list.length === 0 && <p className="muted">Inga påminnelser än. Välj bland förslagen nedan eller tryck på +.</p>}
      <ul className="list">
        {list.map((r) => {
          const n = daysUntil(t, r.due_date)
          return (
            <li key={r.id}>
              <span className="tap grow row" onClick={() => setEdit({ ...r, orig: r.due_date })}>
                <span className="big-emoji">{r.emoji}</span>
                <span>{r.title}<div className={`small ${n < 0 ? 'error' : n <= r.remind_days ? 'warn' : 'muted'}`}>{prettyDay(r.due_date)} · {when(n)}{r.repeat_months ? ` · var ${r.repeat_months === 12 ? 'år' : `${r.repeat_months}:e månad`}` : ''}</div>
                  {r.note && <div className="muted small">{r.note}</div>}</span>
              </span>
              <button className="chip" onClick={() => done(r)}>✓ Klar</button>
            </li>
          )
        })}
      </ul>
      {suggestions.length > 0 && (
        <>
          <p className="muted small">Förslag:</p>
          <div className="chips">{suggestions.map((s) => <button key={s.title} className="chip" onClick={() => fromSuggestion(s)}>{s.emoji} {s.title}</button>)}</div>
        </>
      )}
      <p className="muted small mt">Ni får en notis när det är så många dagar kvar som du har valt. "Klar" flyttar påminnelsen till nästa gång.</p>
      {carId
        ? <button className="mt" onClick={() => setEdit({ title: '', emoji: '🚗', due_date: '', repeat_months: 12, remind_days: 14, note: '' })}>+ Ny påminnelse för bilen</button>
        : <Fab onClick={() => setEdit({ title: '', emoji: '🔔', due_date: '', repeat_months: 12, remind_days: 14, note: '' })} label="Ny påminnelse" />}
      {edit && (
        <Sheet title={edit.id ? 'Ändra påminnelse' : 'Ny påminnelse'} onClose={() => setEdit(null)}>
          <form className="stack" onSubmit={save}>
            <div className="row">
              <input value={edit.emoji} onChange={(e) => setEdit({ ...edit, emoji: e.target.value })} style={{ maxWidth: 60, textAlign: 'center' }} aria-label="Symbol" />
              <input placeholder={placeholder} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} autoFocus={!edit.id} />
            </div>
            <div className="row">
              <label className="field"><span className="muted small">Datum</span><input type="date" value={edit.due_date} onChange={(e) => setEdit({ ...edit, due_date: e.target.value })} required /></label>
              <label className="field"><span className="muted small">Upprepa</span>
                <select value={edit.repeat_months} onChange={(e) => setEdit({ ...edit, repeat_months: e.target.value })}>
                  <option value={0}>En gång</option><option value={1}>Varje månad</option><option value={3}>Var 3:e månad</option><option value={6}>Varje halvår</option><option value={12}>Varje år</option><option value={24}>Vartannat år</option>
                </select></label>
            </div>
            <label className="field"><span className="muted small">Påminn</span>
              <select value={edit.remind_days} onChange={(e) => setEdit({ ...edit, remind_days: e.target.value })}>
                {[0, 1, 3, 7, 14, 30, 60].map((d) => <option key={d} value={d}>{d === 0 ? 'Samma dag' : `${d} dagar innan`}</option>)}
              </select></label>
            <input placeholder="Anteckning (t.ex. bokningsnummer)" value={edit.note || ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
            <button className="primary">Spara</button>
            {edit.id && <button type="button" className="danger" onClick={() => { rows.remove(edit.id); setEdit(null) }}>Ta bort</button>}
          </form>
        </Sheet>
      )}
    </>
  )
}

function Birthdays({ householdId }) {
  const rows = useTable('birthdays', householdId)
  const [edit, setEdit] = useState(null)
  const t = today()
  const list = rows.rows.map((b) => ({ ...b, next: nextBirthday(b.day, t) })).sort((a, b) => a.next.daysLeft - b.next.daysLeft)
  const save = async (e) => {
    e.preventDefault()
    if (!edit.name.trim() || !edit.day) return
    const v = { name: edit.name.trim(), day: edit.day, year_known: !!edit.year_known, gift_ideas: edit.gift_ideas || null, remind_days: Number(edit.remind_days) || 0 }
    if (edit.id) await rows.update(edit.id, v)
    else await rows.insert(v)
    setEdit(null)
  }
  return (
    <>
      {list.length === 0 && <p className="muted">Lägg till födelsedagar med +, till exempel mor- och farföräldrar, kompisar och kusiner.</p>}
      <ul className="list">
        {list.map((b) => (
          <li key={b.id} className="tap" onClick={() => setEdit(b)}>
            <span className="row grow">
              <span className="big-emoji">{b.next.daysLeft === 0 ? '🎉' : '🎂'}</span>
              <span>{b.name}{b.year_known && <span className="muted"> fyller {b.next.age}</span>}
                <div className={`small ${b.next.daysLeft <= b.remind_days ? 'warn' : 'muted'}`}>{prettyDay(b.next.date)} · {when(b.next.daysLeft)}</div>
                {b.gift_ideas && <div className="muted small">🎁 {b.gift_ideas}</div>}</span>
            </span>
          </li>
        ))}
      </ul>
      <Fab onClick={() => setEdit({ name: '', day: '', year_known: true, gift_ideas: '', remind_days: 14 })} label="Ny födelsedag" />
      {edit && (
        <Sheet title={edit.id ? edit.name : 'Ny födelsedag'} onClose={() => setEdit(null)}>
          <form className="stack" onSubmit={save}>
            <input placeholder="Namn" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus={!edit.id} />
            <label className="field"><span className="muted small">Födelsedag</span><input type="date" value={edit.day} onChange={(e) => setEdit({ ...edit, day: e.target.value })} required /></label>
            <label className="row small"><input type="checkbox" checked={!edit.year_known} onChange={(e) => setEdit({ ...edit, year_known: !e.target.checked })} /> Vet inte vilket år (visa inte ålder)</label>
            <textarea className="ta" placeholder="Presentidéer, önskelista, storlekar …" value={edit.gift_ideas || ''} onChange={(e) => setEdit({ ...edit, gift_ideas: e.target.value })} rows={3} />
            <label className="field"><span className="muted small">Påminn</span>
              <select value={edit.remind_days} onChange={(e) => setEdit({ ...edit, remind_days: e.target.value })}>
                {[0, 3, 7, 14, 21, 30].map((d) => <option key={d} value={d}>{d === 0 ? 'Bara på dagen' : `${d} dagar innan och på dagen`}</option>)}
              </select></label>
            <button className="primary">Spara</button>
            {edit.id && <button type="button" className="danger" onClick={() => { rows.remove(edit.id); setEdit(null) }}>Ta bort</button>}
          </form>
        </Sheet>
      )}
    </>
  )
}
