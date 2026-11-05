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
import Today from './components/Today'
import Kids from './components/Kids'
import Icon from './components/Icon'
import { withInitials } from './components/MemberPicker'

const TABS = [
  { id: 'today', label: 'Idag', icon: 'home' },
  { id: 'shopping', label: 'Handla', icon: 'cart' },
  { id: 'chores', label: 'Sysslor', icon: 'checks' },
  { id: 'calendar', label: 'Kalender', icon: 'calendar' },
  { id: 'meals', label: 'Mat', icon: 'food' },
  { id: 'more', label: 'Mer', icon: 'menu' }
]
const MORE = [
  { id: 'finance', label: 'Ekonomi', icon: 'wallet' },
  { id: 'kids', label: 'Barnens sida', icon: 'star' },
  { id: 'family', label: 'Familj & inställningar', icon: 'users' }
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
  const [tab, setTab] = useState(() => {
    const fromUrl = new URLSearchParams(location.search).get('tab')
    if (fromUrl) history.replaceState(null, '', '/')
    return fromUrl || localStorageGet('tab') || 'today'
  })
  const members = useTable('members', me.household_id)
  const households = useTable('households', me.household_id)
  const pick = (id) => { setTab(id); localStorageSet('tab', id); window.scrollTo(0, 0) }
  const household = households.rows[0]
  const props = { me, householdId: me.household_id, members: withInitials(members.rows), membersTable: members, household, households, go: pick }
  const active = MORE.some((m) => m.id === tab) ? 'more' : tab

  return (
    <div className="app">
      <main>
        {tab === 'today' && <Today {...props} />}
        {tab === 'more' && (
          <section>
            <h2>Mer</h2>
            <ul className="list">
              {MORE.map((m) => (
                <li key={m.id} className="tap" onClick={() => pick(m.id)}><span className="row"><Icon name={m.icon} /> {m.label}</span><Icon name="chevron" size={18} className="muted" /></li>
              ))}
            </ul>
          </section>
        )}
        {tab === 'kids' && <Kids {...props} />}
        {tab === 'shopping' && <Shopping {...props} />}
        {tab === 'chores' && <Chores {...props} />}
        {tab === 'calendar' && <Calendar {...props} />}
        {tab === 'meals' && <Meals {...props} />}
        {tab === 'finance' && <Finance {...props} />}
        {tab === 'family' && <Family {...props} />}
      </main>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={active === t.id ? 'active' : ''} onClick={() => pick(t.id)}>
            <Icon name={t.icon} size={24} strokeWidth={active === t.id ? 2.4 : 1.8} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function localStorageGet(k) { try { return localStorage.getItem(k) } catch { return null } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v) } catch { /* ignoreras */ } }
