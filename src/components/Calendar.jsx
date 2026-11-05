import { useRef, useState } from 'react'
import { supabase } from '../supabase'
import { useTable } from '../useTable'
import { parseIcs } from '../lib/ics'
import { simpleRrule } from '../lib/rrule'
import { expandEvents, dayList } from '../lib/events'
import { iso, today, parseDay, startOfWeek, addDays } from '../lib/dates'
import MemberPicker from './MemberPicker'
import EventRow from './EventRow'
import Icon from './Icon'
import Sheet, { Fab } from './Sheet'
import FamilyStrip, { forFocus } from './FamilyStrip'
import DayColumns from './DayColumns'
import VabForm from './VabForm'

const REPEATS = [
  { v: '', label: 'Upprepa inte' }, { v: 'daily', label: 'Varje dag' }, { v: 'weekdays', label: 'Vardagar (mån–fre)' }, { v: 'weekdays2', label: 'Vardagar varannan vecka' }, { v: 'weekly', label: 'Varje vecka' },
  { v: 'biweekly', label: 'Varannan vecka' }, { v: 'monthly', label: 'Varje månad' }, { v: 'yearly', label: 'Varje år' }
]
const REMIND = [{ v: 0, label: 'Ingen påminnelse' }, { v: 15, label: '15 min innan' }, { v: 30, label: '30 min innan' }, { v: 60, label: '1 timme innan' }, { v: 120, label: '2 timmar innan' }]
const WD = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

export default function Calendar({ householdId, members, me, go, focus: who, setFocus: setWho }) {
  const events = useTable('events', householdId, 'starts_at')
  const vab = useTable('vab_days', householdId, 'day')
  const [vabForm, setVabForm] = useState(null)
  const [opened, setOpened] = useState(null)
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [selected, setSelected] = useState(today())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', date: today(), time: '', endTime: '', member: null, location: '', repeat: '', until: '', remind: 30 })
  const [importMember, setImportMember] = useState(null)
  const [msg, setMsg] = useState('')
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('calMode') || 'week' } catch { return 'week' } })
  const fileRef = useRef()
  const byId = Object.fromEntries(members.map((m) => [m.id, m]))

  // Rutnät: måndag före månadens första dag, 6 veckor
  const gridStart = new Date(month); gridStart.setDate(1 - ((month.getDay() + 6) % 7))
  const gridEnd = new Date(gridStart); gridEnd.setDate(gridStart.getDate() + 42)
  const filtered = events.rows.filter((e) => forFocus(who, e.member_id))
  // Veckoremsa: två veckor från måndagen i vald vecka
  const stripStart = parseDay(startOfWeek(selected))
  const stripDays = Array.from({ length: 14 }, (_, i) => { const d = new Date(stripStart); d.setDate(d.getDate() + i); return d })
  const stripEnd = new Date(stripStart); stripEnd.setDate(stripEnd.getDate() + 14)
  const rangeFrom = new Date(Math.min(gridStart, stripStart)), rangeTo = new Date(Math.max(gridEnd, stripEnd))
  const occ = expandEvents(filtered, rangeFrom, rangeTo)
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
      member_id: form.member, location: form.location || null, rrule: simpleRrule(form.repeat, form.until), remind_minutes: allDay ? 0 : Number(form.remind)
    })
    setForm({ ...form, title: '', time: '', endTime: '', location: '', repeat: '', until: '' })
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

  const pickDay = (key) => { setSelected(key); const d = parseDay(key); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)) }
  const shift = (n) => {
    if (mode === 'day') return pickDay(addDays(selected, n))
    if (mode === 'week') return pickDay(addDays(selected, 7 * n))
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))
  }
  const switchMode = (m) => { setMode(m); try { localStorage.setItem('calMode', m) } catch { /* ignoreras */ } }
  const dots = (d) => dayList(occ, d).slice(0, 4).map((o) => <i key={o.key} style={{ background: byId[o.member_id]?.color || 'var(--accent)' }} />)
  // VAB: märk barnets händelser de dagar barnet varit sjukt
  const vabOn = (o) => {
    if (byId[o.member_id]?.role !== 'child') return []
    const d = iso(o.start < parseDay(selected) ? parseDay(selected) : o.start)
    return vab.rows.filter((r) => r.kind !== 'sick' && r.child_id === o.member_id && r.day === d)
  }
  const badgeFor = (o, day) => {
    const d = iso(day)
    // Förälderns pass den dag hen vabbar
    if (byId[o.member_id] && byId[o.member_id].role !== 'child') {
      const r = !o.all_day && vab.rows.find((r) => r.parent_id === o.member_id && r.day === d)
      return r ? (r.kind === 'sick' ? 'Sjuk' : 'VAB') : null
    }
    if (byId[o.member_id]?.role !== 'child') return null
    const list = vab.rows.filter((r) => r.kind !== 'sick' && r.child_id === o.member_id && r.day === d)
    return list.length ? `VAB · ${list.map((r) => byId[r.parent_id]?.name).filter(Boolean).join(' + ')}` : null
  }
  const startVab = (o) => {
    setOpened(null)
    const d = iso(o.start < parseDay(selected) ? parseDay(selected) : o.start)
    const existing = vab.rows.find((r) => r.kind !== 'sick' && r.child_id === o.member_id && r.day === d)
    setVabForm(existing || { day: d, child_id: o.member_id, event_id: o.id })
  }
  // Egen sjukdag från förälderns pass
  const startSick = (o) => {
    setOpened(null)
    const d = iso(o.start < parseDay(selected) ? parseDay(selected) : o.start)
    const existing = vab.rows.find((r) => r.kind === 'sick' && r.parent_id === o.member_id && r.day === d)
    setVabForm(existing || { day: d, kind: 'sick', parent_id: o.member_id, event_id: o.id })
  }
  const [removing, setRemoving] = useState(null)
  const removeEvent = (o) => {
    if (o.rrule) return setRemoving(o)
    if (confirm(`Ta bort "${o.title}"?`)) events.remove(o.id)
  }
  // Bara detta tillfälle: spara det som undantag
  const removeOne = (o) => { events.update(o.id, { exdates: [...(o.exdates || []), o.start.toISOString()] }); setRemoving(null) }
  // Detta och framtida: låt upprepningen sluta dagen innan
  const removeFuture = (o) => {
    const first = new Date(o.starts_at)
    if (o.start.getTime() <= first.getTime()) { events.remove(o.id); return setRemoving(null) }
    const prev = new Date(o.start); prev.setDate(prev.getDate() - 1)
    const until = iso(prev).replaceAll('-', '') + 'T235959'
    const rule = o.rrule.split(';').filter((p) => !/^(UNTIL|COUNT)=/i.test(p)).join(';') + `;UNTIL=${until}`
    events.update(o.id, { rrule: rule })
    setRemoving(null)
  }

  return (
    <section>
      <div className="row between">
        <h2 className="cap">{(mode !== 'month' ? selDate : month).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })}</h2>
        <span className="row">
          <button className="sq" onClick={() => shift(-1)} aria-label="Bakåt"><Icon name="left" size={18} /></button>
          <button onClick={() => pickDay(t)}>Idag</button>
          <button className="sq" onClick={() => shift(1)} aria-label="Framåt"><Icon name="chevron" size={18} /></button>
        </span>
      </div>
      <FamilyStrip members={members} focus={who} setFocus={setWho} />
      <div className="seg mb">
        {[['day', 'Dag'], ['week', 'Vecka'], ['month', 'Månad']].map(([m, l]) => (
          <button key={m} className={mode === m ? 'active' : ''} onClick={() => switchMode(m)}>{l}</button>
        ))}
      </div>

      {mode !== 'month' && (
        <div className="strip">
          {stripDays.map((d) => {
            const key = iso(d)
            return (
              <button key={key} className={`strip-day ${key === t ? 'today' : ''} ${key === selected ? 'sel' : ''}`} onClick={() => setSelected(key)}>
                <span className="wd">{d.toLocaleDateString('sv-SE', { weekday: 'short' }).replace('.', '')}</span>
                <span className="num">{d.getDate()}</span>
                <span className="dots">{dots(d)}</span>
              </button>
            )
          })}
        </div>
      )}

      {mode === 'month' && <div className="month">
        {WD.map((w) => <div key={w} className="wd">{w}</div>)}
        {days.map((d) => {
          const key = iso(d)
          return (
            <button key={key} className={`day-cell ${d.getMonth() !== month.getMonth() ? 'other' : ''} ${key === t ? 'today' : ''} ${key === selected ? 'sel' : ''}`}
              onClick={() => pickDay(key)}>
              <span className="num">{d.getDate()}</span>
              <span className="dots">{dots(d)}</span>
            </button>
          )
        })}
      </div>}

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
            {form.repeat && <label className="field"><span className="muted small">Slutar (valfritt)</span><input type="date" value={form.until} min={form.date} onChange={(e) => setForm({ ...form, until: e.target.value })} /></label>}
          </div>
          <div className="row">
            {form.time && <select value={form.remind} onChange={(e) => setForm({ ...form, remind: e.target.value })}>{REMIND.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}</select>}
          </div>
          <button className="primary">Spara</button>
        </form>
        </Sheet>
      )}

      {mode === 'day'
        ? <DayColumns occ={selOcc} day={selDate} members={who ? members.filter((m) => m.id === who) : members} onRemove={removeEvent} onVab={startVab} onSick={startSick} me={me} badgeFor={badgeFor} />
        : <EventList list={selOcc} day={selDate} byId={byId} onRemove={removeEvent} onOpen={setOpened} badgeFor={badgeFor} empty="Inget denna dag." />}

      {opened && (
        <Sheet title={opened.title} onClose={() => setOpened(null)}>
          <ul className="list"><EventRow occ={opened} day={selDate} byId={byId} badge={badgeFor(opened, selDate)} /></ul>
          <div className="stack">
            {byId[opened.member_id]?.role === 'child' && (
              <button className="primary" onClick={() => startVab(opened)}>
                🤒 {vabOn(opened).length ? 'Ändra VAB' : `${byId[opened.member_id].name} är sjuk – VAB`}
              </button>
            )}
            {byId[opened.member_id] && byId[opened.member_id].role !== 'child' && !opened.all_day && (
              <button onClick={() => startSick(opened)}>🤒 {opened.member_id === me.id ? 'Jag är sjuk' : `${byId[opened.member_id].name} är sjuk`}</button>
            )}
            <button className="danger" onClick={() => { const o = opened; setOpened(null); removeEvent(o) }}>Ta bort händelsen</button>
          </div>
        </Sheet>
      )}
      {vabForm && <VabForm vab={vab} events={events.rows} members={members} me={me} initial={vabForm} onClose={() => setVabForm(null)} />}

      {removing && (
        <Sheet title={`Ta bort "${removing.title}"`} onClose={() => setRemoving(null)}>
          <p className="muted small">Det här är en återkommande händelse. Vad vill du ta bort?</p>
          <div className="stack">
            <button onClick={() => removeOne(removing)}>Bara {removing.start.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' })}</button>
            <button onClick={() => removeFuture(removing)}>Detta och alla framtida</button>
            <button className="danger" onClick={() => { events.remove(removing.id); setRemoving(null) }}>Alla tillfällen</button>
          </div>
        </Sheet>
      )}

      <h3>Kommande två veckor</h3>
      {groupByDay(upcoming).map(([day, evs]) => (
        <div key={day}>
          <h4 className="day">{day}</h4>
          <EventList list={evs} day={evs[0].start} byId={byId} onRemove={removeEvent} onOpen={(o) => { pickDay(iso(evs[0].start)); setOpened(o) }} badgeFor={badgeFor} />
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

function EventList({ list, day, byId, onRemove, onOpen, badgeFor, empty }) {
  if (list.length === 0) return empty ? <p className="muted">{empty}</p> : null
  return <ul className="list">{list.map((o) => <EventRow key={o.key} occ={o} day={day} byId={byId} onRemove={onRemove} onOpen={onOpen} badge={badgeFor?.(o, day)} />)}</ul>
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
