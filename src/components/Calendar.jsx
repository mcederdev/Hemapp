import { useRef, useState } from 'react'
import { supabase } from '../supabase'
import { useTable } from '../useTable'
import { parseIcs } from '../lib/ics'
import MemberPicker, { MemberTag } from './MemberPicker'

export default function Calendar({ householdId, members }) {
  const events = useTable('events', householdId, 'starts_at')
  const [form, setForm] = useState({ title: '', date: today(), time: '', member: null, location: '' })
  const [showPast, setShowPast] = useState(false)
  const [importMember, setImportMember] = useState(null)
  const [msg, setMsg] = useState('')
  const fileRef = useRef()

  const byId = Object.fromEntries(members.map((m) => [m.id, m]))
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const list = events.rows.filter((e) => showPast || new Date(e.ends_at || e.starts_at) >= startOfToday)
  const groups = groupByDay(list)

  const add = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    const allDay = !form.time
    const starts = new Date(`${form.date}T${form.time || '00:00'}`)
    events.insert({
      title: form.title.trim(), starts_at: starts.toISOString(), all_day: allDay,
      member_id: form.member, location: form.location || null
    })
    setForm({ ...form, title: '', time: '', location: '' })
  }

  const importFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const parsed = parseIcs(await file.text())
    if (parsed.length === 0) { setMsg('Hittade inga händelser i filen.'); return }
    const rows = parsed.map((p) => ({
      household_id: householdId, title: p.title, location: p.location, all_day: p.allDay,
      starts_at: p.start.toISOString(), ends_at: p.end ? p.end.toISOString() : null,
      ics_uid: p.uid, member_id: importMember
    }))
    const { error } = await supabase.from('events').upsert(rows, { onConflict: 'household_id,ics_uid' })
    setMsg(error ? error.message : `Importerade ${rows.length} händelser.`)
    fileRef.current.value = ''
    events.reload()
  }

  return (
    <section>
      <h2>Kalender</h2>
      <form className="stack card" onSubmit={add}>
        <input placeholder="Ny händelse…" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <div className="row">
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        </div>
        <div className="row">
          <MemberPicker members={members} value={form.member} onChange={(m) => setForm({ ...form, member: m })} emptyLabel="Hela familjen" />
          <input placeholder="Plats" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </div>
        <button className="primary">Lägg till</button>
      </form>

      <details className="card">
        <summary>Importera .ics-fil</summary>
        <div className="stack">
          <p className="muted small">T.ex. ett schema från skolan eller en export från en annan kalender. Samma fil kan importeras igen, då uppdateras händelserna i stället för att dubbleras.</p>
          <MemberPicker members={members} value={importMember} onChange={setImportMember} emptyLabel="Gäller hela familjen" />
          <input ref={fileRef} type="file" accept=".ics,text/calendar" onChange={importFile} />
          {msg && <p className="muted">{msg}</p>}
        </div>
      </details>

      <div className="row between">
        <h3>Kommande</h3>
        <button className="link" onClick={() => setShowPast(!showPast)}>{showPast ? 'Dölj gamla' : 'Visa gamla'}</button>
      </div>
      {groups.map(([day, evs]) => (
        <div key={day}>
          <h4 className="day">{day}</h4>
          <ul className="list">
            {evs.map((e) => (
              <li key={e.id}>
                <div>
                  <div>{e.title}</div>
                  <div className="muted small">
                    {e.all_day ? 'Heldag' : time(e.starts_at) + (e.ends_at ? '–' + time(e.ends_at) : '')}
                    {e.location ? ` · ${e.location}` : ''}
                  </div>
                </div>
                <span className="meta">
                  <MemberTag member={byId[e.member_id]} />
                  <button className="icon-btn" onClick={() => events.remove(e.id)} aria-label="Ta bort">✕</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {!events.loading && groups.length === 0 && <p className="muted">Inget inplanerat.</p>}
    </section>
  )
}

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function time(iso) { return new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) }
function groupByDay(list) {
  const map = new Map()
  for (const e of list) {
    const key = new Date(e.starts_at).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(e)
  }
  return [...map.entries()]
}
