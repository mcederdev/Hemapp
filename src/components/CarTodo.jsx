import { useState } from 'react'
import { useTable } from '../useTable'
import { today, prettyDay, repeatLabel } from '../lib/dates'
import { completeChore } from './Chores'
import { INSPECT_RE } from '../lib/car'
import { MemberTag } from './MemberPicker'
import Sheet, { Fab } from './Sheet'
import SwipeRow, { Check } from './Swipe'

// Bilens sysslor: tvätt, dammsugning och sånt som ska bokas (service, besiktning, däckbyte).
// De ligger i sysslor med car_id och syns i båda hushållen som delar bilen.
const QUICK = [
  { title: 'Tvätta bilen', emoji: '🧽', repeat: '2-week' },
  { title: 'Dammsuga bilen', emoji: '🧹', repeat: '2-week' },
  { title: 'Boka service', emoji: '🔧', book: true },
  { title: 'Boka besiktning', emoji: '🔍', book: true },
  { title: 'Byta till vinterdäck', emoji: '❄️', book: true },
  { title: 'Byta till sommardäck', emoji: '☀️', book: true },
  { title: 'Fylla spolarvätska', emoji: '💧' },
  { title: 'Bilförsäkringen förnyas', emoji: '🛡️', repeat: '12-month' }
]
const REPEATS = [['', 'Upprepa inte'], ['1-week', 'Varje vecka'], ['2-week', 'Varannan vecka (≈ 2 ggr/mån)'], ['1-month', 'Varje månad'], ['3-month', 'Var 3:e månad'], ['6-month', 'Varje halvår'], ['12-month', 'Varje år']]
const emojiOf = (title) => QUICK.find((q) => q.title === title)?.emoji || (/^besikt/i.test(title) ? '✅' : /skatt/i.test(title) ? '🏛️' : '🚗')
const hm = (iso) => new Date(iso).toTimeString().slice(0, 5)
const localDT = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }

export default function CarTodo({ car, householdId, me, people, otherName, onInspected }) {
  const chores = useTable('chores', householdId)
  const [form, setForm] = useState(null)
  const t = today()
  const byId = Object.fromEntries((people || []).map((m) => [m.id, m]))
  const mine = chores.rows.filter((c) => c.car_id === car.id)
  const open = mine.filter((c) => !c.done).sort((a, b) => (a.booked_at || a.due_date || '9').localeCompare(b.booked_at || b.due_date || '9'))
  const done = mine.filter((c) => c.done).sort((a, b) => (b.done_at || '').localeCompare(a.done_at || '')).slice(0, 8)
  const adults = (people || []).filter((m) => m.role !== 'child' && m.role !== 'guest')

  const start = (q = {}) => setForm({ title: q.title || '', repeat: q.repeat || '', due: '', booked: '', who: null })
  const edit = (c) => setForm({ id: c.id, title: c.title, repeat: c.repeat_unit ? `${c.repeat_every || 1}-${c.repeat_unit}` : '', due: c.due_date || '', booked: localDT(c.booked_at), who: c.assigned_to })
  const save = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    const [every, unit] = form.repeat ? form.repeat.split('-') : [null, null]
    const booked = form.booked ? new Date(form.booked).toISOString() : null
    const v = { title: form.title.trim(), car_id: car.id, shared: true, assigned_to: form.who || null, booked_at: booked,
      // En bokad tid blir sysslans datum, så att den syns på Idag den dagen
      due_date: booked ? form.booked.slice(0, 10) : form.due || (unit ? t : null), fixed_day: !!unit, repeat_every: unit ? Number(every) : null, repeat_unit: unit }
    if (form.id) await chores.update(form.id, v)
    else await chores.insert(v)
    setForm(null)
  }
  const complete = (c) => { completeChore(chores, { ...c, booked_at: null }, me.id); if (INSPECT_RE.test(c.title) ) onInspected?.(c) }

  return (
    <>
      {open.length === 0 && <p className="muted">Inget att göra med {car.name} just nu.</p>}
      <ul className="list">
        {open.map((c) => (
          <SwipeRow key={c.id} onCheck={() => complete(c)} onDelete={() => chores.remove(c.id)}>
            <span className="check">
              <Check checked={false} onChange={() => complete(c)} label={`Bocka av ${c.title}`} />
              <span className="tap grow" onClick={() => edit(c)}>
                {emojiOf(c.title)} {c.title}
                <div className="muted small row-icons">
                  {c.booked_at ? <span className="ok">📅 Bokad {prettyDay(localDT(c.booked_at).slice(0, 10))} kl {hm(c.booked_at)}</span>
                    : c.due_date && <span className={c.due_date < t ? 'error' : ''}>{c.due_date === t ? 'Idag' : prettyDay(c.due_date)}</span>}
                  {c.repeat_unit && <span>↻ {c.repeat_unit === 'month' && c.repeat_every == 12 ? 'varje år' : c.repeat_unit === 'month' && c.repeat_every == 6 ? 'varje halvår' : repeatLabel(c.repeat_every, c.repeat_unit)}</span>}
                  {/^boka/i.test(c.title) && !c.booked_at && <span>Inte bokad än</span>}
                </div>
              </span>
            </span>
            <span className="meta">{c.assigned_to && <MemberTag member={byId[c.assigned_to]} size={24} />}</span>
          </SwipeRow>
        ))}
      </ul>
      {done.length > 0 && (
        <>
          <h4 className="day">Senast gjort</h4>
          <ul className="list">
            {done.map((c) => (
              <li key={c.id} className="is-done">
                <span>{emojiOf(c.title)} {c.title}</span>
                <span className="muted small">{byId[c.done_by]?.name || 'Någon'} · {prettyDay(c.done_at.slice(0, 10))}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="muted small">Syns också hos {otherName}. Den som bockar av får det andra hushållet en notis. Har en syssla ett datum eller en bokad tid syns den på Idag den dagen.</p>
      <Fab onClick={() => start()} label="Ny syssla för bilen" />
      {form && (
        <Sheet title={form.id ? 'Ändra' : 'Ny syssla för bilen'} onClose={() => setForm(null)}>
          <form className="stack" onSubmit={save}>
            <input placeholder="T.ex. Tvätta bilen" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus={!form.title} />
            {!form.id && <div className="chips">{QUICK.map((q) => <button type="button" key={q.title} className={`chip ${form.title === q.title ? 'on' : ''}`} onClick={() => setForm({ ...form, title: q.title, repeat: q.repeat || '' })}>{q.emoji} {q.title}</button>)}</div>}
            <label className="field"><span className="muted small">Upprepning</span>
              <select value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value })}>
                {REPEATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select></label>
            <div className="row">
              <label className="field"><span className="muted small">Senast/datum</span><input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} disabled={!!form.booked} /></label>
              <label className="field"><span className="muted small">Bokad tid</span><input type="datetime-local" value={form.booked} onChange={(e) => setForm({ ...form, booked: e.target.value })} /></label>
            </div>
            <label className="field"><span className="muted small">Vem</span>
              <select value={form.who || ''} onChange={(e) => setForm({ ...form, who: e.target.value || null })}>
                <option value="">Vem som helst</option>
                {adults.map((m) => <option key={m.id} value={m.id}>{m.name}{m.linked ? ` (${otherName})` : ''}</option>)}
              </select></label>
            <button className="primary">Spara</button>
            {form.id && <button type="button" className="danger" onClick={() => { chores.remove(form.id); setForm(null) }}>Ta bort</button>}
          </form>
        </Sheet>
      )}
    </>
  )
}
