import { useState } from 'react'
import { useNow } from '../lib/useNow'
import { useTable } from '../useTable'
import { COMMON_DISHES } from '../lib/defaults'
import { expandEvents, dayList, shortLine, timeOf } from '../lib/events'
import { today, parseDay, addDays, startOfWeek } from '../lib/dates'
import { completeChore } from './Chores'
import { MemberTag } from './MemberPicker'
import { Picker } from './Meals'
import EventRow from './EventRow'
import FamilyStrip, { forFocus } from './FamilyStrip'
import SwipeRow, { Check } from './Swipe'
import Icon from './Icon'
import ShopForDishes from './ShopForDishes'
import Notes, { Soon, NoteButton } from './Notes'
import { CustodyLine } from './Custody'
import Pickups from './Pickups'

// Bygger dagens flöde: händelser och middag i tidsordning, med nu-linjen på rätt plats
export function buildFlow({ events, day, dinner, now, focus, withDinner = true }) {
  const d0 = new Date(day); d0.setHours(0, 0, 0, 0)
  const d1 = new Date(d0); d1.setDate(d1.getDate() + 1)
  const occ = dayList(expandEvents(events.filter((e) => forFocus(focus, e.member_id)), d0, d1), d0)
  const allDay = occ.filter((o) => o.all_day || (o.start < d0 && o.end && o.end >= d1))
  const timed = occ.filter((o) => !allDay.includes(o)).map((o) => ({ type: 'event', at: o.start < d0 ? d0 : o.start, end: o.end || o.start, occ: o }))
  const dinnerAt = new Date(d0); dinnerAt.setHours(18, 0, 0, 0)
  if (withDinner) timed.push({ type: 'dinner', at: dinnerAt, end: new Date(dinnerAt.getTime() + 3600000), dinner })
  timed.sort((a, b) => a.at - b.at)
  const isToday = now >= d0 && now < d1
  if (isToday) {
    const i = timed.findIndex((x) => x.at > now)
    timed.splice(i === -1 ? timed.length : i, 0, { type: 'now', at: now })
  }
  return { allDay, flow: timed, d0 }
}

export default function Today({ householdId, members, people, go, me, focus, setFocus, custody, linked }) {
  const events = useTable('events', householdId, 'starts_at')
  const chores = useTable('chores', householdId)
  const meals = useTable('meal_plan', householdId, 'day')
  const dishes = useTable('dishes', householdId)
  const items = useTable('shopping_items', householdId)
  const lists = useTable('shopping_lists', householdId)
  const [picking, setPicking] = useState(false)
  const [shopFor, setShopFor] = useState(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const now = useNow()
  const byId = Object.fromEntries(members.map((m) => [m.id, m]))

  const t = today()
  const d0 = parseDay(t), d1 = new Date(d0); d1.setDate(d1.getDate() + 1)
  const d2 = new Date(d1); d2.setDate(d2.getDate() + 1)
  const dinner = meals.rows.find((m) => m.day === t)
  const { allDay, flow } = buildFlow({ events: events.rows, day: d0, dinner, now, focus, withDinner: false })
  const tomorrows = dayList(expandEvents(events.rows.filter((e) => forFocus(focus, e.member_id)), d1, d2), d1).filter((o) => o.all_day || o.start >= d1)

  const mine = chores.rows.filter((c) => forFocus(focus, c.done ? c.done_by || c.assigned_to : c.assigned_to))
  // Idag: det som ska göras idag eller är sent, plus veckans/månadens återkommande
  const weekEnd = addDays(startOfWeek(t), 6)
  const todo = mine.filter((c) => !c.done && (!c.due_date || c.due_date <= t || (c.plan_id && c.due_date <= weekEnd)))
    .sort((a, b) => (a.due_date || '9').localeCompare(b.due_date || '9'))
  const doneToday = mine.filter((c) => c.done && c.done_at && c.done_at.slice(0, 10) === t)
  const overdue = {}
  for (const c of chores.rows) if (!c.done && c.due_date && c.due_date < t && c.assigned_to) overdue[c.assigned_to] = (overdue[c.assigned_to] || 0) + 1

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

  const hour = now.getHours()
  const greet = hour < 10 ? 'God morgon' : hour < 17 ? 'Hej' : 'God kväll'
  const focusName = byId[focus]?.name

  return (
    <section className="today">
      <header className="today-head">
        <h2>{greet}, {me.name}!</h2>
        <p className="muted cap">{d0.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </header>

      <FamilyStrip members={members} focus={focus} setFocus={setFocus} counts={overdue} extra={<NoteButton onClick={() => setNoteOpen(true)} />} />
      <Notes householdId={householdId} members={members} me={me} open={noteOpen} setOpen={setNoteOpen} />
      <CustodyLine custody={(custody || []).filter((c) => forFocus(focus, c.child_id))} members={members} me={me} linked={linked} />
      <Pickups householdId={householdId} members={members} people={people} me={me} custody={custody} events={events.rows} />

      <div className="hero">
        <div className="hero-label"><Icon name="food" size={16} /> Middag ikväll</div>
        <div className="hero-dish">{dinner ? dinner.dish : 'Inte bestämt än'}</div>
        <div className="row">
          <button className="hero-btn" onClick={() => setPicking(true)}><Icon name="dice" size={18} /> {dinner ? 'Byt' : 'Tips'}</button>
          {dinner && <button className="hero-btn" onClick={() => setShopFor([dinner.dish])}><Icon name="cart" size={18} /> Varor</button>}
          <button className="hero-btn ghost" onClick={() => go('meals')}>Veckomeny</button>
        </div>
      </div>

      <div className="card compact">
        <button className="card-head" onClick={() => go('calendar')}>
          <span className="row"><Icon name="calendar" size={18} /> <strong>{focusName ? `${focusName}s dag` : 'Dagen'}</strong></span>
          <Icon name="chevron" size={18} className="muted" />
        </button>
        <ul className="list flush flow">
          {allDay.map((o) => <EventRow key={o.key} occ={o} day={d0} byId={byId} />)}
          {flow.map((x) => {
            if (x.type === 'now') return (
              <li key="now" className="now-line" aria-label={`Klockan är ${timeOf(now)}`}><span>{timeOf(now)}</span><i /></li>
            )
            const past = x.end < now
            if (x.type === 'dinner') return (
              <li key="dinner" className={`tl dinner ${past ? 'past' : ''}`}>
                <div className="tl-time"><strong>18:00</strong></div>
                <div className="tl-bar" style={{ background: 'var(--accent)' }} />
                <div className="tl-body tap" onClick={() => setPicking(true)}>
                  <div className="tl-title">🍽 {dinner ? dinner.dish : 'Middag inte bestämd'}</div>
                  <div className="muted small">Middag{toBuy.length > 0 ? ` · ${toBuy.length} varor på listan` : ''}</div>
                </div>
                <button className="chip" onClick={() => setPicking(true)}><Icon name="dice" size={15} /> {dinner ? 'Byt' : 'Tips'}</button>
              </li>
            )
            return <EventRow key={x.occ.key} occ={x.occ} day={d0} byId={byId} className={past ? 'past' : ''} />
          })}
        </ul>
        {allDay.length + flow.filter((x) => x.type !== 'now').length === 0 && <p className="muted small pad">Inget i kalendern idag.</p>}
        {tomorrows.length > 0 && <p className="muted small pad">Imorgon: {tomorrows.map(shortLine).join(', ')}</p>}
      </div>

      <div className="card compact">
        <button className="card-head" onClick={() => go('chores')}>
          <span className="row"><Icon name="checks" size={18} /> <strong>Under dagen</strong>{todo.length > 0 && <span className="count">{todo.length}</span>}</span>
          <Icon name="chevron" size={18} className="muted" />
        </button>
        <ul className="list flush">
          {todo.slice(0, 8).map((c) => (
            <SwipeRow key={c.id} onCheck={() => completeChore(chores, c, me.id)}>
              <span className="check">
                <Check checked={false} onChange={() => completeChore(chores, c, me.id)} label={`Bocka av ${c.title}`} />
                <span>{c.title}{c.due_date && c.due_date < t && <span className="error small"> · sen</span>}</span>
              </span>
              <span className="meta">
                {c.stars > 0 && <span className="stars-sm"><Icon name="star" size={14} />{c.stars}</span>}
                <MemberTag member={byId[c.assigned_to]} size={24} />
              </span>
            </SwipeRow>
          ))}
          {doneToday.map((c) => (
            <li key={c.id} className="is-done">
              <span className="check">
                <Check checked onChange={() => chores.update(c.id, { done: false, done_at: null })} label={`Ångra ${c.title}`} />
                <span>{c.title}</span>
              </span>
              <span className="muted small">{[byId[c.done_by || c.assigned_to]?.name, c.stars > 0 && `${c.stars} ⭐`].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
          {todo.length === 0 && doneToday.length === 0 && <li className="muted small">Inga sysslor idag.</li>}
        </ul>
      </div>

      <Soon householdId={householdId} go={go} />

      <div className="card compact">
        <button className="card-head" onClick={() => go('shopping')}>
          <span className="row"><Icon name="cart" size={18} /> <strong>Handla</strong>{toBuy.length > 0 && <span className="count">{toBuy.length}</span>}</span>
          <Icon name="chevron" size={18} className="muted" />
        </button>
        <p className="small pad">
          {toBuy.length === 0 ? <span className="muted">Inget att handla just nu.</span> : toBuy.slice(0, 6).map((i) => i.name).join(', ') + (toBuy.length > 6 ? ' …' : '')}
        </p>
        {otherLists.map((l) => <p key={l.id} className="muted small pad">{l.name} · {parseDay(l.for_date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}</p>)}
      </div>

      {shopFor && <ShopForDishes householdId={householdId} me={me} dishes={shopFor} onClose={() => setShopFor(null)} />}
      {picking && <Picker day={t} all={allDishes} onPick={setDinner} onClose={() => setPicking(false)} />}
    </section>
  )
}
