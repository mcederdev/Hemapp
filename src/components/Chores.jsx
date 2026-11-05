import { useState } from 'react'
import { useTable } from '../useTable'
import { COMMON_CHORES } from '../lib/defaults'
import MemberPicker, { MemberTag } from './MemberPicker'

export default function Chores({ householdId, members }) {
  const chores = useTable('chores', householdId)
  const templates = useTable('chore_templates', householdId)
  const [title, setTitle] = useState('')
  const [who, setWho] = useState(null)
  const [due, setDue] = useState('')
  const [filter, setFilter] = useState(null)
  const [showCommon, setShowCommon] = useState(false)

  const byId = Object.fromEntries(members.map((m) => [m.id, m]))
  const visible = chores.rows
    .filter((c) => !filter || c.assigned_to === filter)
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.due_date || '9').localeCompare(b.due_date || '9'))
  const common = [...COMMON_CHORES, ...templates.rows.map((t) => t.title)]

  const add = (t) => {
    const text = (t ?? title).trim()
    if (!text) return
    chores.insert({ title: text, assigned_to: who, due_date: due || null })
    setTitle('')
  }
  const saveAsCommon = () => {
    const text = title.trim()
    if (text && !common.includes(text)) templates.insert({ title: text })
  }

  return (
    <section>
      <h2>Att göra</h2>
      <form className="stack card" onSubmit={(e) => { e.preventDefault(); add() }}>
        <input placeholder="Ny syssla…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="row">
          <MemberPicker members={members} value={who} onChange={setWho} emptyLabel="Vem som helst" />
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="row">
          <button className="primary">Lägg till</button>
          <button type="button" onClick={() => setShowCommon(!showCommon)}>Vanliga sysslor</button>
          {title.trim() && <button type="button" className="link" onClick={saveAsCommon}>Spara som vanlig</button>}
        </div>
        {showCommon && (
          <div className="chips">
            {common.map((c) => <button type="button" key={c} className="chip" onClick={() => add(c)}>+ {c}</button>)}
          </div>
        )}
      </form>

      <div className="row">
        <span className="muted">Visa:</span>
        <MemberPicker members={members} value={filter} onChange={setFilter} />
      </div>
      <ul className="list">
        {visible.map((c) => (
          <li key={c.id} className={c.done ? 'is-done' : ''}>
            <label className="check">
              <input type="checkbox" checked={c.done} onChange={() => chores.update(c.id, { done: !c.done })} />
              <span>{c.title}</span>
            </label>
            <span className="meta">
              {c.due_date && <span className="muted small">{formatDate(c.due_date)}</span>}
              <MemberTag member={byId[c.assigned_to]} />
              <button className="icon-btn" onClick={() => chores.remove(c.id)} aria-label="Ta bort">✕</button>
            </span>
          </li>
        ))}
        {!chores.loading && visible.length === 0 && <li className="muted">Inget att göra 🎉</li>}
      </ul>
    </section>
  )
}

function formatDate(d) {
  return new Date(d + 'T12:00').toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
}
