import { useState } from 'react'
import { useTable } from '../useTable'
import { today, addDays, prettyDay } from '../lib/dates'
import { schoolDay, dayWarnings, freeParent, busyAt } from '../lib/pickup'
import { withUs, isHandover } from '../lib/custody'
import { MemberTag } from './MemberPicker'
import Sheet from './Sheet'

const dayName = (d, t) => (d === t ? 'Idag' : d === addDays(t, 1) ? 'Imorgon' : prettyDay(d))

// Räknar ut dagarna: skoltider, vem som lämnar/hämtar (valt eller förvalt enligt kalendern) och varningar
function usePlan({ householdId, members, people, me, custody, events, count }) {
  const pickups = useTable('pickups', householdId, 'day')
  const t = today()
  const kids = members.filter((m) => m.role === 'child')
  const parents = members.filter((m) => m.role !== 'child' && m.household_id === me.household_id)
  const byId = Object.fromEntries((people || members).map((m) => [m.id, m]))
  const cust = (kid) => (custody || []).find((c) => c.child_id === kid)
  const hereOn = (d) => (kid) => { const c = cust(kid); return !c || withUs(c, me.household_id, d, '12:00') }
  const who = (kid, day, kind) => pickups.rows.find((x) => x.child_id === kid.id && x.day === day && x.kind === kind)

  const days = Array.from({ length: count }, (_, i) => addDays(t, i)).map((d) => {
    const handover = kids.flatMap((k) => { const c = cust(k.id); return c && isHandover(c, d) ? [{ kid: k, at: new Date(`${d}T${String(c.handover_time).slice(0, 5)}`) }] : [] })
    const rows = kids.filter((k) => hereOn(d)(k.id)).map((k) => ({ kid: k, s: schoolDay(events, k.id, d) })).filter((x) => x.s).map(({ kid, s }) => ({
      kid,
      slots: [['lamna', 'Lämna', s.startHM, s.start], ['hamta', 'Hämta', s.endHM, s.end]].map(([kind, label, time, at]) => {
        const p = who(kid, d, kind)
        const auto = !p ? freeParent(events, parents, at) : null
        const both = !!p?.both_parents
        const person = both ? null : p?.person_id ? byId[p.person_id] : auto
        return { kind, label, time, at, p, auto, both, person, name: both ? 'Båda' : p?.person_name || person?.name || null }
      })
    }))
    const warnings = dayWarnings({ events, kids, parents, pickups: pickups.rows, dayStr: d, here: hereOn(d), handover, nameOf: (id) => byId[id]?.name || 'Någon' })
    return { d, rows, warnings }
  })

  const set = async (pick, person) => {
    const { kid, day, kind } = pick
    const existing = who(kid, day, kind)
    const v = person === 'both' ? { person_id: null, person_name: null, both_parents: true }
      : person === null ? { person_id: null, person_name: null, both_parents: false }
      : typeof person === 'string' ? { person_id: null, person_name: person, both_parents: false }
      : { person_id: person.id, person_name: person.name, both_parents: false }
    if (existing) await pickups.update(existing.id, v)
    else await pickups.insert({ child_id: kid.id, day, kind, ...v })
  }
  return { t, days, parents, byId, set }
}

// På Idag: vad du själv ska göra, varningar och hur många tider som saknar någon
export default function Pickups(props) {
  const { me, go } = props
  const { t, days, parents, byId, set } = usePlan({ ...props, count: 7 })
  const [pick, setPick] = useState(null)
  const soon = days.slice(0, 2)
  const mine = soon.flatMap(({ d, rows }) => rows.flatMap(({ kid, slots }) => slots.filter((s) => s.both || s.person?.id === me.id && !s.p?.person_name || s.p?.person_id === me.id).map((s) => ({ d, kid, s }))))
  const warnings = soon.flatMap(({ d, warnings }) => warnings.map((w) => ({ d, w })))
  const open = days.flatMap(({ d, rows }) => rows.flatMap(({ kid, slots }) => slots.filter((s) => !s.name && !s.p).map((s) => ({ d, kid, s }))))
  const openSoon = open.filter((x) => x.d <= addDays(t, 1))
  if (!mine.length && !warnings.length && !open.length) return null
  return (
    <div className="card compact pickups">
      <button className="card-head" onClick={() => go('pickups')}><strong>🚸 Lämna och hämta</strong>{open.length > 0 && <span className="count">{open.length}</span>}</button>
      <div className="pk-day">
      {mine.map(({ d, kid, s }) => (
        <div key={d + kid.id + s.kind} className="pk-mine"><MemberTag member={kid} size={22} /><span><strong>{s.both ? 'Ni' : 'Du'} {s.kind === 'lamna' ? 'lämnar' : 'hämtar'} {kid.name}{s.both ? ' tillsammans' : ''}</strong> {dayName(d, t).toLowerCase()} kl {s.time}{s.auto ? <span className="muted small"> · enligt kalendern</span> : ''}</span></div>
      ))}
      {warnings.map(({ d, w }, i) => <p key={i} className="warn-line">⚠️ {dayName(d, t)}: {w.text}</p>)}
      {openSoon.map(({ d, kid, s }) => (
        <button key={d + kid.id + s.kind} className="pk-open" onClick={() => setPick({ kid, day: d, kind: s.kind, label: s.label, time: s.time, at: s.at })}>
          <span>Vem {s.kind === 'lamna' ? 'lämnar' : 'hämtar'} {kid.name} {dayName(d, t).toLowerCase()} kl {s.time}?</span><span className="chip">Välj</span>
        </button>
      ))}
      {open.length > openSoon.length && <button className="link small" onClick={() => go('pickups')}>{open.length - openSoon.length} fler tider den här veckan saknar någon →</button>}
      </div>
      {pick && <PickSheet pick={pick} t={t} {...props} parents={parents} onPick={async (p) => { await set(pick, p); setPick(null) }} onClose={() => setPick(null)} />}
    </div>
  )
}

// Egen sida: hela veckan
export function PickupsPage(props) {
  const events = useTable('events', props.householdId, 'starts_at')
  const p = { ...props, events: events.rows }
  const { t, days, parents, set } = usePlan({ ...p, count: 14 })
  const [pick, setPick] = useState(null)
  const shown = days.filter((x) => x.rows.length || x.warnings.length)
  return (
    <section>
      <h2>Lämna och hämta</h2>
      <p className="muted small">Tiderna kommer från barnets skola i kalendern. Är bara en av er ledig enligt kalendern väljs den. Annars väljer ni själva.</p>
      {shown.length === 0 && <p className="muted">Ingen skola inlagd de närmaste två veckorna. Lägg in barnets skoltider i kalendern (t.ex. "Skola" varje vardag) så dyker de upp här.</p>}
      {shown.map(({ d, rows, warnings }) => (
        <div key={d} className="card compact pickups"><div className="pk-day">
          <div className="muted small cap"><strong>{dayName(d, t)}</strong></div>
          {warnings.map((w, i) => <p key={i} className="warn-line">⚠️ {w.text}</p>)}
          {rows.map(({ kid, slots }) => (
            <div key={kid.id} className="pk-row">
              <MemberTag member={kid} size={24} />
              {slots.map((s) => (
                <button key={s.kind} className={`pk-btn ${s.both || s.p?.person_name || s.p?.person_id ? 'set' : s.auto ? 'auto' : ''}`} onClick={() => setPick({ kid, day: d, kind: s.kind, label: s.label, time: s.time, at: s.at })}>
                  <span className="muted small">{s.label} {s.time}{s.auto ? ' · ledig' : ''}</span>
                  <span className="pk-who">{s.both ? parents.map((m) => <MemberTag key={m.id} member={m} size={20} />) : s.person ? <MemberTag member={s.person} size={20} /> : null}{s.name || 'Vem?'}</span>
                </button>
              ))}
            </div>
          ))}
        </div></div>
      ))}
      {pick && <PickSheet pick={pick} t={t} {...p} parents={parents} onPick={async (x) => { await set(pick, x); setPick(null) }} onClose={() => setPick(null)} />}
    </section>
  )
}

function PickSheet({ pick, t, members, people, parents, events, onPick, onClose }) {
  const adults = (people || members).filter((m) => m.role !== 'child')
  return (
    <Sheet title={`${pick.label} ${pick.kid.name} ${dayName(pick.day, t).toLowerCase()} kl ${pick.time}`} onClose={onClose}>
      <div className="stack">
        {adults.map((m) => (
          <button key={m.id} className="row" onClick={() => onPick(m)}><MemberTag member={m} size={26} /> {m.name}{m.linked ? <span className="muted small"> · {m.household_name}</span> : ''}
            {parents.some((x) => x.id === m.id) && <span className={`small ${busyAt(events, m.id, pick.at) ? 'error' : 'ok'}`} style={{ marginLeft: 'auto' }}>{busyAt(events, m.id, pick.at) ? 'jobbar' : 'ledig'}</span>}</button>
        ))}
        {parents.length >= 2 && (
          <button className="row" onClick={() => onPick('both')}>{parents.map((m) => <MemberTag key={m.id} member={m} size={26} />)} Båda
            {parents.some((x) => busyAt(events, x.id, pick.at)) && <span className="small error" style={{ marginLeft: 'auto' }}>någon jobbar</span>}</button>
        )}
        <button onClick={() => { const n = prompt('Vem? (t.ex. Mormor, Kompisens pappa)'); if (n?.trim()) onPick(n.trim()) }}>Någon annan…</button>
        <button className="link" onClick={() => onPick(null)}>Ingen bestämd</button>
      </div>
    </Sheet>
  )
}
