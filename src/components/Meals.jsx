import { useState } from 'react'
import { useTable } from '../useTable'
import { COMMON_DISHES } from '../lib/defaults'
import { addDays, startOfWeek, today, weekdayName, parseDay } from '../lib/dates'
import Icon from './Icon'
import SwipeRow from './Swipe'
import Sheet, { Fab } from './Sheet'

const shuffle = (a) => [...a].sort(() => Math.random() - 0.5)

export default function Meals({ householdId }) {
  const dishes = useTable('dishes', householdId)
  const plan = useTable('meal_plan', householdId, 'day')
  const [week, setWeek] = useState(startOfWeek(today()))
  const [picking, setPicking] = useState(null) // datum som väljs
  const [view, setView] = useState('week')

  const own = dishes.rows.map((d) => ({ ...d, own: true }))
  const all = [...own, ...COMMON_DISHES.filter((c) => !own.some((o) => o.name.toLowerCase() === c.name.toLowerCase()))]
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))
  const planFor = (d) => plan.rows.find((p) => p.day === d)
  const t = today()

  const setDish = async (day, dish) => {
    const existing = planFor(day)
    if (existing) await plan.update(existing.id, { dish })
    else await plan.insert({ day, dish })
    setPicking(null)
  }
  const fillWeek = async () => {
    const recent = new Set(plan.rows.filter((p) => p.day >= addDays(week, -14)).map((p) => p.dish))
    const pool = shuffle(all.filter((d) => !recent.has(d.name)))
    const empty = days.filter((d) => !planFor(d) && d >= t)
    await plan.insert(empty.map((day, i) => ({ day, dish: (pool[i] || shuffle(all)[0]).name })))
  }

  return (
    <section>
      <h2>Mat</h2>
      <div className="seg mb">
        <button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>Veckomeny</button>
        <button className={view === 'dishes' ? 'active' : ''} onClick={() => setView('dishes')}>Våra rätter</button>
      </div>

      {view === 'week' && (
        <>
          <div className="row between">
            <button onClick={() => setWeek(addDays(week, -7))} aria-label="Förra veckan">‹</button>
            <strong>Vecka {weekNumber(week)}</strong>
            <button onClick={() => setWeek(addDays(week, 7))} aria-label="Nästa vecka">›</button>
          </div>
          <ul className="list mt">
            {days.map((d) => {
              const p = planFor(d)
              return (
                <li key={d} className={`tap ${d === t ? 'today-row' : ''} ${d < t ? 'past' : ''}`} onClick={() => setPicking(d)}>
                  <span>
                    <span className="muted small cap">{weekdayName(d)} {parseDay(d).getDate()}/{parseDay(d).getMonth() + 1}</span>
                    <div className={p ? '' : 'muted'}>{p ? p.dish : 'Välj middag…'}</div>
                  </span>
                  {p && <button className="icon-btn" onClick={(e) => { e.stopPropagation(); plan.remove(p.id) }} aria-label="Ta bort">✕</button>}
                </li>
              )
            })}
          </ul>
          <button className="primary wide" onClick={fillWeek}><Icon name="dice" size={18} /> Fyll tomma dagar med förslag</button>
          <Fab onClick={() => setPicking(days.find((d) => d >= t && !planFor(d)) || (days.includes(t) ? t : days[0]))} label="Välj middag" />
        </>
      )}

      {view === 'dishes' && <Dishes dishes={dishes} all={all} />}
      {picking && <Picker day={picking} all={all} onPick={(dish) => setDish(picking, dish)} onClose={() => setPicking(null)} />}
    </section>
  )
}

export function Picker({ day, all, onPick, onClose }) {
  const [tips, setTips] = useState(() => shuffle(all).slice(0, 3))
  const [q, setQ] = useState('')
  const hits = q ? all.filter((d) => d.name.toLowerCase().includes(q.toLowerCase())) : all
  return (
    <Sheet title={`Middag ${weekdayName(day)}`} onClose={onClose}>
        <div className="row between"><span className="muted">Förslag</span><button className="link" onClick={() => setTips(shuffle(all).slice(0, 3))}><Icon name="dice" size={16} /> Nya förslag</button></div>
        <div className="tips">
          {tips.map((t) => <button key={t.name} className="tip" onClick={() => onPick(t.name)}><strong>{t.name}</strong>{t.category && <span className="muted small"> · {t.category}</span>}</button>)}
        </div>
        <form className="row mt" onSubmit={(e) => { e.preventDefault(); if (q.trim()) onPick(q.trim()) }}>
          <input placeholder="Sök eller skriv egen rätt" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="primary">Välj</button>
        </form>
        <ul className="list mt scroll">
          {hits.map((d) => <li key={d.id || d.name} className="tap" onClick={() => onPick(d.name)}><span>{d.name}</span><span className="muted small">{d.category}</span></li>)}
        </ul>
    </Sheet>
  )
}

function Dishes({ dishes, all }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [adding, setAdding] = useState(false)
  const categories = [...new Set(all.map((d) => d.category).filter(Boolean))]
  const add = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    dishes.insert({ name: name.trim(), category: category.trim() || null })
    setName(''); setCategory(''); setAdding(false)
  }
  return (
    <>
      <Fab onClick={() => setAdding(true)} label="Ny rätt" />
      {adding && (
        <Sheet title="Ny egen rätt" onClose={() => setAdding(false)}>
          <form className="stack" onSubmit={add}>
            <input placeholder="T.ex. Mormors köttbullar" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <input list="cats" placeholder="Kategori (valfritt)" value={category} onChange={(e) => setCategory(e.target.value)} />
            <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            <button className="primary">Spara</button>
          </form>
        </Sheet>
      )}
      <ul className="list">
        {all.map((d) => (
          <SwipeRow key={d.id || d.name} onDelete={d.own ? () => dishes.remove(d.id) : undefined}>
            <span>{d.name} {d.own && <span className="tag own">Egen</span>}</span>
            <span className="meta">
              {d.category && <span className="muted small">{d.category}</span>}
              {d.own && <button className="icon-btn del" onClick={() => dishes.remove(d.id)} aria-label="Ta bort">✕</button>}
            </span>
          </SwipeRow>
        ))}
      </ul>
    </>
  )
}

function weekNumber(s) {
  const d = parseDay(s); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7)
}
