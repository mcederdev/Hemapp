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
    const { error } = mode === 'create'
      ? await supabase.rpc('create_household', { household_name: household, my_name: name })
      : await supabase.rpc('join_household', { code, my_name: name })
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
        <div className="seg">
          <button type="button" className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>Nytt hushåll</button>
          <button type="button" className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')}>Gå med med kod</button>
        </div>
        <input placeholder="Ditt namn (t.ex. Pappa eller Magnus)" value={name} onChange={(e) => setName(e.target.value)} required />
        {mode === 'create'
          ? <input placeholder="Hushållets namn (t.ex. Familjen Cederberg)" value={household} onChange={(e) => setHousehold(e.target.value)} required />
          : <input placeholder="Inbjudningskod" value={code} onChange={(e) => setCode(e.target.value)} required />}
        <button className="primary">Fortsätt</button>
        <button type="button" className="link" onClick={() => supabase.auth.signOut()}>Logga ut</button>
        {msg && <p className="error">{msg}</p>}
      </form>
    </div>
  )
}
