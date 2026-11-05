import { useState } from 'react'
import { supabase } from '../supabase'

export default function Auth({ initialMode = 'login', onBack = null }) {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setMsg('')
    const fn = mode === 'login' ? supabase.auth.signInWithPassword : supabase.auth.signUp
    const { data, error } = await fn.call(supabase.auth, { email, password, options: { emailRedirectTo: window.location.origin } })
    setBusy(false)
    if (error) return setMsg(error.message)
    if (mode === 'signup' && !data.session) setMsg('Kolla din mejl och bekräfta kontot, logga sedan in.')
  }

  return (
    <div className="center">
      <form className="card stack" onSubmit={submit}>
        <h1>🏡 Hemappen</h1>
        <input type="email" placeholder="E-post" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <input type="password" placeholder="Lösenord (minst 6 tecken)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        <button className="primary" disabled={busy}>{mode === 'login' ? 'Logga in' : 'Skapa konto'}</button>
        {msg && <p className="muted">{msg}</p>}
        <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Inget konto? Skapa ett' : 'Har du konto? Logga in'}
        </button>
        {onBack && <button type="button" className="link muted" onClick={onBack}>← Vad är Hemappen?</button>}
      </form>
    </div>
  )
}
