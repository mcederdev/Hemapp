import { useTable } from '../useTable'
import { expandEvents, onDay, timeOf } from '../lib/events'
import { today, parseDay } from '../lib/dates'
import { completeChore } from './Chores'
import { MemberTag } from './MemberPicker'

export default function Today({ householdId, members, go, me }) {
  const events = useTable('events', householdId, 'starts_at')
  const chores = useTable('chores', householdId)
  const meals = useTable('meal_plan', householdId, 'day')
  const items = useTable('shopping_items', householdId)
  const lists = useTable('shopping_lists', householdId)
  const byId = Object.fromEntries(members.map((m) => [m.id, m]))

  const t = today()
  const d0 = parseDay(t), d1 = new Date(d0); d1.setDate(d1.getDate() + 1)
  const todays = expandEvents(events.rows, d0, d1).filter((o) => onDay(o, d0))
  const tomorrow = new Date(d1); const d2 = new Date(d1); d2.setDate(d2.getDate() + 1)
  const tomorrows = expandEvents(events.rows, tomorrow, d2).filter((o) => onDay(o, tomorrow))
  const due = chores.rows.filter((c) => !c.done && c.due_date && c.due_date <= t)
  const open = chores.rows.filter((c) => !c.done && !c.due_date)
  const dinner = meals.rows.find((m) => m.day === t)
  const defaultList = lists.rows.find((l) => l.is_default)
  const toBuy = items.rows.filter((i) => !i.done && i.list_id === defaultList?.id).length
  const otherLists = lists.rows.filter((l) => !l.is_default && !l.archived && l.for_date && l.for_date >= t)

  const complete = (c) => completeChore(chores, c)

  const hour = new Date().getHours()
  const greet = hour < 10 ? 'God morgon' : hour < 17 ? 'Hej' : 'God kväll'

  return (
    <section>
      <h2>{greet}, {me.name}!</h2>
      <p className="muted cap">{d0.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

      <div className="card tap" onClick={() => go('meals')}>
        <div className="row between"><h3>🍝 Middag ikväll</h3><span className="muted">›</span></div>
        <p className="big-text">{dinner ? dinner.dish : <span className="muted">Inte bestämt än. Tryck för tips.</span>}</p>
      </div>

      <div className="card">
        <div className="row between tap" onClick={() => go('calendar')}><h3>📅 Idag</h3><span className="muted">›</span></div>
        {todays.length === 0 && <p className="muted">Inget i kalendern idag.</p>}
        <ul className="plain">
          {todays.map((o) => (
            <li key={o.key} className="row between">
              <span><strong className="time">{o.all_day ? 'Heldag' : timeOf(o.start)}</strong> {o.title}</span>
              <MemberTag member={byId[o.member_id]} />
            </li>
          ))}
        </ul>
        {tomorrows.length > 0 && (
          <p className="muted small">Imorgon: {tomorrows.map((o) => (o.all_day ? '' : timeOf(o.start) + ' ') + o.title).join(', ')}</p>
        )}
      </div>

      <div className="card">
        <div className="row between tap" onClick={() => go('chores')}><h3>✅ Sysslor att göra</h3><span className="muted">›</span></div>
        {due.length === 0 && open.length === 0 && <p className="muted">Allt är gjort 🎉</p>}
        <ul className="plain">
          {[...due, ...open].slice(0, 8).map((c) => (
            <li key={c.id} className="row between">
              <label className="check">
                <input type="checkbox" checked={false} onChange={() => complete(c)} />
                <span>{c.title}{c.due_date && c.due_date < t && <span className="error small"> (sen)</span>}</span>
              </label>
              <span className="meta">{c.stars > 0 && <span className="small">⭐{c.stars}</span>}<MemberTag member={byId[c.assigned_to]} /></span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card tap" onClick={() => go('shopping')}>
        <div className="row between"><h3>🛒 Inköpslistan</h3><span className="muted">›</span></div>
        <p>{toBuy === 0 ? 'Inget att handla just nu.' : `${toBuy} ${toBuy === 1 ? 'vara' : 'varor'} att handla.`}</p>
        {otherLists.map((l) => <p key={l.id} className="muted small">{l.name} {l.for_date && `(${parseDay(l.for_date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })})`}</p>)}
      </div>
    </section>
  )
}
