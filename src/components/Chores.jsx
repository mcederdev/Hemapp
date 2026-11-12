import { useState } from 'react'
import { supabase } from '../supabase'
import { useTable } from '../useTable'
import { COMMON_CHORES } from '../lib/defaults'
import { repeatLabel, prettyDay, today, addDays, startOfWeek, dayOf } from '../lib/dates'
import { planDue, planLabel, PLAN_SUGGESTIONS } from '../lib/plans'
import { showToday, periodEnd, nextChoreDue, hasNext } from '../lib/choreRules'
import MemberPicker, { MemberTag } from './MemberPicker'
import Sheet, { Fab } from './Sheet'
import SwipeRow, { Check } from './Swipe'
import Icon from './Icon'
import FamilyStrip, { forFocus } from './FamilyStrip'

const REPEATS = [
  { v: '', label: 'Upprepa inte' },
  { v: '1-day', label: 'Varje dag' },
  { v: '2-day', label: 'Varannan dag' },
  { v: '1-week', label: 'Varje vecka (läggs till på måndagar)' },
  { v: '2-week', label: 'Varannan vecka' },
  { v: '1-month', label: 'Varje månad (läggs till den 1:a)' }
]

// Bocka av: är sysslan tilldelad räknas den som gjord av den personen, annars av den som bockade
// Delade sysslor (barnets och bilens) syns i båda hushållen. Länken sätts från App.
let sharedLink = null
export const setSharedLink = (id) => { sharedLink = id }
export const isSharedChore = (c) => !!(c.shared || c.car_id)

export function completeChore(chores, c, doerId) {
  chores.update(c.id, { done: true, done_at: new Date().toISOString(), done_by: c.assigned_to || doerId || null })
  if (isSharedChore(c) && sharedLink) supabase.rpc('notify_linked', { link: sharedLink, msg: `har gjort: ${c.title}${c.car_id ? ' 🚗' : ''} ✓`, url: c.car_id ? '/?tab=car' : '/?tab=chores' })
  // Sysslor med valt datum (och äldre med egen upprepning): nästa gång läggs till direkt, samma veckodag nästa period
  if (c.repeat_unit && (!c.plan_id || c.fixed_day)) {
    const next = nextChoreDue(c, today())
    if (next && !hasNext(chores.rows, c, next)) chores.insert({
      title: c.title, assigned_to: c.assigned_to, stars: c.stars, plan_id: c.plan_id || null, fixed_day: !!c.fixed_day, shared: !!c.shared, car_id: c.car_id || null,
      repeat_every: c.repeat_every, repeat_unit: c.repeat_unit, due_date: next
    })
  }
}

export { showToday, periodEnd }

// Skapar en återkommande syssla och lägger till första omgången direkt
export async function createPlan(plans, chores, { title, every, unit, assigned_to = null, stars = 0, due }) {
  const t = today()
  const rows = await plans.insert({ title, every, unit, assigned_to, stars, last_added: t })
  const plan = rows?.[0]
  if (plan) await chores.insert({ title, assigned_to, stars, plan_id: plan.id, due_date: due || planDue({ unit, every }, t), fixed_day: !!due && unit !== 'day', repeat_every: every, repeat_unit: unit })
}

export default function Chores({ householdId, members, people, linked, me, focus: filter, setFocus: setFilter }) {
  const chores = useTable('chores', householdId)
  const templates = useTable('chore_templates', householdId)
  const plans = useTable('chore_plans', householdId)
  const empty = { title: '', who: null, due: '', repeat: '', stars: 0, share: false }
  const otherHome = linked?.households?.[0]
  const [form, setForm] = useState(empty)
  const [showCommon, setShowCommon] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showPlans, setShowPlans] = useState(false)

  const byId = Object.fromEntries((people || members).map((m) => [m.id, m]))
  const planById = Object.fromEntries(plans.rows.map((p) => [p.id, p]))
  const t = today()
  const weekEnd = addDays(startOfWeek(t), 6)
  // Bilens sysslor ligger under Bilen
  const mine = chores.rows.filter((c) => !c.car_id).filter((c) => forFocus(filter, c.done ? c.done_by || c.assigned_to : c.assigned_to))
  const open = mine.filter((c) => !c.done).sort((a, b) => (a.due_date || '9').localeCompare(b.due_date || '9'))
  const done = mine.filter((c) => c.done).sort((a, b) => (b.done_at || '').localeCompare(a.done_at || '')).slice(0, 30)
  const common = [...COMMON_CHORES, ...templates.rows.map((x) => x.title)]
  const overdue = {}
  for (const c of chores.rows) if (!c.done && c.due_date && c.due_date < t && c.assigned_to) overdue[c.assigned_to] = (overdue[c.assigned_to] || 0) + 1

  const groups = [
    ['Sena', open.filter((c) => c.due_date && c.due_date < t)],
    ['Idag', open.filter((c) => c.due_date === t)],
    ['Den här veckan', open.filter((c) => c.due_date && c.due_date > t && c.due_date <= weekEnd)],
    ['Senare', open.filter((c) => c.due_date && c.due_date > weekEnd)],
    ['När som helst', open.filter((c) => !c.due_date)]
  ].filter(([, l]) => l.length)

  const isChild = byId[form.who]?.role === 'child'
  const add = async (text0) => {
    const title = (text0 ?? form.title).trim()
    if (!title) return
    const [every, unit] = form.repeat ? form.repeat.split('-') : [null, null]
    // Delad syssla: egen upprepning på sysslan (inte hushållets plan), så att båda hushållen ser nästa gång
    if (form.share && otherHome) await chores.insert({ title, assigned_to: form.who, due_date: form.due || (unit ? t : null), stars: Number(form.stars) || 0, shared: true, fixed_day: !!unit, repeat_every: unit ? Number(every) : null, repeat_unit: unit })
    else if (unit) await createPlan(plans, chores, { title, every: Number(every), unit, assigned_to: form.who, stars: Number(form.stars) || 0, due: form.due || null })
    else await chores.insert({ title, assigned_to: form.who, due_date: form.due || null, stars: Number(form.stars) || 0 })
    setForm({ ...form, title: '' })
    setAdding(false)
  }
  const saveAsCommon = () => {
    const text = form.title.trim()
    if (text && !common.includes(text)) templates.insert({ title: text })
  }
  const complete = (c) => completeChore(chores, c, me.id)

  const ChoreRow = ({ c }) => {
    const plan = planById[c.plan_id]
    return (
      <SwipeRow onCheck={() => complete(c)} onDelete={() => chores.remove(c.id)}>
        <span className="check">
          <Check checked={false} onChange={() => complete(c)} label={`Bocka av ${c.title}`} />
          <span className="tap grow" onClick={() => setEditing(c)}>
            {c.title}
            <div className="muted small row-icons">
              {c.due_date && <span className={c.due_date < t ? 'error' : ''}>{c.due_date === t ? 'Idag' : plan && !c.fixed_day && c.due_date >= t ? (plan.unit === 'week' ? 'Den här veckan' : plan.unit === 'month' ? 'Den här månaden' : prettyDay(c.due_date)) : prettyDay(c.due_date)}</span>}
              {plan && <span><Icon name="repeat" size={13} /> {planLabel(plan)}</span>}
              {!plan && c.repeat_unit && <span><Icon name="repeat" size={13} /> {repeatLabel(c.repeat_every, c.repeat_unit)}</span>}
              {!c.assigned_to && <span>Hushållet</span>}
              {c.shared && <span className="shared-tag">🔗 Delad</span>}
            </div>
          </span>
        </span>
        <span className="meta">
          {c.stars > 0 && <span className="stars-sm"><Icon name="star" size={14} />{c.stars}</span>}
          <button className="assign-btn" onClick={() => setEditing(c)} aria-label="Tilldela">
            {c.assigned_to ? <MemberTag member={byId[c.assigned_to]} /> : <span className="avatar empty-av">+</span>}
          </button>
        </span>
      </SwipeRow>
    )
  }

  return (
    <section>
      <h2>Sysslor</h2>
      <Fab onClick={() => setAdding(true)} label="Ny syssla" />
      {adding && (
        <Sheet title="Ny syssla" onClose={() => setAdding(false)}>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); add() }}>
            <input placeholder="Vad ska göras?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
            <div className="row">
              <label className="field"><span className="muted small">Vem</span><MemberPicker members={form.share ? (people || members).filter((m) => m.role !== 'guest') : members} value={form.who} onChange={(v) => setForm({ ...form, who: v })} emptyLabel="Hushållet" /></label>
              <label className="field"><span className="muted small">{form.repeat && !form.repeat.endsWith('day') ? 'Fast dag' : 'När'}</span><input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></label>
            </div>
            <label className="field"><span className="muted small">Upprepning</span>
              <select value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value })}>
                {REPEATS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
              </select>
            </label>
            {otherHome && <label className="row small"><input type="checkbox" checked={form.share} onChange={(e) => setForm({ ...form, share: e.target.checked })} /> Dela med {otherHome.name} (syns och kan bockas av där också)</label>}
            {form.repeat && !form.repeat.endsWith('day') && !form.share && <RepeatHint unit={form.repeat.split('-')[1]} fixed={!!form.due} />}
            {(isChild || form.stars > 0) && (
              <select value={form.stars} onChange={(e) => setForm({ ...form, stars: e.target.value })}>
                {[0, 1, 2, 3, 5].map((n) => <option key={n} value={n}>{n === 0 ? 'Inga stjärnor' : `${n} stjärn${n === 1 ? 'a' : 'or'}`}</option>)}
              </select>
            )}
            <p className="muted small">"Hushållet" betyder att den som bockar av sysslan räknas som den som gjorde den.</p>
            <div className="row wrap">
              <button className="primary">Lägg till</button>
              <button type="button" onClick={() => setShowCommon(!showCommon)}>{showCommon ? 'Dölj vanliga' : 'Vanliga sysslor'}</button>
              {form.title.trim() && <button type="button" className="link" onClick={saveAsCommon}>Spara som vanlig</button>}
            </div>
            {showCommon && <div className="chips">{common.map((c) => <button type="button" key={c} className="chip" onClick={() => add(c)}>+ {c}</button>)}</div>}
            {showCommon && <p className="muted small">Tryck på en vanlig syssla så läggs den till med valen ovan.</p>}
          </form>
        </Sheet>
      )}

      <FamilyStrip members={members} focus={filter} setFocus={setFilter} counts={overdue} />

      {groups.map(([label, list]) => (
        <div key={label}>
          <h4 className={`day ${label === 'Sena' ? 'error' : ''}`}>{label}</h4>
          <ul className="list">{list.map((c) => <ChoreRow key={c.id} c={c} />)}</ul>
        </div>
      ))}
      {!chores.loading && open.length === 0 && <p className="muted">Inget att göra just nu. 🎉</p>}

      <div className="card mt">
        <button className="card-head flat" onClick={() => setShowPlans(!showPlans)}>
          <span className="row"><Icon name="repeat" size={18} /> <strong>Återkommande sysslor</strong>{plans.rows.length > 0 && <span className="count">{plans.rows.length}</span>}</span>
          <Icon name="chevron" size={18} className={`muted ${showPlans ? 'rot' : ''}`} />
        </button>
        {showPlans && <Plans plans={plans} chores={chores} members={members} byId={byId} />}
      </div>

      <button className="link" onClick={() => setShowDone(!showDone)}>{showDone ? 'Dölj gjorda' : 'Visa gjorda'}</button>
      {showDone && (
        <ul className="list done">
          {done.map((c) => (
            <li key={c.id} className="is-done">
              <span className="check">
                <Check checked onChange={() => chores.update(c.id, { done: false, done_at: null, done_by: null })} label={`Ångra ${c.title}`} />
                <span>{c.title}<div className="muted small">{byId[c.done_by]?.name ? `Gjord av ${byId[c.done_by].name}` : ''}{c.done_at ? ` · ${prettyDay(dayOf(c.done_at))}` : ''}</div></span>
              </span>
              <span className="meta">
                {c.stars > 0 && <span className="stars-sm"><Icon name="star" size={14} />{c.stars}</span>}
                <MemberTag member={byId[c.done_by || c.assigned_to]} />
              </span>
            </li>
          ))}
        </ul>
      )}

      {editing && <EditChore c={editing} chores={chores} members={members} plan={planById[editing.plan_id]} plans={plans} onClose={() => setEditing(null)} onDone={() => { complete(editing); setEditing(null) }} />}
    </section>
  )
}

// Tryck på en syssla: tilldela, ändra eller ta bort
function EditChore({ c, chores, members, plan, plans, onClose, onDone }) {
  const initDue = plan && !c.fixed_day ? '' : c.due_date || ''
  const [f, setF] = useState({ title: c.title, assigned_to: c.assigned_to, due_date: initDue, stars: c.stars || 0 })
  const isChild = members.find((m) => m.id === f.assigned_to)?.role === 'child'
  const save = async (e) => {
    e?.preventDefault()
    const v = { title: f.title.trim() || c.title, assigned_to: f.assigned_to, due_date: f.due_date === initDue ? c.due_date : f.due_date || null, stars: Number(f.stars) || 0 }
    // Återkommande: valt datum = fast dag, tomt = fritt under perioden
    if (plan && plan.unit !== 'day' && f.due_date !== initDue) {
      const free = !f.due_date
      Object.assign(v, { fixed_day: !free, repeat_every: plan.every, repeat_unit: plan.unit, due_date: free ? periodEnd(plan.unit, today()) : f.due_date })
    }
    await chores.update(c.id, v)
    onClose()
  }
  return (
    <Sheet title={c.title} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <span className="muted small">Vem gör den?</span>
        <div className="assign-row">
          <button type="button" className={`assign-opt ${!f.assigned_to ? 'on' : ''}`} onClick={() => setF({ ...f, assigned_to: null })}>
            <span className="avatar empty-av" style={{ width: 40, height: 40 }}>🏠</span><span>Hushållet</span>
          </button>
          {members.map((m) => (
            <button type="button" key={m.id} className={`assign-opt ${f.assigned_to === m.id ? 'on' : ''}`} style={{ '--ring': m.color }} onClick={() => setF({ ...f, assigned_to: m.id })}>
              <MemberTag member={m} size={40} /><span>{m.name}</span>
            </button>
          ))}
        </div>
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="Syssla" />
        <div className="row">
          <label className="field"><span className="muted small">{plan && plan.unit !== 'day' ? 'Fast dag' : 'När'}</span><input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></label>
          {(isChild || f.stars > 0) && (
            <label className="field"><span className="muted small">Stjärnor</span>
              <select value={f.stars} onChange={(e) => setF({ ...f, stars: e.target.value })}>{[0, 1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          )}
        </div>
        {plan && plan.unit !== 'day' && <RepeatHint unit={plan.unit} fixed={!!f.due_date} />}
        {plan && (
          <label className="row small">
            <input type="checkbox" checked={plan.assigned_to === f.assigned_to} onChange={(e) => plans.update(plan.id, { assigned_to: e.target.checked ? f.assigned_to : null })} />
            <span>Samma person varje gång ({planLabel(plan)})</span>
          </label>
        )}
        <button className="primary">Spara</button>
        <button type="button" onClick={onDone}><Icon name="check" size={16} /> Klar{f.assigned_to ? ` (av ${members.find((m) => m.id === f.assigned_to)?.name})` : ''}</button>
        <button type="button" className="danger" onClick={() => { chores.remove(c.id); onClose() }}>Ta bort</button>
      </form>
    </Sheet>
  )
}

function Plans({ plans, chores, members, byId }) {
  const [edit, setEdit] = useState(null)
  const existing = new Set(plans.rows.map((p) => p.title.toLowerCase()))
  const suggestions = PLAN_SUGGESTIONS.filter((s) => !existing.has(s.title.toLowerCase()))
  const units = [['day', 'dag'], ['week', 'vecka'], ['month', 'månad']]
  return (
    <div>
      <p className="muted small pad">Läggs till automatiskt: veckovisa på måndagar, månadsvisa den 1:a. Om förra omgången inte är gjord ligger den kvar i stället för att dubbleras.</p>
      <ul className="list flush">
        {plans.rows.map((p) => (
          <li key={p.id}>
            <span className="tap grow" onClick={() => setEdit({ ...p })}>{p.title}<div className="muted small">{planLabel(p)}{p.assigned_to ? ` · ${byId[p.assigned_to]?.name}` : ' · hushållet'}</div></span>
            <button className="icon-btn" onClick={() => confirm(`Sluta upprepa "${p.title}"?`) && plans.remove(p.id)} aria-label="Ta bort">✕</button>
          </li>
        ))}
      </ul>
      {suggestions.length > 0 && (
        <div className="pad">
          <p className="muted small">Förslag, tryck för att lägga till:</p>
          <div className="chips">
            {suggestions.map((s) => (
              <button key={s.title} className="chip" onClick={() => createPlan(plans, chores, { title: s.title, unit: s.unit, every: s.every || 1 })}>
                + {s.title} <span className="muted small">{planLabel({ unit: s.unit, every: s.every || 1 })}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {edit && (
        <Sheet title="Återkommande syssla" onClose={() => setEdit(null)}>
          <form className="stack" onSubmit={async (e) => { e.preventDefault(); await plans.update(edit.id, { title: edit.title, every: Number(edit.every) || 1, unit: edit.unit, assigned_to: edit.assigned_to, stars: Number(edit.stars) || 0 }); setEdit(null) }}>
            <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            <div className="row">
              <span>Var</span>
              <input type="number" min="1" value={edit.every} onChange={(e) => setEdit({ ...edit, every: e.target.value })} style={{ maxWidth: 70 }} />
              <select value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })}>{units.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </div>
            <label className="field"><span className="muted small">Vem</span><MemberPicker members={members} value={edit.assigned_to} onChange={(v) => setEdit({ ...edit, assigned_to: v })} emptyLabel="Hushållet" /></label>
            <button className="primary">Spara</button>
          </form>
        </Sheet>
      )}
    </div>
  )
}

function RepeatHint({ unit, fixed }) {
  const per = unit === 'month' ? 'månaden' : 'veckan'
  return <p className="muted small">{fixed
    ? `Syns på Idag först den dagen. När den bockas av kommer den tillbaka samma dag nästa ${unit === 'month' ? 'månad' : 'gång'}.`
    : `Ingen fast dag: syns på Idag varje dag tills den är gjord, och kommer tillbaka ${unit === 'month' ? 'den 1:a nästa månad' : 'på måndagen'}.`}</p>
}
