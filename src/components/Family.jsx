import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useTable } from '../useTable'
import { MEMBER_COLORS } from '../lib/defaults'

export default function Family({ me, householdId, members, membersTable }) {
  const [household, setHousehold] = useState(null)
  const [childName, setChildName] = useState('')
  const templates = useTable('chore_templates', householdId)

  useEffect(() => {
    supabase.from('households').select('*').eq('id', householdId).single().then(({ data }) => setHousehold(data))
  }, [householdId])

  const addChild = (e) => {
    e.preventDefault()
    if (!childName.trim()) return
    membersTable.insert({ name: childName.trim(), role: 'child', color: MEMBER_COLORS[members.length % MEMBER_COLORS.length] })
    setChildName('')
  }

  return (
    <section>
      <h2>{household?.name || 'Familjen'}</h2>
      <div className="card stack">
        <h3>Medlemmar</h3>
        <ul className="list">
          {members.map((m) => (
            <li key={m.id}>
              <span className="row">
                <input type="color" value={m.color} onChange={(e) => membersTable.update(m.id, { color: e.target.value })} aria-label="Färg" />
                <span>{m.name}{m.id === me.id && ' (du)'}</span>
              </span>
              <span className="meta">
                <span className="muted small">{m.role === 'child' ? 'Barn, inget konto' : 'Förälder'}</span>
                {m.role === 'child' && <button className="icon-btn" onClick={() => confirm(`Ta bort ${m.name}?`) && membersTable.remove(m.id)} aria-label="Ta bort">✕</button>}
              </span>
            </li>
          ))}
        </ul>
        <form className="row" onSubmit={addChild}>
          <input placeholder="Lägg till barn (namn)" value={childName} onChange={(e) => setChildName(e.target.value)} />
          <button className="primary">Lägg till</button>
        </form>
      </div>

      {household && (
        <div className="card stack">
          <h3>Bjud in den andra föräldern</h3>
          <p>Hen skapar ett konto i appen, väljer <em>Gå med med kod</em> och skriver:</p>
          <p className="code">{household.invite_code}</p>
        </div>
      )}

      {templates.rows.length > 0 && (
        <div className="card stack">
          <h3>Våra egna vanliga sysslor</h3>
          <ul className="list">
            {templates.rows.map((t) => (
              <li key={t.id}><span>{t.title}</span>
                <button className="icon-btn" onClick={() => templates.remove(t.id)} aria-label="Ta bort">✕</button></li>
            ))}
          </ul>
        </div>
      )}

      <button className="wide" onClick={() => supabase.auth.signOut()}>Logga ut</button>
    </section>
  )
}
