import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useTable } from '../useTable'
import { MEMBER_COLORS } from '../lib/defaults'
import Sheet, { Fab } from './Sheet'
import Icon from './Icon'
import { getTheme, setTheme } from '../lib/theme'
import { CustodyEditor } from './Custody'
import { pushSupport, currentSubscription, enablePush, disablePush } from '../lib/push'

export default function Family({ me, householdId, members, membersTable, household, households, linked, custody, custodyTable }) {
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
      <ThemePicker />

      <div className="card stack">
        <h3>Medlemmar</h3>
        <ul className="list">
          {members.map((m) => m.household_id !== householdId ? (
            <li key={m.id} className="col">
              <div className="row between w100">
                <span className="row"><span className="avatar" style={{ background: m.color, width: 26, height: 26 }}>{m.short}</span><span>{m.name}</span></span>
                <span className="muted small">Delas med {linked?.households.find((h) => h.household_id === m.household_id)?.name || 'andra hushållet'}</span>
              </div>
              <CustodyEditor child={m} custody={custody} table={custodyTable} me={me} linked={linked} />
            </li>
          ) : (
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
              {m.role === 'child' && <CustodyEditor child={m} custody={custody} table={custodyTable} me={me} linked={linked} />}
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

      <SharedCustody members={members} householdId={householdId} linked={linked} membersTable={membersTable} />

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
      <h3 className="row"><Icon name="bell" size={18} /> Notiser</h3>
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

function ThemePicker() {
  const [theme, set] = useState(getTheme())
  const pick = (t) => { set(t); setTheme(t) }
  return (
    <div className="card stack">
      <h3 className="row"><Icon name="sun" size={18} /> Utseende</h3>
      <div className="seg">
        {[['auto', 'Som telefonen'], ['light', 'Ljust'], ['dark', 'Mörkt']].map(([v, l]) => (
          <button key={v} className={theme === v ? 'active' : ''} onClick={() => pick(v)}>{l}</button>
        ))}
      </div>
    </div>
  )
}

// Delad vårdnad: koppla ihop med andra vårdnadshavarens hushåll så att barnets kalender, VAB, schema och bil delas
function SharedCustody({ members, householdId, linked, membersTable }) {
  const kids = members.filter((m) => m.role === 'child' && m.household_id === householdId)
  const [pick, setPick] = useState(null)
  const [code, setCode] = useState('')
  const [input, setInput] = useState('')
  const [msg, setMsg] = useState('')
  const chosen = pick || kids.map((k) => k.id)
  const create = async () => {
    setMsg('')
    const { data, error } = await supabase.rpc('create_link_invite', { children: chosen })
    if (error) setMsg(error.message); else setCode(data)
  }
  const accept = async (e) => {
    e.preventDefault(); setMsg('')
    const { error } = await supabase.rpc('accept_link_invite', { code: input })
    if (error) return setMsg(error.message)
    setInput(''); setMsg('Klart! Nu delar ni kalender, schema, bil och barnets VAB.')
    linked.reload(); membersTable.reload()
  }
  const unlink = async (h) => {
    if (!confirm(`Sluta dela med ${h.name}? Båda hushållen behåller det de själva har lagt in.`)) return
    await supabase.from('household_links').delete().eq('id', h.link_id)
    linked.reload(); membersTable.reload()
  }
  return (
    <div className="card stack">
      <h3 className="row"><Icon name="repeat" size={18} /> Delad vårdnad</h3>
      <p className="muted small">Barnets kalender, växelvisa schema, bil och VAB syns i båda hushållen. Sysslor, stjärnor, rutiner och egna sjukdagar är fortfarande era egna.</p>
      {linked?.households.length > 0 && (
        <ul className="list">
          {linked.households.map((h) => (
            <li key={h.link_id}><span>🔗 {h.name}</span><button className="chip" onClick={() => unlink(h)}>Sluta dela</button></li>
          ))}
        </ul>
      )}
      {kids.length > 0 && (
        <>
          {kids.length > 1 && (
            <div className="chips">{kids.map((k) => (
              <button key={k.id} className={`chip ${chosen.includes(k.id) ? 'on' : ''}`}
                onClick={() => setPick(chosen.includes(k.id) ? chosen.filter((x) => x !== k.id) : [...chosen, k.id])}>{k.name}</button>
            ))}</div>
          )}
          {!code && <button onClick={create} disabled={!chosen.length}>Skapa kod till andra vårdnadshavaren</button>}
          {code && (
            <>
              <p>Hen skapar ett eget konto i appen, väljer <em>Delad vårdnad</em> och skriver:</p>
              <p className="code">{code}</p>
              <p className="muted small">Har hen redan en egen familj i appen skriver hen koden under Familj → Delad vårdnad. Koden gäller i 30 dagar.</p>
            </>
          )}
        </>
      )}
      <form className="row" onSubmit={accept}>
        <input placeholder="Har du fått en kod? (D…)" value={input} onChange={(e) => setInput(e.target.value)} autoCapitalize="characters" />
        <button disabled={!input.trim()}>Koppla</button>
      </form>
      {msg && <p className="muted">{msg}</p>}
    </div>
  )
}
