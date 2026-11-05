import { useState } from 'react'
import { useTable } from '../useTable'
import { today, addDays, weekdayName } from '../lib/dates'
import { buzz } from './Swipe'

export const MOODS = [[1, '😢', 'Ledsen'], [2, '🙁', 'Inte så bra'], [3, '😐', 'Sådär'], [4, '🙂', 'Bra'], [5, '😄', 'Jättebra']]

// "Hur mår du idag?" på barnens sida. Senaste veckan syns under.
export default function Mood({ householdId, kid }) {
  const moods = useTable('moods', householdId, 'day')
  const [noting, setNoting] = useState(false)
  const t = today()
  const mine = moods.rows.filter((m) => m.member_id === kid.id)
  const todays = mine.find((m) => m.day === t)
  const set = async (mood) => {
    buzz()
    if (todays) await moods.update(todays.id, { mood })
    else await moods.insert({ member_id: kid.id, day: t, mood })
    if (mood <= 2) setNoting(true)
  }
  const week = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6))
  const last30 = mine.filter((m) => m.day > addDays(t, -30))
  const avg = last30.length ? last30.reduce((a, m) => a + m.mood, 0) / last30.length : null
  return (
    <div className="card mood mt" style={{ '--c': kid.color }}>
      <strong>{todays ? `Idag: ${MOODS[todays.mood - 1][2].toLowerCase()}` : `Hur mår du idag, ${kid.name}?`}</strong>
      <div className="mood-row">
        {MOODS.map(([v, e, l]) => <button key={v} className={todays?.mood === v ? 'on' : ''} onClick={() => set(v)} aria-label={l}>{e}</button>)}
      </div>
      {noting && todays && (
        <form className="row" onSubmit={(e) => { e.preventDefault(); moods.update(todays.id, { note: e.target.note.value || null }); setNoting(false) }}>
          <input name="note" placeholder="Vill du berätta vad som hänt?" defaultValue={todays.note || ''} autoFocus />
          <button>Spara</button>
        </form>
      )}
      <div className="mood-week">
        {week.map((d) => { const m = mine.find((x) => x.day === d); return <span key={d} title={m?.note || ''}><i>{m ? MOODS[m.mood - 1][1] : '·'}</i><small className="muted cap">{weekdayName(d, 'short').replace('.', '')}</small></span> })}
      </div>
      {avg && last30.length >= 5 && <p className="muted small">Senaste månaden: mest {MOODS[Math.round(avg) - 1][2].toLowerCase()} {MOODS[Math.round(avg) - 1][1]}{last30.some((m) => m.note) ? ` · ${last30.filter((m) => m.note).length} anteckningar` : ''}</p>}
      {last30.filter((m) => m.note && m.day !== t).slice(-3).map((m) => <p key={m.id} className="muted small">{MOODS[m.mood - 1][1]} {weekdayName(m.day, 'short')}: {m.note}</p>)}
    </div>
  )
}
