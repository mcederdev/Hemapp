import { useState } from 'react'
import { useTable } from '../useTable'
import { startOfWeek, addDays, today, prettyDay } from '../lib/dates'
import { completeChore } from './Chores'

export default function Kids({ householdId, members, household, households, go }) {
  const chores = useTable('chores', householdId)
  const kids = members.filter((m) => m.role === 'child')
  const [kidId, setKidId] = useState(null)
  const kid = kids.find((k) => k.id === kidId) || kids[0]
  const t = today()
  const week = startOfWeek(t)
  const perStar = Number(household?.kr_per_star ?? 5)

  if (!kid) {
    return (
      <section>
        <h2>Barnens sida</h2>
        <p className="muted">Lägg till barnet under Familj först.</p>
        <button className="primary" onClick={() => go('family')}>Till Familj</button>
      </section>
    )
  }

  const theirs = chores.rows.filter((c) => c.assigned_to === kid.id)
  const todo = theirs.filter((c) => !c.done && (!c.due_date || c.due_date <= addDays(t, 1)))
    .sort((a, b) => (a.due_date || '9').localeCompare(b.due_date || '9'))
  const doneIn = (from, to) => theirs.filter((c) => c.done && c.done_at && c.done_at.slice(0, 10) >= from && c.done_at.slice(0, 10) < to)
  const thisWeek = doneIn(week, addDays(week, 7))
  const lastWeek = doneIn(addDays(week, -7), week)
  const stars = (list) => list.reduce((s, c) => s + (c.stars || 0), 0)
  const starsNow = stars(thisWeek)

  return (
    <section className="kids">
      {kids.length > 1 && (
        <div className="seg mb">
          {kids.map((k) => <button key={k.id} className={k.id === kid.id ? 'active' : ''} onClick={() => setKidId(k.id)}>{k.name}</button>)}
        </div>
      )}
      <div className="card kid-hero" style={{ borderColor: kid.color }}>
        <h2>Hej {kid.name}! 👋</h2>
        <div className="stars">{starsNow > 0 ? '⭐'.repeat(Math.min(starsNow, 30)) : 'Inga stjärnor än den här veckan'}</div>
        <p className="big-text">{starsNow} ⭐ = <strong>{starsNow * perStar} kr</strong> i veckopeng</p>
        {lastWeek.length > 0 && <p className="muted small">Förra veckan: {stars(lastWeek)} ⭐ ({stars(lastWeek) * perStar} kr)</p>}
      </div>

      <h3>Att göra</h3>
      <div className="kid-tasks">
        {todo.map((c) => (
          <button key={c.id} className="kid-task" onClick={() => completeChore(chores, c)}>
            <span className="box" />
            <span className="grow">
              {c.title}
              {c.due_date && <span className="muted small"> · {c.due_date === t ? 'idag' : prettyDay(c.due_date)}</span>}
            </span>
            {c.stars > 0 && <span>⭐{c.stars}</span>}
          </button>
        ))}
        {todo.length === 0 && <p className="muted">Inget att göra just nu. Bra jobbat! 🎉</p>}
      </div>

      {thisWeek.length > 0 && (
        <>
          <h3>Klart den här veckan</h3>
          <ul className="list done">
            {thisWeek.map((c) => <li key={c.id} className="is-done"><span>✓ {c.title}</span>{c.stars > 0 && <span>⭐{c.stars}</span>}</li>)}
          </ul>
        </>
      )}

      <details className="card mt">
        <summary>Inställningar för veckopeng</summary>
        <label className="row between mt">
          <span>Kronor per stjärna</span>
          <input type="number" inputMode="numeric" defaultValue={perStar} style={{ maxWidth: 100 }}
            onBlur={(e) => household && households.update(household.id, { kr_per_star: Number(e.target.value) || 0 })} />
        </label>
        <p className="muted small">Ge sysslor stjärnor när du lägger till dem under Sysslor och väljer barnet.</p>
      </details>
    </section>
  )
}
