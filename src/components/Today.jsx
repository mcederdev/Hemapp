import { useState } from 'react'
import { useTable } from '../useTable'
import { COMMON_DISHES } from '../lib/defaults'
import { expandEvents, dayList, shortLine } from '../lib/events'
import { today, parseDay } from '../lib/dates'
import { completeChore } from './Chores'
import { MemberTag } from './MemberPicker'
import { Picker } from './Meals'
import EventRow from './EventRow'
import SwipeRow, { Check } from './Swipe'
import Icon from './Icon'

export default function Today({ householdId, members, go, me }) {
  const events = useTable('events', householdId, 'starts_at')
  const chores = useTable('chores', householdId)
  const meals = useTable('meal_plan', householdId, 'day')
  const dishes = useTable('dishes', householdId)
  const items = useTable('shopping_items', householdId)
  const lists = useTable('shopping_lists', householdId)
  const [picking, setPicking] = useState(false)
  const byId = Object.fromEntries(members.map((m) => [m.id, m]))

  const t = today()
  const d0 = parseDay(t), d1 = new Date(d0); d1.setDate(d1.getDate() + 1)
  const d2 = new Date(d1); d2.setDate(d2.getDate() + 1)
  const todays = dayList(expandEvents(events.rows, d0, d1), d0)
  const tomorrows = dayList(expandEvents(events.rows, d1, d2), d1).filter((o) => o.all_day || o.start >= d1)
  const due = chores.rows.filter((c) => !c.done && c.due_date && c.due_date <= t)
  const open = chores.rows.filter((c) => !c.done && !c.due_date)
  const todo = [...due, ...open].slice(0, 6)
  const dinner = meals.rows.find((m) => m.day === t)
  const defaultList = lists.rows.find((l) => l.is_default)
  const toBuy = items.rows.filter((i) => !i.done && i.list_id === defaultList?.id)
  const otherLists = lists.rows.filter((l) => !l.is_default && !l.archived && l.for_date && l.for_date >= t)

  const own = dishes.rows.map((d) => ({ ...d, own: true }))
  const allDishes = [...own, ...COMMON_DISHES.filter((c) => !own.some((o) => o.name.toLowerCase() === c.name.toLowerCase()))]
  const setDinner = async (dish) => {
    if (dinner) await meals.update(dinner.id, { dish })
    else await meals.insert({ day: t, dish })
    setPicking(false)
  }

  const hour = new Date().getHours()
  const greet = hour < 10 ? 'God morgon' : hour < 17 ? 'Hej' : 'God kväll'

  return (
    <section className="today">
      <header className="today-head">
        <h2>{greet}, {me.name}!</h2>
        <p className="muted cap">{d0.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </header>

      <div className="hero">
        <div className="hero-label"><Icon name="food" size={16} /> Middag ikväll</div>
        <div className="hero-dish">{dinner ? dinner.dish : 'Inte bestämt än'}</div>
        <div className="row">
          <button className="hero-btn" onClick={() => setPicking(true)}><Icon name="dice" size={18} /> {dinner ? 'Byt' : 'Tips'}</button>
          <button className="hero-btn ghost" onClick={() => go('meals')}>Veckomeny</button>
        </div>
      </div>

      <Card icon="calendar" title="Idag" onMore={() => go('calendar')}>
        {todays.length === 0
          ? <p className="muted small pad">Inget i kalendern idag.</p>
          : <ul className="list flush">{todays.map((o) => <EventRow key={o.key} occ={o} day={d0} byId={byId} />)}</ul>}
        {tomorrows.length > 0 && (
          <p className="muted small pad">Imorgon: {tomorrows.map(shortLine).join(', ')}</p>
        )}
      </Card>

      <Card icon="checks" title="Sysslor" count={due.length + open.length} onMore={() => go('chores')}>
        {todo.length === 0
          ? <p className="muted small pad">Allt är gjort.</p>
          : (
            <ul className="list flush">
              {todo.map((c) => (
                <SwipeRow key={c.id} onCheck={() => completeChore(chores, c)}>
                  <span className="check">
                    <Check checked={false} onChange={() => completeChore(chores, c)} label={`Bocka av ${c.title}`} />
                    <span>{c.title}{c.due_date && c.due_date < t && <span className="error small"> · sen</span>}</span>
                  </span>
                  <span className="meta">
                    {c.stars > 0 && <span className="stars-sm"><Icon name="star" size={14} />{c.stars}</span>}
                    <MemberTag member={byId[c.assigned_to]} size={24} />
                  </span>
                </SwipeRow>
              ))}
            </ul>
          )}
      </Card>

      <Card icon="cart" title="Handla" count={toBuy.length} onMore={() => go('shopping')}>
        <p className="small pad">
          {toBuy.length === 0 ? <span className="muted">Inget att handla just nu.</span> : toBuy.slice(0, 6).map((i) => i.name).join(', ') + (toBuy.length > 6 ? ' …' : '')}
        </p>
        {otherLists.map((l) => <p key={l.id} className="muted small pad">{l.name} · {parseDay(l.for_date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}</p>)}
      </Card>

      {picking && <Picker day={t} all={allDishes} onPick={setDinner} onClose={() => setPicking(false)} />}
    </section>
  )
}

function Card({ icon, title, count, onMore, children }) {
  return (
    <div className="card compact">
      <button className="card-head" onClick={onMore}>
        <span className="row"><Icon name={icon} size={18} /> <strong>{title}</strong>{count > 0 && <span className="count">{count}</span>}</span>
        <Icon name="chevron" size={18} className="muted" />
      </button>
      {children}
    </div>
  )
}
