import { useState } from 'react'
import { useTable } from '../useTable'
import { today, prettyDay, startOfWeek } from '../lib/dates'
import { sickDayNumber, daysSince } from '../lib/vab'
import { MemberTag } from './MemberPicker'
import { Check } from './Swipe'
import VabForm from './VabForm'
import { Fab } from './Sheet'

const FK_URL = 'https://www.forsakringskassan.se/'

export default function Vab({ householdId, members, people, me }) {
  const vab = useTable('vab_days', householdId, 'day')
  const events = useTable('events', householdId, 'starts_at')
  const [form, setForm] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const [view, setView] = useState('vab')
  const byId = Object.fromEntries((people || members).map((m) => [m.id, m]))
  const t = today()
  const year = t.slice(0, 4)
  const all = [...vab.rows].sort((a, b) => b.day.localeCompare(a.day))
  const rows = all.filter((r) => (r.kind || 'vab') === 'vab')
  const sickRows = all.filter((r) => r.kind === 'sick')
  const open = rows.filter((r) => !r.reported && r.parent_id)
  const done = rows.filter((r) => r.reported || !r.parent_id)
  const parents = members.filter((m) => m.role !== 'child')
  const kids = members.filter((m) => m.role === 'child')

  const toggle = (r) => vab.update(r.id, { reported: !r.reported, reported_at: r.reported ? null : new Date().toISOString() })
  const markAll = (list) => list.forEach((r) => vab.update(r.id, { reported: true, reported_at: new Date().toISOString() }))
  const thisYear = rows.filter((r) => r.day.startsWith(year))
  const sum = (list) => list.reduce((s, r) => s + (Number(r.hours) || 0), 0)

  const Row = ({ r }) => {
    const n = r.kind === 'sick' ? sickDayNumber(sickRows.map((x) => ({ ...x, child_id: x.parent_id })), r.parent_id, r.day) : sickDayNumber(rows, r.child_id, r.day)
    const age = daysSince(r.day, t)
    return (
      <li className={r.reported ? 'is-done' : ''}>
        <span className="check">
          {r.kind !== 'sick' && r.parent_id && <Check checked={r.reported} onChange={() => toggle(r)} label={r.reported ? 'Markera som ej anmäld' : 'Markera som anmäld'} />}
          <span className="tap grow" onClick={() => setForm(r)}>
            <span className="cap">{prettyDay(r.day)}</span> · {r.kind === 'sick' ? `${byId[r.parent_id]?.name || ''} sjuk` : byId[r.child_id]?.name || 'Barn'}
            <div className="muted small row-icons">
              <span>{!r.parent_id && r.kind !== 'sick' ? 'Ingen behövde vabba' : r.full_day ? 'Heldag' : 'Del av dag'}{r.start_time ? ` ${r.start_time.slice(0, 5)}–${r.end_time?.slice(0, 5) || ''}` : ''}{r.hours ? ` · ${fmt(r.hours)} tim` : ''}</span>
              {r.illness && <span>🤒 {r.illness}{r.temperature ? ` ${String(r.temperature).replace('.', ',')}°` : ''}</span>}
            </div>
            {r.kind !== 'sick' && r.parent_id && !r.reported && age > 60 && <div className="error small">Anmäl snart, FK måste ha ansökan inom 90 dagar ({90 - age} dagar kvar)</div>}
            {n >= 8 && <div className="error small">Dag {n} i rad: läkarintyg behövs från dag 8</div>}
          </span>
        </span>
        <MemberTag member={byId[r.parent_id]} size={26} />
      </li>
    )
  }

  const groups = groupByWeek(open)

  return (
    <section>
      <h2>VAB & Sjukdagar</h2>
      <div className="seg mb">
        <button className={view === 'vab' ? 'active' : ''} onClick={() => setView('vab')}>VAB{open.length > 0 ? ` (${open.length})` : ''}</button>
        <button className={view === 'sick' ? 'active' : ''} onClick={() => setView('sick')}>Sjuk själv</button>
      </div>


      {view === 'sick' && (
        <>
          <p className="muted small">Här fyller ni i när någon av er vuxna är sjuk. Tryck på ditt pass i kalendern så fylls arbetstiden i automatiskt.</p>
          {sickRows.length === 0 && <p className="muted">Inga sjukdagar registrerade.</p>}
          <ul className="list">{sickRows.map((r) => <Row key={r.id} r={r} />)}</ul>
          <Fab onClick={() => setForm({ day: t, kind: 'sick', parent_id: me.id })} label="Registrera sjukdag" />
        </>
      )}

      {view === 'vab' && <>
      {kids.length === 0 && <p className="muted">Lägg till barnet under Familj först.</p>}

      <div className="card vab-sum">
        <div className="row between"><strong>{year}</strong><span className="muted small">{plural(thisYear.length)} · {fmt(sum(thisYear))} tim</span></div>
        <div className="vab-parents">
          {parents.map((p) => {
            const mine = thisYear.filter((r) => r.parent_id === p.id)
            return (
              <div key={p.id} className="row"><MemberTag member={p} size={28} /><span className="grow">{p.name}</span>
                <span className="small">{plural(mine.length)} · {fmt(sum(mine))} tim</span></div>
            )
          })}
        </div>
      </div>

      <div className="row between">
        <h3>Att anmäla {open.length > 0 && <span className="count">{open.length}</span>}</h3>
        {open.length > 0 && <a className="button primary small-btn" href={FK_URL} target="_blank" rel="noreferrer">Försäkringskassan ↗</a>}
      </div>
      {open.length === 0 && <p className="muted">Allt är anmält. 👍</p>}
      {groups.map(([week, list]) => (
        <div key={week}>
          <div className="row between"><h4 className="day">Vecka {week}</h4><button className="link small" onClick={() => markAll(list)}>Markera veckan som anmäld</button></div>
          <ul className="list">{list.map((r) => <Row key={r.id} r={r} />)}</ul>
        </div>
      ))}

      {done.length > 0 && (
        <>
          <button className="link" onClick={() => setShowAll(!showAll)}>{showAll ? 'Dölj tidigare' : `Visa tidigare (${done.length})`}</button>
          {showAll && <ul className="list done mt">{done.map((r) => <Row key={r.id} r={r} />)}</ul>}
        </>
      )}

      <p className="muted small mt">Statistik över sjukdagar finns under Mer → Statistik. Tips: tryck på barnets skoltid i kalendern och välj VAB. Ni får en påminnelse på söndagkvällar om det finns VAB som inte är anmäld.</p>

      {kids.length > 0 && <Fab onClick={() => setForm({ day: t })} label="Registrera VAB" />}
      </>}
      {form && <VabForm vab={vab} events={events.rows} members={members} me={me} initial={form} onClose={() => setForm(null)} />}
    </section>
  )
}

function plural(n) { return n === 1 ? '1 dag' : `${n} dagar` }
function fmt(n) { return String(Math.round(Number(n) * 100) / 100).replace('.', ',') }

function groupByWeek(list) {
  const map = new Map()
  for (const r of list) {
    const w = isoWeek(startOfWeek(r.day))
    if (!map.has(w)) map.set(w, [])
    map.get(w).push(r)
  }
  return [...map.entries()]
}
function isoWeek(s) {
  const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7)
}
