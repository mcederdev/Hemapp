import { useState } from 'react'
import { useTable } from '../useTable'
import { COMMON_CHORES } from '../lib/defaults'
import { nextDue, repeatLabel, prettyDay, today } from '../lib/dates'
import MemberPicker, { MemberTag } from './MemberPicker'
import Sheet, { Fab } from './Sheet'

const REPEATS = [
  { v: '', label: 'Upprepa inte' },
  { v: '1-day', label: 'Varje dag' },
  { v: '2-day', label: 'Varannan dag' },
  { v: '1-week', label: 'Varje vecka' },
  { v: '2-week', label: 'Varannan vecka' },
  { v: '1-month', label: 'Varje månad' }
]

export function completeChore(chores, c) {
  chores.update(c.id, { done: true, done_at: new Date().toISOString() })
  if (c.repeat_unit) {
    const from = c.due_date || today()
    chores.insert({
      title: c.title, assigned_to: c.assigned_to, stars: c.stars,
      repeat_every: c.repeat_every, repeat_unit: c.repeat_unit,
      due_date: nextDue(from, c.repeat_every, c.repeat_unit)
    })
  }
}

export default function Chores({ householdId, members }) {
  const chores = useTable('chores', householdId)
  const templates = useTable('chore_templates', householdId)
  const [title, setTitle] = useState('')
  const [who, setWho] = useState(null)
  const [due, setDue] = useState('')
  const [repeat, setRepeat] = useState('')
  const [stars, setStars] = useState(0)
  const [filter, setFilter] = useState(null)
  const [showCommon, setShowCommon] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [adding, setAdding] = useState(false)

  const byId = Object.fromEntries(members.map((m) => [m.id, m]))
  const isChild = byId[who]?.role === 'child'
  const t = today()
  const mine = chores.rows.filter((c) => !filter || c.assigned_to === filter)
  const open = mine.filter((c) => !c.done).sort((a, b) => (a.due_date || '9').localeCompare(b.due_date || '9'))
  const done = mine.filter((c) => c.done).sort((a, b) => (b.done_at || '').localeCompare(a.done_at || '')).slice(0, 20)
  const common = [...COMMON_CHORES, ...templates.rows.map((x) => x.title)]

  const add = (text0) => {
    const text = (text0 ?? title).trim()
    if (!text) return
    const [every, unit] = repeat ? repeat.split('-') : [null, null]
    chores.insert({
      title: text, assigned_to: who, due_date: due || (unit ? t : null),
      repeat_every: every ? Number(every) : null, repeat_unit: unit, stars: Number(stars) || 0
    })
    setTitle('')
    setAdding(false)
  }
  const saveAsCommon = () => {
    const text = title.trim()
    if (text && !common.includes(text)) templates.insert({ title: text })
  }

  return (
    <section>
      <h2>Sysslor</h2>
      <Fab onClick={() => setAdding(true)} label="Ny syssla" />
      {adding && (
      <Sheet title="Ny syssla" onClose={() => setAdding(false)}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); add() }}>
        <input placeholder="Vad ska göras?" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <div className="row">
          <label className="field"><span className="muted small">Vem</span><MemberPicker members={members} value={who} onChange={setWho} emptyLabel="Vem som helst" /></label>
          <label className="field"><span className="muted small">När</span><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
        </div>
        <div className="row">
          <select value={repeat} onChange={(e) => setRepeat(e.target.value)}>
            {REPEATS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
          </select>
          {(isChild || stars > 0) && (
            <select value={stars} onChange={(e) => setStars(e.target.value)} style={{ maxWidth: 120 }}>
              {[0, 1, 2, 3, 5].map((n) => <option key={n} value={n}>{n === 0 ? 'Inga ⭐' : `${n} ⭐`}</option>)}
            </select>
          )}
        </div>
        <div className="row wrap">
          <button className="primary">Lägg till</button>
          <button type="button" onClick={() => setShowCommon(!showCommon)}>{showCommon ? 'Dölj vanliga' : 'Vanliga sysslor'}</button>
          {title.trim() && <button type="button" className="link" onClick={saveAsCommon}>Spara som vanlig</button>}
        </div>
        {showCommon && (
          <div className="chips">
            {common.map((c) => <button type="button" key={c} className="chip" onClick={() => add(c)}>+ {c}</button>)}
          </div>
        )}
        {showCommon && <p className="muted small">Tryck på en vanlig syssla så läggs den till med valen ovan.</p>}
      </form>
      </Sheet>
      )}

      <div className="row mb">
        <span className="muted">Visa:</span>
        <MemberPicker members={members} value={filter} onChange={setFilter} />
      </div>
      <ul className="list">
        {open.map((c) => (
          <li key={c.id}>
            <label className="check">
              <input type="checkbox" checked={false} onChange={() => completeChore(chores, c)} />
              <span>
                {c.title}
                <div className="muted small">
                  {c.due_date && <span className={c.due_date < t ? 'error' : ''}>{c.due_date === t ? 'Idag' : prettyDay(c.due_date)}</span>}
                  {c.repeat_unit && <span> · 🔁 {repeatLabel(c.repeat_every, c.repeat_unit)}</span>}
                </div>
              </span>
            </label>
            <span className="meta">
              {c.stars > 0 && <span className="small">⭐{c.stars}</span>}
              <MemberTag member={byId[c.assigned_to]} />
              <button className="icon-btn" onClick={() => chores.remove(c.id)} aria-label="Ta bort">✕</button>
            </span>
          </li>
        ))}
        {!chores.loading && open.length === 0 && <li className="muted">Inget att göra 🎉</li>}
      </ul>

      <button className="link" onClick={() => setShowDone(!showDone)}>{showDone ? 'Dölj gjorda' : 'Visa gjorda'}</button>
      {showDone && (
        <ul className="list done">
          {done.map((c) => (
            <li key={c.id} className="is-done">
              <label className="check">
                <input type="checkbox" checked onChange={() => chores.update(c.id, { done: false, done_at: null })} />
                <span>{c.title}</span>
              </label>
              <span className="meta">
                {c.stars > 0 && <span className="small">⭐{c.stars}</span>}
                <MemberTag member={byId[c.assigned_to]} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
