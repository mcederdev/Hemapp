import { useState } from 'react'
import { supabase } from '../supabase'

export default function Setup({ onDone }) {
  const [name, setName] = useState('')
  const [household, setHousehold] = useState('')
  const [code, setCode] = useState('')
  const [mode, setMode] = useState('create')
  const [msg, setMsg] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setMsg('')
    // Se till att inloggningen fortfarande gäller innan hushållet skapas
    const { data: auth } = await supabase.auth.getSession()
    if (!auth.session) {
      await supabase.auth.signOut()
      return
    }
    let { error } = mode === 'guest'
      ? await supabase.rpc('accept_guest_invite', { code, my_name: name })
      : mode === 'join'
      ? await supabase.rpc('join_household', { code, my_name: name })
      : await supabase.rpc('create_household', { household_name: household, my_name: name })
    // Delad vårdnad: eget hushåll som kopplas till det som skickade koden
    if (!error && mode === 'link') {
      const r = await supabase.rpc('accept_link_invite', { code })
      if (r.error) alert(`Familjen är skapad, men koden fungerade inte (${r.error.message}). Du kan skriva in den igen under Familj → Delad vårdnad.`)
    }
    if (error) {
      if (error.code === '42501') {
        await supabase.auth.signOut()
        return
      }
      return setMsg(error.message)
    }
    onDone()
  }

  return (
    <div className="center">
      <form className="card stack" onSubmit={submit}>
        <h1>Välkommen!</h1>
        <p className="muted">Hur vill du börja?</p>
        <div className="setup-opts" role="radiogroup">
          {[['create', '🏠 Ny familj', 'Ni är först i familjen att använda appen'],
            ['join', '👋 Gå med i min familj', 'Någon i ditt hushåll har redan skapat familjen och gett dig en kod'],
            ['link', '🔁 Delad vårdnad', 'Du har ett eget hem, och barnet bor växelvis hos dig och den andra föräldern'],
            ['guest', '👵 Jag är gäst', 'Du är t.ex. mor- eller farförälder och har fått en kod (G…) från familjen']].map(([v, t, d]) => (
            <button type="button" key={v} role="radio" aria-checked={mode === v} className={`setup-opt ${mode === v ? 'on' : ''}`} onClick={() => setMode(v)}>
              <strong>{t}</strong><span className="muted small">{d}</span>
            </button>
          ))}
        </div>
        <input placeholder={mode === 'guest' ? 'Ditt namn (t.ex. Mormor)' : 'Ditt namn (t.ex. Pappa eller Magnus)'} value={name} onChange={(e) => setName(e.target.value)} required />
        {mode !== 'join' && mode !== 'guest' && <input placeholder="Hushållets namn (t.ex. Familjen Ek)" value={household} onChange={(e) => setHousehold(e.target.value)} required />}
        {mode !== 'create' && <input placeholder={mode === 'link' ? 'Kod från andra vårdnadshavaren (D…)' : mode === 'guest' ? 'Gästkod (G…)' : 'Inbjudningskod'} value={code} onChange={(e) => setCode(e.target.value)} required />}
        <button className="primary">Fortsätt</button>
        <button type="button" className="link" onClick={() => supabase.auth.signOut()}>Logga ut</button>
        {msg && <p className="error">{msg}</p>}
      </form>
    </div>
  )
}
