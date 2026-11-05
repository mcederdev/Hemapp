import { useEffect, useState } from 'react'
import { supabase, isConfigured } from './supabase'
import { useTable } from './useTable'
import Auth from './components/Auth'
import Setup from './components/Setup'
import Shopping from './components/Shopping'
import Chores from './components/Chores'
import Calendar from './components/Calendar'
import Meals from './components/Meals'
import Finance from './components/Finance'
import Family from './components/Family'

const TABS = [
  { id: 'shopping', label: 'Handla', icon: '🛒' },
  { id: 'chores', label: 'Att göra', icon: '✅' },
  { id: 'calendar', label: 'Kalender', icon: '📅' },
  { id: 'meals', label: 'Mat', icon: '🍝' },
  { id: 'finance', label: 'Ekonomi', icon: '💰' },
  { id: 'family', label: 'Familj', icon: '👪' }
]

export default function App() {
  const [session, setSession] = useState(undefined)
  const [me, setMe] = useState(undefined)

  useEffect(() => {
    if (!isConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const loadMe = async () => {
    if (!session) return setMe(undefined)
    const { data } = await supabase.from('members').select('*').eq('user_id', session.user.id).maybeSingle()
    setMe(data)
  }
  useEffect(() => { loadMe() }, [session])

  if (!isConfigured) {
    return (
      <div className="center card">
        <h1>Hemappen</h1>
        <p>Supabase är inte inställt än. Lägg in VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY (se README).</p>
      </div>
    )
  }
  if (session === undefined) return <div className="center">Laddar…</div>
  if (!session) return <Auth />
  if (me === undefined) return <div className="center">Laddar…</div>
  if (!me) return <Setup onDone={loadMe} />
  return <Home me={me} />
}

function Home({ me }) {
  const [tab, setTab] = useState(() => localStorageGet('tab') || 'shopping')
  const members = useTable('members', me.household_id)
  const pick = (id) => { setTab(id); localStorageSet('tab', id) }
  const props = { me, householdId: me.household_id, members: members.rows, membersTable: members }

  return (
    <div className="app">
      <main>
        {tab === 'shopping' && <Shopping {...props} />}
        {tab === 'chores' && <Chores {...props} />}
        {tab === 'calendar' && <Calendar {...props} />}
        {tab === 'meals' && <Meals {...props} />}
        {tab === 'finance' && <Finance {...props} />}
        {tab === 'family' && <Family {...props} />}
      </main>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => pick(t.id)}>
            <span className="icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function localStorageGet(k) { try { return localStorage.getItem(k) } catch { return null } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v) } catch { /* ignoreras */ } }
