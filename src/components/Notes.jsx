import { useState } from 'react'
import { useTable } from '../useTable'
import { today, prettyDay } from '../lib/dates'
import { nextBirthday, daysUntil } from '../lib/yearly'
import { MemberTag } from './MemberPicker'
import Sheet from './Sheet'

const COLORS = { yellow: '#ffe98a', pink: '#ffc4d6', blue: '#c4e0ff', green: '#c8f0c8' }

// Lappar på kylskåpet: korta meddelanden till familjen
export default function Notes({ householdId, members, me, big = false }) {
  const notes = useTable('notes', householdId)
  const [adding, setAdding] = useState(null)
  const t = today()
  const byId = Object.fromEntries(members.map((m) => [m.id, m]))
  const visible = notes.rows.filter((n) => !n.until || n.until >= t)
  const save = async (e) => {
    e.preventDefault()
    if (!adding.text.trim()) return
    await notes.insert({ text: adding.text.trim(), color: adding.color, author: me?.id || null, until: adding.until || null })
    setAdding(null)
  }
  return (
    <>
      <div className={`notes ${big ? 'big' : ''}`}>
        {visible.map((n) => (
          <div key={n.id} className="note" style={{ background: COLORS[n.color] || COLORS.yellow }}>
            <button className="note-x" onClick={() => notes.remove(n.id)} aria-label="Ta bort lappen">✕</button>
            <p>{n.text}</p>
            <span className="note-meta">{byId[n.author] && <MemberTag member={byId[n.author]} size={18} />}{n.until && <span>till {prettyDay(n.until)}</span>}</span>
          </div>
        ))}
        {!big && <button className="note add" onClick={() => setAdding({ text: '', color: 'yellow', until: '' })}>+ Lapp</button>}
      </div>
      {adding && (
        <Sheet title="Ny lapp" onClose={() => setAdding(null)}>
          <form className="stack" onSubmit={save}>
            <textarea className="ta" rows={3} placeholder="T.ex. Glöm inte gympapåsen!" value={adding.text} onChange={(e) => setAdding({ ...adding, text: e.target.value })} autoFocus />
            <div className="row">
              {Object.entries(COLORS).map(([k, c]) => <button type="button" key={k} className={`swatch ${adding.color === k ? 'on' : ''}`} style={{ background: c }} onClick={() => setAdding({ ...adding, color: k })} aria-label={k} />)}
            </div>
            <label className="field"><span className="muted small">Försvinner efter (valfritt)</span><input type="date" value={adding.until} min={t} onChange={(e) => setAdding({ ...adding, until: e.target.value })} /></label>
            <button className="primary">Sätt upp lappen</button>
          </form>
        </Sheet>
      )}
    </>
  )
}

// "Snart": födelsedagar och påminnelser som är inom sin påminnelsetid
export function Soon({ householdId, go }) {
  const reminders = useTable('reminders', householdId, 'due_date')
  const birthdays = useTable('birthdays', householdId)
  const t = today()
  const items = [
    ...reminders.rows.map((r) => ({ id: r.id, emoji: r.emoji, text: r.title, n: daysUntil(t, r.due_date), show: daysUntil(t, r.due_date) <= Math.max(r.remind_days, 0) })),
    ...birthdays.rows.map((b) => { const x = nextBirthday(b.day, t); return { id: b.id, emoji: '🎂', text: `${b.name}${b.year_known ? ` fyller ${x.age}` : ' fyller år'}`, n: x.daysLeft, show: x.daysLeft <= Math.max(b.remind_days, 0) } })
  ].filter((x) => x.show).sort((a, b) => a.n - b.n)
  if (!items.length) return null
  return (
    <div className="card compact">
      <button className="card-head" onClick={() => go('reminders')}>
        <span className="row"><strong>⏰ Snart</strong></span>
      </button>
      <ul className="list flush">
        {items.map((x) => <li key={x.id}><span>{x.emoji} {x.text}</span><span className={`small ${x.n < 0 ? 'error' : 'muted'}`}>{x.n === 0 ? 'idag' : x.n === 1 ? 'imorgon' : x.n < 0 ? `${-x.n} dagar sen` : `om ${x.n} dagar`}</span></li>)}
      </ul>
    </div>
  )
}
