import { useEffect, useState } from 'react'
import { ILLNESSES, workTime, hoursBetween } from '../lib/vab'
import { addDays } from '../lib/dates'
import Sheet from './Sheet'

const nextWeekday = (d) => { let n = addDays(d, 1); while ([0, 6].includes(new Date(n + 'T00:00').getDay())) n = addDays(n, 1); return n }

// Fyll i eller ändra en VAB-dag. initial = { day, child_id, event_id } eller en befintlig rad.
export default function VabForm({ vab, events, members, me, initial, onClose }) {
  const kids = members.filter((m) => m.role === 'child')
  const parents = members.filter((m) => m.role !== 'child')
  const editing = !!initial.id
  const [f, setF] = useState(() => ({
    child_id: initial.child_id || kids[0]?.id || null,
    day: initial.day,
    parent_id: initial.parent_id || (me.role !== 'child' ? me.id : parents[0]?.id),
    full_day: initial.full_day ?? true,
    start_time: initial.start_time?.slice(0, 5) || '',
    end_time: initial.end_time?.slice(0, 5) || '',
    hours: initial.hours ?? '',
    illness: initial.illness || '',
    temperature: initial.temperature ?? '',
    note: initial.note || '',
    event_id: initial.event_id || null
  }))
  const [touched, setTouched] = useState(editing) // har man ändrat tiderna själv?
  const [split, setSplit] = useState(null) // andra föräldern om dagen delas
  const set = (patch) => setF((x) => ({ ...x, ...patch }))
  const auto = workTime(events, f.parent_id, f.day)
  const other = parents.find((p) => p.id !== f.parent_id)

  // Fyll i arbetstiden automatiskt när förälder eller dag ändras
  useEffect(() => {
    if (touched) return
    const w = workTime(events, f.parent_id, f.day) || { start: '08:00', end: '17:00' }
    set({ start_time: w.start, end_time: w.end, hours: hoursBetween(w.start, w.end) })
  }, [f.parent_id, f.day, events.length, touched])

  const setTime = (patch) => {
    setTouched(true)
    const n = { ...f, ...patch }
    set({ ...patch, hours: 'hours' in patch ? patch.hours : hoursBetween(n.start_time, n.end_time) ?? n.hours })
  }
  const toggleSplit = () => {
    if (split) return setSplit(null)
    const mine = workTime(events, f.parent_id, f.day) || { start: f.start_time || '08:00', end: f.end_time || '17:00' }
    const theirs = workTime(events, other?.id, f.day) || mine
    // Förslag: första halvan för den ena, andra halvan för den andra
    const mid = midpoint(mine.start, theirs.end)
    setTouched(true)
    set({ full_day: false, start_time: mine.start, end_time: mid, hours: hoursBetween(mine.start, mid) })
    setSplit({ parent_id: other?.id, start_time: mid, end_time: theirs.end, hours: hoursBetween(mid, theirs.end) })
  }

  const row = (base, day = f.day) => ({
    child_id: f.child_id, day, parent_id: base.parent_id, full_day: split ? false : f.full_day,
    start_time: base.start_time || null, end_time: base.end_time || null, hours: base.hours === '' ? null : Number(base.hours),
    illness: f.illness.trim() || null, temperature: f.temperature === '' ? null : Number(String(f.temperature).replace(',', '.')),
    note: f.note.trim() || null, event_id: f.event_id
  })
  const save = async (alsoTomorrow) => {
    const rows = [row(f), ...(split ? [row(split)] : [])]
    if (editing) await vab.update(initial.id, rows[0])
    else await vab.insert(rows.map((r) => ({ ...r, created_by: me.id })))
    if (editing && split) await vab.insert({ ...rows[1], created_by: me.id })
    if (alsoTomorrow) {
      const next = nextWeekday(f.day)
      const w = workTime(events, f.parent_id, next) || { start: f.start_time, end: f.end_time }
      await vab.insert({ ...row(f, next), full_day: true, start_time: w.start, end_time: w.end, hours: hoursBetween(w.start, w.end), event_id: null, created_by: me.id })
    }
    onClose()
  }
  const remove = async () => { if (confirm('Ta bort VAB-dagen?')) { await vab.remove(initial.id); onClose() } }
  const name = (id) => members.find((m) => m.id === id)?.name

  return (
    <Sheet title={editing ? 'Ändra VAB' : 'Registrera VAB'} onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); save(false) }}>
        <div className="row">
          {kids.length > 1 && (
            <label className="field"><span className="muted small">Barn</span>
              <select value={f.child_id || ''} onChange={(e) => set({ child_id: e.target.value })}>{kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></label>
          )}
          <label className="field"><span className="muted small">Datum</span>
            <input type="date" value={f.day} onChange={(e) => { setTouched(false); set({ day: e.target.value }) }} required /></label>
        </div>

        <div>
          <span className="muted small">Vem vabbade?</span>
          <div className="seg">
            {parents.map((p) => <button type="button" key={p.id} className={f.parent_id === p.id ? 'active' : ''} onClick={() => { setTouched(false); set({ parent_id: p.id }) }}>{p.name}</button>)}
          </div>
        </div>

        {!split && (
          <div className="seg">
            <button type="button" className={f.full_day ? 'active' : ''} onClick={() => { setTouched(false); set({ full_day: true }) }}>Heldag</button>
            <button type="button" className={!f.full_day ? 'active' : ''} onClick={() => set({ full_day: false })}>Del av dag</button>
          </div>
        )}

        <TimeRow label={split ? name(f.parent_id) : 'Arbetstid som du var borta'} v={f} onChange={setTime} />
        <p className="muted small vab-hint">
          {touched ? 'Ändrat för hand.' : auto ? `Hämtat från ${auto.titles.join(', ')} i kalendern.` : 'Inget pass hittades i kalendern, fyll i tiderna själv.'}
        </p>
        {split && <TimeRow label={name(split.parent_id)} v={split} onChange={(p) => { const n = { ...split, ...p }; setSplit({ ...n, hours: 'hours' in p ? p.hours : hoursBetween(n.start_time, n.end_time) ?? n.hours }) }} />}
        {other && !editing && <button type="button" className="link" onClick={toggleSplit}>{split ? 'Ångra delning' : `Dela dagen med ${other.name}`}</button>}

        <div>
          <span className="muted small">Vad var det?</span>
          <div className="chips">
            {ILLNESSES.map((i) => <button type="button" key={i} className={`chip ${f.illness === i ? 'on' : ''}`} onClick={() => set({ illness: f.illness === i ? '' : i })}>{i}</button>)}
          </div>
        </div>
        <div className="row">
          <input placeholder="Sjukdom (egen text)" value={f.illness} onChange={(e) => set({ illness: e.target.value })} />
          <input placeholder="Temp °C" inputMode="decimal" value={f.temperature} onChange={(e) => set({ temperature: e.target.value })} style={{ maxWidth: 100 }} />
        </div>
        <input placeholder="Anteckning (valfritt)" value={f.note} onChange={(e) => set({ note: e.target.value })} />

        <button className="primary">Spara</button>
        {!editing && <button type="button" onClick={() => save(true)}>Spara, och sjuk imorgon också</button>}
        {editing && <button type="button" className="danger" onClick={remove}>Ta bort</button>}
      </form>
    </Sheet>
  )
}

function TimeRow({ label, v, onChange }) {
  return (
    <div>
      <span className="muted small">{label}</span>
      <div className="row">
        <input type="time" value={v.start_time} onChange={(e) => onChange({ start_time: e.target.value })} aria-label="Från" />
        <span>–</span>
        <input type="time" value={v.end_time} onChange={(e) => onChange({ end_time: e.target.value })} aria-label="Till" />
        <input inputMode="decimal" value={v.hours} onChange={(e) => onChange({ hours: e.target.value.replace(',', '.') })} style={{ maxWidth: 80 }} aria-label="Timmar" />
        <span className="muted small">tim</span>
      </div>
    </div>
  )
}

function midpoint(a, b) {
  const m = (t) => { const [h, mm] = t.split(':').map(Number); return h * 60 + mm }
  let x = Math.round(((m(a) + m(b)) / 2) / 15) * 15
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`
}
