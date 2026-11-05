import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useTable } from '../useTable'
import { MEMBER_COLORS } from '../lib/defaults'
import Sheet, { Fab } from './Sheet'
import { pushSupport, currentSubscription, enablePush, disablePush } from '../lib/push'

export default function Family({ me, householdId, members, membersTable, household, households }) {
  const [childName, setChildName] = useState('')
  const [adding, setAdding] = useState(false)
  const templates = useTable('chore_templates', householdId)

  const addChild = (e) => {
    e.preventDefault()
    if (!childName.trim()) return
    membersTable.insert({ name: childName.trim(), role: 'child', color: MEMBER_COLORS[members.length % MEMBER_COLORS.length] })
    setChildName('')
    setAdding(false)
  }

  return (
    <section>
      <h2>{household?.name || 'Familjen'}</h2>
      <Notifications me={me} household={household} households={households} />

      <div className="card stack">
        <h3>Medlemmar</h3>
        <ul className="list">
          {members.map((m) => (
            <li key={m.id} className="col">
              <div className="row between w100">
                <span className="row">
                  <input type="color" value={m.color} onChange={(e) => membersTable.update(m.id, { color: e.target.value })} aria-label="Färg" />
                  <span>{m.name}{m.id === me.id && ' (du)'}</span>
                </span>
                <span className="meta">
                  <span className="muted small">{m.role === 'child' ? 'Barn, inget konto' : 'Förälder'}</span>
                  {m.role === 'child' && <button className="icon-btn" onClick={() => confirm(`Ta bort ${m.name}?`) && membersTable.remove(m.id)} aria-label="Ta bort">✕</button>}
                </span>
              </div>
              {m.role === 'parent' && (
                <input type="tel" inputMode="tel" placeholder="Mobilnummer (för Swish)" defaultValue={m.phone || ''}
                  onBlur={(e) => e.target.value !== (m.phone || '') && membersTable.update(m.id, { phone: e.target.value || null })} />
              )}
            </li>
          ))}
        </ul>
        <button onClick={() => setAdding(true)}>+ Lägg till barn</button>
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
      <Fab onClick={() => setAdding(true)} label="Lägg till barn" />
      {adding && (
        <Sheet title="Lägg till barn" onClose={() => setAdding(false)}>
          <form className="row" onSubmit={addChild}>
            <input placeholder="Namn" value={childName} onChange={(e) => setChildName(e.target.value)} autoFocus />
            <button className="primary">Spara</button>
          </form>
          <p className="muted small mt">Barnet får inget eget konto men kan få sysslor, händelser och stjärnor.</p>
        </Sheet>
      )}
    </section>
  )
}

function Notifications({ me, household, households }) {
  const support = pushSupport()
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => { currentSubscription().then((s) => setOn(Boolean(s))).catch(() => {}) }, [])

  const toggle = async () => {
    setBusy(true); setMsg('')
    try {
      if (on) { await disablePush(); setOn(false) } else { await enablePush(me); setOn(true); setMsg('Notiser är på!') }
    } catch (e) { setMsg(e.message) }
    setBusy(false)
  }
  const test = async () => {
    const { error } = await supabase.rpc('send_test_push')
    setMsg(error ? error.message : 'Testnotis skickad, den kommer om några sekunder.')
  }

  return (
    <div className="card stack">
      <h3>🔔 Notiser</h3>
      {support === 'install' && <p>För notiser på iPhone: öppna appen i Safari, tryck på dela-knappen och välj <strong>Lägg till på hemskärmen</strong>. Öppna sedan appen från hemskärmen och slå på notiser här.</p>}
      {support === 'unsupported' && <p className="muted">Den här webbläsaren stöder inte notiser.</p>}
      {support === 'ok' && (
        <>
          <p className="muted small">Du får en sammanfattning varje morgon (händelser, sysslor och middag) och en påminnelse innan händelser i kalendern.</p>
          <div className="row wrap">
            <button className={on ? '' : 'primary'} onClick={toggle} disabled={busy}>{on ? 'Stäng av notiser' : 'Slå på notiser'}</button>
            {on && <button onClick={test}>Skicka testnotis</button>}
          </div>
          {household && (
            <label className="row between">
              <span>Morgonsammanfattning kl</span>
              <select value={household.morning_push_hour} onChange={(e) => households.update(household.id, { morning_push_hour: Number(e.target.value) })} style={{ maxWidth: 100 }}>
                {[5, 6, 7, 8, 9, 10].map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
              </select>
            </label>
          )}
        </>
      )}
      {msg && <p className="muted">{msg}</p>}
    </div>
  )
}
