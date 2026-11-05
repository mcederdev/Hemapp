import { useEffect } from 'react'
import { useTable } from '../useTable'
import { expandEvents, dayList, timeOf, shortLine } from '../lib/events'
import { today, parseDay, addDays, startOfWeek, weekdayName } from '../lib/dates'
import { useNow, useWakeLock } from '../lib/useNow'
import { buildFlow } from './Today'
import { completeChore } from './Chores'
import { MemberTag } from './MemberPicker'
import { dishColor } from './Meals'
import { COMMON_DISHES } from '../lib/defaults'
import EventRow from './EventRow'
import Notes, { Soon } from './Notes'

// Köksskärm för en iPad på kylskåpet: klocka, dagen, sysslor, mat och inköp på en skärm
export default function Kitchen({ householdId, members, me, onExit }) {
  useWakeLock(true)
  const now = useNow(15000)
  const events = useTable('events', householdId, 'starts_at')
  const chores = useTable('chores', householdId)
  const meals = useTable('meal_plan', householdId, 'day')
  const dishes = useTable('dishes', householdId)
  const items = useTable('shopping_items', householdId)
  const lists = useTable('shopping_lists', householdId)
  const byId = Object.fromEntries(members.map((m) => [m.id, m]))
  useEffect(() => { document.documentElement.classList.add('kiosk'); return () => document.documentElement.classList.remove('kiosk') }, [])

  const t = today()
  const d0 = parseDay(t), d1 = parseDay(addDays(t, 1)), d2 = parseDay(addDays(t, 2))
  const dinner = meals.rows.find((m) => m.day === t)
  const { allDay, flow } = buildFlow({ events: events.rows, day: d0, dinner, now, focus: null })
  const tomorrow = dayList(expandEvents(events.rows, d1, d2), d1).filter((o) => o.all_day || o.start >= d1)
  const todo = chores.rows.filter((c) => !c.done && (!c.due_date || c.due_date <= t))
  const defaultList = lists.rows.find((l) => l.is_default)
  const toBuy = items.rows.filter((i) => !i.done && i.list_id === defaultList?.id)
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(t), i))
  const catOf = (dish) => [...dishes.rows, ...COMMON_DISHES].find((d) => d.name.toLowerCase() === dish?.toLowerCase())?.category

  return (
    <div className="kitchen">
      <header className="k-head">
        <div className="k-clock">{timeOf(now)}</div>
        <div>
          <div className="k-date cap">{now.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <div className="muted">Middag: <strong>{dinner?.dish || 'inte bestämd'}</strong></div>
        </div>
        <button className="k-exit" onClick={onExit} aria-label="Stäng köksskärmen">✕</button>
      </header>

      <div className="k-grid">
        <section className="k-card k-day">
          <h3>Idag</h3>
          <ul className="list flush flow">
            {allDay.map((o) => <EventRow key={o.key} occ={o} day={d0} byId={byId} />)}
            {flow.map((x) => x.type === 'now'
              ? <li key="now" className="now-line"><span>{timeOf(now)}</span><i /></li>
              : x.type === 'dinner'
                ? <li key="dinner" className={`tl dinner ${x.end < now ? 'past' : ''}`}><div className="tl-time"><strong>18:00</strong></div><div className="tl-bar" style={{ background: 'var(--accent)' }} /><div className="tl-body"><div className="tl-title">🍽 {dinner?.dish || 'Middag'}</div></div></li>
                : <EventRow key={x.occ.key} occ={x.occ} day={d0} byId={byId} className={x.end < now ? 'past' : ''} />)}
          </ul>
          {tomorrow.length > 0 && <p className="muted small pad">Imorgon: {tomorrow.map(shortLine).join(', ')}</p>}
        </section>

        <section className="k-card">
          <h3>Sysslor</h3>
          <div className="k-chores">
            {todo.map((c) => (
              <button key={c.id} className="kid-task" onClick={() => completeChore(chores, c, me?.id)}>
                <span className="box" /><span className="grow">{c.title}</span>
                {c.stars > 0 && <span>⭐{c.stars}</span>}
                <MemberTag member={byId[c.assigned_to]} size={30} />
              </button>
            ))}
            {todo.length === 0 && <p className="muted">Allt är gjort! 🎉</p>}
          </div>
        </section>

        <section className="k-card">
          <h3>Veckans middagar</h3>
          <ul className="k-meals">
            {week.map((d) => {
              const p = meals.rows.find((m) => m.day === d)
              return (
                <li key={d} className={d === t ? 'today' : d < t ? 'past' : ''}>
                  <span className="cap muted">{weekdayName(d, 'short').replace('.', '')}</span>
                  <i style={{ background: p ? dishColor(catOf(p.dish)) : 'var(--line)' }} />
                  <span>{p?.dish || '–'}</span>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="k-card k-notes">
          <h3>Lappar</h3>
          <Notes householdId={householdId} members={members} me={me} big />
          <Soon householdId={householdId} go={() => {}} />
        </section>

        <section className="k-card k-shop">
          <h3>Handla {toBuy.length > 0 && <span className="count">{toBuy.length}</span>}</h3>
          <div className="chips">
            {toBuy.map((i) => <button key={i.id} className="chip big-chip" onClick={() => items.update(i.id, { done: true })}>{i.name}</button>)}
          </div>
          {toBuy.length === 0 && <p className="muted">Listan är tom.</p>}
        </section>
      </div>
    </div>
  )
}
