import { useEffect, useRef, useState } from 'react'
import { useTable } from '../useTable'
import { suggestWeek, expiringSoon, usesItems } from '../lib/suggest'
import { COMMON_DISHES, dishList } from '../lib/defaults'
import { addDays, startOfWeek, today, weekdayName, parseDay } from '../lib/dates'
import Icon from './Icon'
import SwipeRow, { buzz } from './Swipe'
import Sheet, { Fab } from './Sheet'
import ShopForDishes from './ShopForDishes'
import { DishEditor, DishView } from './Recipe'
import { rowFor, linesFor, hasRecipe } from '../lib/dishdata'

const shuffle = (a) => [...a].sort(() => Math.random() - 0.5)
// Samma "slumpade" ordning hela dagen så att förslagen inte hoppar runt vid varje uppdatering
const seeded = (a, key) => {
  let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return [...a].map((x, i) => [x, ((h ^ (i * 2654435761)) >>> 0) % 1000]).sort((p, q) => p[1] - q[1]).map((p) => p[0])
}

// En färg per typ av rätt
const CAT_COLORS = { Pasta: '#e2a03f', Fisk: '#3f8fd8', Kyckling: '#d9a62e', Fredag: '#e0567a', Husman: '#9a6b4f', Vardag: '#5aa36b',
  Soppa: '#d8743f', Gryta: '#b8503f', Helg: '#8a5cf6', Snabbt: '#2fa3a0', Vegetariskt: '#4caf50' }
export function dishColor(cat) {
  if (!cat) return '#8b918e'
  if (CAT_COLORS[cat]) return CAT_COLORS[cat]
  let h = 0; for (const ch of cat) h = (h * 31 + ch.charCodeAt(0)) % 360
  return `hsl(${h} 55% 50%)`
}

// Veckan som färgade kort. Håll inne på ett kort och tryck (eller släpp) på en annan dag för att byta.
function WeekCards({ days, t, planFor, all, plan, onPick }) {
  const [moving, setMoving] = useState(null)
  const timer = useRef(null)
  const held = useRef(false)
  const strip = useRef(null)
  // Börja med dagens kort längst till vänster
  useEffect(() => {
    const el = strip.current?.querySelector('.meal-card.today') || strip.current?.querySelector('.meal-card:not(.past)')
    if (el) strip.current.scrollLeft = el.offsetLeft - strip.current.offsetLeft - 8
  }, [days[0]])
  const cat = (dish) => all.find((d) => d.name.toLowerCase() === dish?.toLowerCase())?.category

  const swap = async (from, to) => {
    setMoving(null)
    if (from === to) return
    const a = planFor(from), b = planFor(to)
    if (!a) return
    if (b) { await plan.update(a.id, { dish: b.dish }); await plan.update(b.id, { dish: a.dish }) }
    else await plan.update(a.id, { day: to })
  }
  const down = (d) => {
    held.current = false
    if (!planFor(d)) return
    timer.current = setTimeout(() => { held.current = true; buzz(); setMoving(d) }, 420)
  }
  const cancel = () => clearTimeout(timer.current)
  const up = (e) => {
    clearTimeout(timer.current)
    if (!held.current) return
    // Släppt över ett annat kort? Byt direkt
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-day]')
    if (el && el.dataset.day !== moving) swap(moving, el.dataset.day)
  }
  const tap = (d) => {
    if (held.current) { held.current = false; return }
    if (moving) return swap(moving, d)
    onPick(d)
  }

  return (
    <>
      <div className="meal-cards" ref={strip} onContextMenu={(e) => e.preventDefault()}>
        {days.map((d) => {
          const p = planFor(d)
          const c = p ? dishColor(cat(p.dish)) : null
          return (
            <button key={d} data-day={d} className={`meal-card ${p ? '' : 'empty'} ${d === t ? 'today' : ''} ${d < t ? 'past' : ''} ${moving === d ? 'moving' : ''} ${moving && moving !== d ? 'target' : ''}`}
              style={c ? { '--c': c } : undefined}
              onPointerDown={() => down(d)} onPointerUp={up} onPointerLeave={cancel} onPointerCancel={cancel} onClick={() => tap(d)}>
              <span className="mc-day cap">{weekdayName(d, 'short').replace('.', '')} {parseDay(d).getDate()}</span>
              {p ? <span className="mc-dish">{p.dish}</span> : <span className="mc-plus">+<small>Välj</small></span>}
              {p && cat(p.dish) && <span className="mc-cat">{cat(p.dish)}</span>}
              {p && !moving && <span className="mc-del" role="button" aria-label="Ta bort" onClick={(e) => { e.stopPropagation(); plan.remove(p.id) }}>✕</span>}
            </button>
          )
        })}
      </div>
      <p className="muted small">{moving ? `Tryck på dagen du vill byta ${weekdayName(moving)} med.` : 'Håll inne på en rätt för att flytta den till en annan dag.'}</p>
      {moving && <button className="link" onClick={() => setMoving(null)}>Avbryt flytt</button>}
    </>
  )
}

export default function Meals({ householdId, me, household, households }) {
  const dishes = useTable('dishes', householdId)
  const plan = useTable('meal_plan', householdId, 'day')
  const pantry = useTable('pantry_items', householdId, 'best_before')
  const dishItems = useTable('dish_items', householdId, 'dish')
  const [week, setWeek] = useState(startOfWeek(today()))
  const [picking, setPicking] = useState(null) // datum som väljs
  const [view, setView] = useState('week')
  const [shopFor, setShopFor] = useState(null)
  const [viewing, setViewing] = useState(null) // rätt som visas med varor och recept

  const all = dishList(dishes.rows, household?.hidden_dishes)
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
    const picks = suggestWeek({ all, plan: plan.rows, days, today: t, pantry: pantry.rows, dishItems: dishItems.rows })
    if (picks.length) await plan.insert(picks.map(({ day, dish }) => ({ day, dish })))
  }
  const soon = expiringSoon(pantry.rows, t)

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
          <WeekCards days={days} t={t} planFor={planFor} all={all} plan={plan} onPick={setPicking} />
          {(() => {
            const next = days.find((d) => d >= t && !planFor(d))
            if (!next) return null
            const recent = new Set(plan.rows.filter((p) => p.day >= addDays(t, -14)).map((p) => p.dish.toLowerCase()))
            const fresh = all.filter((d) => !recent.has(d.name.toLowerCase())).slice(0, 40)
            const usingSoon = soon.length ? fresh.filter((d) => usesItems(d.name, soon, dishItems.rows).length) : []
            const picks = [...seeded(usingSoon, next).slice(0, 2), ...seeded(fresh, next)].filter((d, i, a) => a.findIndex((x) => x.name === d.name) === i).slice(0, 3)
            return picks.length > 0 && (
              <div className="card mt">
                <strong className="cap">Förslag till {weekdayName(next)}</strong>
                <p className="muted small">{usingSoon.length ? `Använd det som snart går ut: ${soon.slice(0, 3).map((x) => x.name.toLowerCase()).join(', ')}` : 'Ni har inte ätit de här på två veckor'}</p>
                <div className="chips">{picks.map((d) => <button key={d.name} className="chip" style={{ '--c': dishColor(d.category) }} onClick={() => setDish(next, d.name)}>{d.name}</button>)}</div>
              </div>
            )
          })()}
          {(() => {
            const upcoming = days.filter((d) => d >= t).map(planFor).filter(Boolean).map((p) => p.dish)
            return upcoming.length > 0 && <button className="wide" onClick={() => setShopFor(upcoming)}><Icon name="cart" size={18} /> Handla till veckans middagar ({upcoming.length})</button>
          })()}
          <button className="primary wide" onClick={fillWeek}><Icon name="dice" size={18} /> Föreslå veckan</button>
          <p className="muted small center-text">Fyller tomma dagar med sådant ni gillar och inte ätit på två veckor{soon.length ? ', och använder det som snart går ut' : ''}.</p>
          <Fab onClick={() => setPicking(days.find((d) => d >= t && !planFor(d)) || (days.includes(t) ? t : days[0]))} label="Välj middag" />
        </>
      )}

      {view === 'dishes' && <Dishes householdId={householdId} me={me} dishes={dishes} dishItems={dishItems} all={all} household={household} households={households} />}
      {shopFor && <ShopForDishes householdId={householdId} me={me} dishes={shopFor.dishes || shopFor} portions={shopFor.portions} title={shopFor.dishes ? undefined : 'Handla till veckan'} onClose={() => setShopFor(null)} />}
      {picking && <Picker day={picking} all={all} current={planFor(picking)?.dish} onView={(d) => { setPicking(null); setViewing(d) }} onPick={(dish) => setDish(picking, dish)} onClose={() => setPicking(null)} />}
      {viewing && <DishView householdId={householdId} dish={viewing} onClose={() => setViewing(null)} onShop={(d, p) => { setViewing(null); setShopFor({ dishes: [d], portions: p }) }} />}
    </section>
  )
}

export function Picker({ day, all, current, onView, onPick, onClose }) {
  const [tips, setTips] = useState(() => shuffle(all).slice(0, 3))
  const [q, setQ] = useState('')
  const hits = q ? all.filter((d) => d.name.toLowerCase().includes(q.toLowerCase())) : all
  return (
    <Sheet title={`Middag ${weekdayName(day)}`} onClose={onClose} tall>
        {/* Sökfältet ligger överst och rutan har fast höjd, så fältet hoppar inte ner bakom tangentbordet när listan krymper */}
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (q.trim()) onPick(q.trim()) }}>
          <input placeholder="Sök eller skriv egen rätt" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="done" />
          <button className="primary">Välj</button>
        </form>
        {current && onView && !q && (
          <button className="wide" onClick={() => onView(current)}>📖 Visa {current}: varor och recept</button>
        )}
        {!q && (
          <>
            <div className="row between mt"><span className="muted">Förslag</span><button className="link" onClick={() => setTips(shuffle(all).slice(0, 3))}><Icon name="dice" size={16} /> Nya förslag</button></div>
            <div className="tips">
              {tips.map((t) => <button key={t.name} className="tip" onClick={() => onPick(t.name)}><strong>{t.name}</strong>{t.category && <span className="muted small"> · {t.category}</span>}</button>)}
            </div>
          </>
        )}
        <ul className="list mt">
          {q && !hits.some((d) => d.name.toLowerCase() === q.trim().toLowerCase()) && <li className="tap" onClick={() => onPick(q.trim())}><span>➕ Välj "{q.trim()}"</span></li>}
          {hits.map((d) => <li key={d.id || d.name} className="tap" onClick={() => onPick(d.name)}><span>{d.name}</span><span className="muted small">{d.category}</span></li>)}
        </ul>
    </Sheet>
  )
}

// Alla rätter går att ändra, även varorna och receptet. En föreslagen rätt som byter namn blir en egen, och originalet döljs.
function Dishes({ householdId, me, dishes, dishItems, all, household, households }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [shopFor, setShopFor] = useState(null)
  const [showHidden, setShowHidden] = useState(false)
  const [q, setQ] = useState('')
  const categories = [...new Set([...all, ...COMMON_DISHES].map((d) => d.category).filter(Boolean))]
  const hidden = household?.hidden_dishes || []
  const setHidden = (list) => household && households.update(household.id, { hidden_dishes: [...new Set(list)] })
  const hide = (n) => setHidden([...hidden, n])
  const unhide = (n) => setHidden(hidden.filter((x) => x.toLowerCase() !== n.toLowerCase()))
  const hiddenCommon = COMMON_DISHES.filter((c) => hidden.some((h) => h.toLowerCase() === c.name.toLowerCase()))
  const drop = (d) => {
    if (d.own) { if (confirm(`Ta bort ${d.name}?`)) dishes.remove(d.id) } else hide(d.name)
    setEditing(null)
  }
  const shown = q ? all.filter((d) => d.name.toLowerCase().includes(q.toLowerCase())) : all
  const byName = (n) => all.find((d) => d.name.toLowerCase() === n.toLowerCase())
  return (
    <>
      <Fab onClick={() => setAdding(true)} label="Ny rätt" />
      {(adding || editing) && (
        <DishEditor householdId={householdId} dish={editing} categories={categories}
          onClose={() => { setAdding(false); setEditing(null) }}
          onHide={(n, close) => { hide(n); if (close) setEditing(null) }} onRemove={drop} />
      )}
      {viewing && (
        <DishView householdId={householdId} dish={viewing} onClose={() => setViewing(null)}
          onEdit={(n) => { setViewing(null); setEditing(byName(n) || { name: n }) }}
          onShop={(d, p) => { setViewing(null); setShopFor({ dishes: [d], portions: p }) }} />
      )}
      {shopFor && <ShopForDishes householdId={householdId} me={me} dishes={shopFor.dishes} portions={shopFor.portions} onClose={() => setShopFor(null)} />}
      {all.length > 8 && <input className="mb" placeholder="Sök rätt" value={q} onChange={(e) => setQ(e.target.value)} />}
      <p className="muted small">Tryck på en rätt för att se varor och recept. Svep åt vänster för att ta bort. Plus lägger till en ny rätt, med receptlänk om ni vill.</p>
      <ul className="list">
        {shown.map((d) => {
          const row = rowFor(dishItems.rows, d.name)
          const n = linesFor(dishItems.rows, d.name).length
          return (
            <SwipeRow key={d.id || d.name} onDelete={() => drop(d)} onClick={() => setViewing(d.name)} className="tap">
              <span>{d.name} {d.own && <span className="tag own">Egen</span>}{hasRecipe(row) && <span title="Har recept"> 📖</span>}</span>
              <span className="meta">
                <span className="muted small">{n ? `${n} varor` : 'Inga varor'}{d.category ? ` · ${d.category}` : ''}</span>
              </span>
            </SwipeRow>
          )
        })}
      </ul>
      {hiddenCommon.length > 0 && (
        <>
          <button className="link small mt" onClick={() => setShowHidden(!showHidden)}>{showHidden ? 'Dölj' : `Visa dolda förslag (${hiddenCommon.length})`}</button>
          {showHidden && (
            <ul className="list">
              {hiddenCommon.map((d) => <li key={d.name} className="row between"><span className="muted">{d.name}</span><button className="chip" onClick={() => unhide(d.name)}>Visa igen</button></li>)}
            </ul>
          )}
        </>
      )}
      <div style={{ height: 72 }} />
    </>
  )
}

function weekNumber(s) {
  const d = parseDay(s); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7)
}
