import { useRef, useState } from 'react'
import { supabase } from '../supabase'
import { useTable } from '../useTable'
import { parseIcs } from '../lib/ics'
import { simpleRrule, parseRrule } from '../lib/rrule'
import { expandEvents, dayList, timeLabel } from '../lib/events'
import { iso, today, parseDay } from '../lib/dates'
import MemberPicker, { MemberTag } from './MemberPicker'
import Sheet, { Fab } from './Sheet'

const REPEATS = [
  { v: '', label: 'Upprepa inte' }, { v: 'daily', label: 'Varje dag' }, { v: 'weekly', label: 'Varje vecka' },
  { v: 'biweekly', label: 'Varannan vecka' }, { v: 'monthly', label: 'Varje månad' }, { v: 'yearly', label: 'Varje år' }
]
const REMIND = [{ v: 0, label: 'Ingen påminnelse' }, { v: 15, label: '15 min innan' }, { v: 30, label: '30 min innan' }, { v: 60, label: '1 timme innan' }, { v: 120, label: '2 timmar innan' }]
const WD = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

export default function Calendar({ householdId, members }) {
  const events = useTable('events', householdId, 'starts_at')
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [selected, setSelected] = useState(today())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', date: today(), time: '', endTime: '', member: null, location: '', repeat: '', remind: 30 })
  const [importMember, setImportMember] = useState(null)
  const [msg, setMsg] = useState('')
  const [who, setWho] = useState(null)
  const fileRef = useRef()
  const byId = Object.fromEntries(members.map((m) => [m.id, m]))

  // Rutnät: måndag före månadens första dag, 6 veckor
  const gridStart = new Date(month); gridStart.setDate(1 - ((month.getDay() + 6) % 7))
  const gridEnd = new Date(gridStart); gridEnd.setDate(gridStart.getDate() + 42)
  const filtered = events.rows.filter((e) => !who || e.member_id === who || !e.member_id)
  const occ = expandEvents(filtered, gridStart, gridEnd)
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(d.getDate() + i); return d })
  const selDate = parseDay(selected)
  const selOcc = dayList(occ, selDate)
  const t = today()

  // Kommande 14 dagar
  const now0 = parseDay(t); const in14 = new Date(now0); in14.setDate(in14.getDate() + 14)
  const upcoming = expandEvents(filtered, now0, in14).filter((o) => !(o.all_day && o.title.trim().toLowerCase() === 'dag2' && occ.some((x) => !x.all_day && x.start < o.start && x.end && x.end > o.start)))

  const add = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    const allDay = !form.time
    const starts = new Date(`${form.date}T${form.time || '00:00'}`)
    const ends = form.endTime ? new Date(`${form.date}T${form.endTime}`) : null
    events.insert({
      title: form.title.trim(), starts_at: starts.toISOString(), ends_at: ends?.toISOString() || null, all_day: allDay,
      member_id: form.member, location: form.location || null, rrule: simpleRrule(form.repeat), remind_minutes: allDay ? 0 : Number(form.remind)
    })
    setForm({ ...form, title: '', time: '', endTime: '', location: '', repeat: '' })
    setShowForm(false)
  }

  const importFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const parsed = parseIcs(await file.text())
    if (parsed.length === 0) { setMsg('Hittade inga händelser i filen.'); return }
    const rows = parsed.map((p) => ({
      household_id: householdId, title: p.title, location: p.location, all_day: p.allDay,
      starts_at: p.start.toISOString(), ends_at: p.end ? p.end.toISOString() : null,
      ics_uid: p.uid, member_id: importMember, rrule: p.rrule, remind_minutes: p.allDay ? 0 : 30
    }))
    const { error } = await supabase.from('events').upsert(rows, { onConflict: 'household_id,ics_uid' })
    const recurring = rows.filter((r) => r.rrule).length
    setMsg(error ? error.message : `Importerade ${rows.length} händelser${recurring ? `, varav ${recurring} återkommande` : ''}.`)
    fileRef.current.value = ''
    events.reload()
  }

  const shift = (n) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))
  const removeEvent = (o) => {
    const msg = o.rrule ? `Ta bort "${o.title}" och alla dess upprepningar?` : `Ta bort "${o.title}"?`
    if (confirm(msg)) events.remove(o.id)
  }

  return (
    <section>
      <div className="row between">
        <h2 className="cap">{month.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })}</h2>
        <span className="row">
          <button onClick={() => shift(-1)} aria-label="Föregående månad">‹</button>
          <button onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(t) }}>Idag</button>
          <button onClick={() => shift(1)} aria-label="Nästa månad">›</button>
        </span>
      </div>
      <div className="row mb"><span className="muted">Visa:</span><MemberPicker members={members} value={who} onChange={setWho} emptyLabel="Alla" /></div>

      <div className="month">
        {WD.map((w) => <div key={w} className="wd">{w}</div>)}
        {days.map((d) => {
          const key = iso(d)
          const dayOcc = dayList(occ, d)
          return (
            <button key={key} className={`day-cell ${d.getMonth() !== month.getMonth() ? 'other' : ''} ${key === t ? 'today' : ''} ${key === selected ? 'sel' : ''}`}
              onClick={() => setSelected(key)}>
              <span className="num">{d.getDate()}</span>
              <span className="dots">
                {dayOcc.slice(0, 4).map((o) => <i key={o.key} style={{ background: byId[o.member_id]?.color || 'var(--accent)' }} />)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="row between mt">
        <h3 className="cap">{selDate.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
      </div>

      <Fab onClick={() => { setForm({ ...form, date: selected }); setShowForm(true) }} label="Ny händelse" />
      {showForm && (
        <Sheet title="Ny händelse" onClose={() => setShowForm(false)}>
        <form className="stack" onSubmit={add}>
          <input placeholder="Vad händer?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          <label className="field"><span className="muted small">Datum</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
          <div className="row">
            <label className="field"><span className="muted small">Start</span><input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
            <label className="field"><span className="muted small">Slut</span><input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></label>
          </div>
          <p className="muted small">Lämna tiden tom för en heldagshändelse.</p>
          <div className="row">
            <MemberPicker members={members} value={form.member} onChange={(m) => setForm({ ...form, member: m })} emptyLabel="Hela familjen" />
            <input placeholder="Plats" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="row">
            <select value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value })}>{REPEATS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}</select>
            {form.time && <select value={form.remind} onChange={(e) => setForm({ ...form, remind: e.target.value })}>{REMIND.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}</select>}
          </div>
          <button className="primary">Spara</button>
        </form>
        </Sheet>
      )}

      <EventList list={selOcc} day={selDate} byId={byId} onRemove={removeEvent} empty="Inget denna dag." />

      <h3>Kommande två veckor</h3>
      {groupByDay(upcoming).map(([day, evs]) => (
        <div key={day}>
          <h4 className="day">{day}</h4>
          <EventList list={evs} day={evs[0].start} byId={byId} onRemove={removeEvent} />
        </div>
      ))}
      {!events.loading && upcoming.length === 0 && <p className="muted">Inget inplanerat.</p>}

      <details className="card mt">
        <summary>Importera .ics-fil</summary>
        <div className="stack">
          <p className="muted small">T.ex. ett schema från skolan eller en export från en annan kalender. Återkommande händelser följer med. Samma fil kan importeras igen, då uppdateras händelserna i stället för att dubbleras.</p>
          <MemberPicker members={members} value={importMember} onChange={setImportMember} emptyLabel="Gäller hela familjen" />
          <input ref={fileRef} type="file" accept=".ics,text/calendar" onChange={importFile} />
          {msg && <p className="muted">{msg}</p>}
        </div>
      </details>
    </section>
  )
}

function EventList({ list, day, byId, onRemove, empty }) {
  if (list.length === 0) return empty ? <p className="muted">{empty}</p> : null
  return (
    <ul className="list">
      {list.map((o) => (
        <li key={o.key} style={{ borderLeft: `4px solid ${byId[o.member_id]?.color || 'var(--accent)'}` }}>
          <div>
            <div>{o.title}</div>
            <div className="muted small">
              {(() => { const l = timeLabel(o, day); return l.time + (l.note ? ` (${l.note})` : '') })()}
              {o.location ? ` · ${o.location}` : ''}
              {o.rrule && ` · 🔁 ${describe(o.rrule)}`}
            </div>
          </div>
          <span className="meta">
            <MemberTag member={byId[o.member_id]} />
            <button className="icon-btn" onClick={() => onRemove(o)} aria-label="Ta bort">✕</button>
          </span>
        </li>
      ))}
    </ul>
  )
}

function describe(rrule) {
  const r = parseRrule(rrule)
  if (!r) return ''
  const n = Number(r.INTERVAL || 1)
  const base = { DAILY: 'dag', WEEKLY: 'vecka', MONTHLY: 'månad', YEARLY: 'år' }[r.FREQ] || ''
  if (n === 1) return `varje ${base}`
  if (n === 2) return `var${base === 'år' ? 'tannat' : 'annan'} ${base}`
  return `var ${n}:e ${base}`
}

function groupByDay(list) {
  const map = new Map()
  for (const o of list) {
    const key = o.start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(o)
  }
  return [...map.entries()]
}
