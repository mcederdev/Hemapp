import { useState } from 'react'
import { useTable } from '../useTable'
import { today, addDays } from '../lib/dates'
import { schoolDay, dayWarnings } from '../lib/pickup'
import { withUs, isHandover } from '../lib/custody'
import { MemberTag } from './MemberPicker'
import Sheet from './Sheet'

// Hämta och lämna idag och imorgon, med varningar när ingen är ledig
export default function Pickups({ householdId, members, people, me, custody, events }) {
  const pickups = useTable('pickups', householdId, 'day')
  const [pick, setPick] = useState(null)
  const t = today()
  const kids = members.filter((m) => m.role === 'child')
  const parents = members.filter((m) => m.role !== 'child' && m.household_id === me.household_id)
  const adults = (people || members).filter((m) => m.role !== 'child')
  const byId = Object.fromEntries((people || members).map((m) => [m.id, m]))
  const cust = (kid) => (custody || []).find((c) => c.child_id === kid)
  const hereOn = (d) => (kid) => { const c = cust(kid); return !c || withUs(c, me.household_id, d, '12:00') }

  const days = [t, addDays(t, 1)].map((d) => {
    const handover = kids.flatMap((k) => { const c = cust(k.id); return c && isHandover(c, d) ? [{ kid: k, at: new Date(`${d}T${String(c.handover_time).slice(0, 5)}`) }] : [] })
    const rows = kids.filter((k) => hereOn(d)(k.id)).map((k) => ({ kid: k, s: schoolDay(events, k.id, d) })).filter((x) => x.s)
    const warnings = dayWarnings({ events, kids, parents, pickups: pickups.rows, dayStr: d, here: hereOn(d), handover, nameOf: (id) => byId[id]?.name || 'Någon' })
    return { d, rows, warnings }
  }).filter((x) => x.rows.length || x.warnings.length)
  if (!days.length) return null

  const set = async (person) => {
    const { kid, day, kind } = pick
    const existing = pickups.rows.find((x) => x.child_id === kid.id && x.day === day && x.kind === kind)
    const v = person === null ? { person_id: null, person_name: null } : typeof person === 'string' ? { person_id: null, person_name: person } : { person_id: person.id, person_name: person.name }
    if (existing) await pickups.update(existing.id, v)
    else await pickups.insert({ child_id: kid.id, day, kind, ...v })
    setPick(null)
  }
  const who = (kid, day, kind) => pickups.rows.find((x) => x.child_id === kid.id && x.day === day && x.kind === kind)

  return (
    <div className="card compact pickups">
      <div className="card-head"><strong>🚸 Lämna och hämta</strong></div>
      {days.map(({ d, rows, warnings }) => (
        <div key={d} className="pk-day">
          <div className="muted small cap">{d === t ? 'Idag' : 'Imorgon'}</div>
          {warnings.map((w, i) => <p key={i} className="warn-line">⚠️ {w.text}</p>)}
          {rows.map(({ kid, s }) => (
            <div key={kid.id} className="pk-row">
              <MemberTag member={kid} size={24} />
              {[['lamna', 'Lämna', s.startHM], ['hamta', 'Hämta', s.endHM]].map(([kind, label, time]) => {
                const p = who(kid, d, kind)
                return (
                  <button key={kind} className={`pk-btn ${p?.person_name || p?.person_id ? 'set' : ''}`} onClick={() => setPick({ kid, day: d, kind, label, time })}>
                    <span className="muted small">{label} {time}</span>
                    <span className="pk-who">{p?.person_id && byId[p.person_id] ? <MemberTag member={byId[p.person_id]} size={20} /> : null}{p?.person_name || byId[p?.person_id]?.name || 'Vem?'}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      ))}
      {pick && (
        <Sheet title={`${pick.label} ${pick.kid.name} ${pick.day === t ? 'idag' : 'imorgon'} kl ${pick.time}`} onClose={() => setPick(null)}>
          <div className="stack">
            {adults.map((m) => <button key={m.id} className="row" onClick={() => set(m)}><MemberTag member={m} size={26} /> {m.name}{m.linked ? <span className="muted small"> · {m.household_name}</span> : ''}</button>)}
            <button onClick={() => { const n = prompt('Vem? (t.ex. Mormor, Kompisens pappa)'); if (n?.trim()) set(n.trim()) }}>Någon annan…</button>
            <button className="link" onClick={() => set(null)}>Ingen bestämd</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
