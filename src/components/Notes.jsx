import { useState } from 'react'
import { useTable } from '../useTable'
import { today, prettyDay } from '../lib/dates'
import { nextBirthday, daysUntil } from '../lib/yearly'
import { medicineStatus } from '../lib/medicine'
import { MemberTag } from './MemberPicker'
import Sheet from './Sheet'

const COLORS = { yellow: '#ffe98a', pink: '#ffc4d6', blue: '#c4e0ff', green: '#c8f0c8' }
const STICKERS = ['❤️', '💕', '😘', '🥰', '🤗', '⭐', '🌟', '🎉', '👏', '💪', '☀️', '🌈', '🌸', '☕', '🍕', '🐶', '😂', '🙏']

// Lappar på kylskåpet: korta meddelanden till familjen
const blank = () => ({ text: '', color: 'yellow', until: '', sticker: '', to: '' })

// Liten post-it-knapp för att sätta upp en ny lapp (ligger i familjeremsan på Idag)
export function NoteButton({ onClick }) {
  return <button className="note-mini" onClick={onClick} aria-label="Ny lapp"><span>+</span>Lapp</button>
}

export default function Notes({ householdId, members, me, guests = [], guest = null, big = false, open = false, setOpen = null }) {
  const notes = useTable('notes', householdId)
  const [own, setOwn] = useState(null)
  // Formuläret kan öppnas utifrån (knappen i familjeremsan)
  const adding = setOpen ? (open ? (own || blank()) : null) : own
  const setAdding = (v) => { setOwn(v); if (setOpen && !v) setOpen(false) }
  const t = today()
  const byId = Object.fromEntries([...members, ...guests.map((g) => ({ ...g, short: g.name.slice(0, 1).toUpperCase(), role: 'guest' }))].map((m) => [m.id, m]))
  const visible = notes.rows.filter((n) => !n.until || n.until >= t)
  const save = async (e) => {
    e.preventDefault()
    if (!adding.text.trim() && !adding.sticker) return
    await notes.insert({ text: adding.text.trim(), sticker: adding.sticker || null, to_member: adding.to || null, color: adding.color, author: guest ? null : me?.id || null, ...(guest ? { guest_author: guest.id } : {}), until: adding.until || null })
    setAdding(null)
  }
  return (
    <>
      {(visible.length > 0 || (!big && !setOpen)) && <div className={`notes ${big ? 'big' : ''}`}>
        {visible.map((n) => (
          <div key={n.id} className="note" style={{ background: COLORS[n.color] || COLORS.yellow }}>
            {!guest && <button className="note-x" onClick={() => notes.remove(n.id)} aria-label="Ta bort lappen">✕</button>}
            {byId[n.to_member] && <span className="note-to">Till {byId[n.to_member].name}</span>}
            {n.sticker && <span className={`note-sticker ${n.text ? '' : 'solo'}`}>{n.sticker}</span>}
            {n.text && <p>{n.text}</p>}
            <span className="note-meta">{byId[n.author || n.guest_author] && <MemberTag member={byId[n.author || n.guest_author]} size={18} />}{n.until && <span>till {prettyDay(n.until)}</span>}</span>
          </div>
        ))}
        {!big && !setOpen && <button className="note add" onClick={() => setAdding(blank())}>+ Lapp</button>}
      </div>}
      {adding && (
        <Sheet title="Ny lapp" onClose={() => setAdding(null)}>
          <form className="stack" onSubmit={save}>
            <textarea className="ta" rows={3} placeholder="T.ex. Glöm inte gympapåsen! (eller bara en figur)" value={adding.text} onChange={(e) => setAdding({ ...adding, text: e.target.value })} autoFocus />
            <div className="stickers">
              {STICKERS.map((x) => <button type="button" key={x} className={adding.sticker === x ? 'on' : ''} onClick={() => setAdding({ ...adding, sticker: adding.sticker === x ? '' : x })} aria-label={`Figur ${x}`}>{x}</button>)}
            </div>
            {members.filter((m) => m.id !== me?.id).length > 0 && (
              <div className="chips">
                <span className="muted small">Till:</span>
                <button type="button" className={`chip ${!adding.to ? 'on' : ''}`} onClick={() => setAdding({ ...adding, to: '' })}>Alla</button>
                {members.filter((m) => m.id !== me?.id && m.household_id === (me?.household_id || guest?.household_id)).map((m) => <button type="button" key={m.id} className={`chip ${adding.to === m.id ? 'on' : ''}`} onClick={() => setAdding({ ...adding, to: m.id })}>{m.name}</button>)}
              </div>
            )}
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
export function Soon({ householdId, go, bare = false }) {
  const reminders = useTable('reminders', householdId, 'due_date')
  const birthdays = useTable('birthdays', householdId)
  const meds = useTable('medicines', householdId)
  const pantry = useTable('pantry_items', householdId, 'best_before')
  const subs = useTable('subscriptions', householdId)
  const t = today()
  const items = [
    ...pantry.rows.filter((x) => x.best_before).map((x) => ({ id: x.id, emoji: '🥛', text: `${x.name} ${daysUntil(t, x.best_before) < 0 ? 'har gått ut' : 'går ut'}`, n: daysUntil(t, x.best_before), show: daysUntil(t, x.best_before) <= 1 })),
    ...subs.rows.filter((x) => x.cancel_by).map((x) => ({ id: x.id, emoji: '✂️', text: `Säg upp ${x.name}`, n: daysUntil(t, x.cancel_by), show: daysUntil(t, x.cancel_by) <= 7 && daysUntil(t, x.cancel_by) >= -1 })),
    ...meds.rows.map((m) => { const s = medicineStatus(m, t); return { id: m.id, emoji: '💊', text: `${m.name} ${s.left <= 0 ? 'är slut' : 'tar slut'}`, n: s.daysLeft, show: !(m.spare > 0) && s.daysLeft <= m.remind_days } }),
    ...reminders.rows.map((r) => ({ id: r.id, emoji: r.emoji, text: r.title, n: daysUntil(t, r.due_date), show: daysUntil(t, r.due_date) <= Math.max(r.remind_days, 0) })),
    ...birthdays.rows.map((b) => { const x = nextBirthday(b.day, t); return { id: b.id, emoji: '🎂', text: `${b.name}${b.year_known ? ` fyller ${x.age}` : ' fyller år'}`, n: x.daysLeft, show: x.daysLeft <= Math.max(b.remind_days, 0) } })
  ].filter((x) => x.show).sort((a, b) => a.n - b.n)
  if (!items.length) return bare ? <p className="muted small">Inga påminnelser eller födelsedagar de närmaste dagarna.</p> : null
  if (bare) return <ul className="list flush">{items.map((x) => <li key={x.id}><span>{x.emoji} {x.text}</span><span className={`small ${x.n < 0 ? 'error' : 'muted'}`}>{x.n === 0 ? 'idag' : x.n === 1 ? 'imorgon' : x.n < 0 ? `${-x.n} dagar sen` : `om ${x.n} dagar`}</span></li>)}</ul>
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
