import { lazy, Suspense, useEffect, useState } from 'react'
import { supabase, isConfigured } from './supabase'
import { useTable, pendingCount } from './useTable'
import { useLinked } from './useLinked'
import Messages, { lastSeen } from './components/Messages'
import Shopping from './components/Shopping'
import Chores, { setSharedLink } from './components/Chores'
import Today from './components/Today'
import Icon from './components/Icon'
import { withInitials } from './components/MemberPicker'
import { applyAccent } from './lib/accent'
import { resolveMenu, SHORT, setMenuState, groupMore } from './lib/menu'
import { isTest, setTest, testSince, removeTestData } from './lib/testmode'

// Flikarna laddas först när de öppnas, så att appen startar snabbare
const Car = lazy(() => import('./components/Car'))
const Medicines = lazy(() => import('./components/Medicines'))
const Landing = lazy(() => import('./components/Landing'))
const GuestHome = lazy(() => import('./components/GuestHome'))
const Setup = lazy(() => import('./components/Setup'))
const Calendar = lazy(() => import('./components/Calendar'))
const Meals = lazy(() => import('./components/Meals'))
const Finance = lazy(() => import('./components/Finance'))
const Family = lazy(() => import('./components/Family'))
const Kids = lazy(() => import('./components/Kids'))
const Kitchen = lazy(() => import('./components/Kitchen'))
const Vab = lazy(() => import('./components/Vab'))
const Stats = lazy(() => import('./components/Stats'))
const Reminders = lazy(() => import('./components/Reminders'))
const PickupsPage = lazy(() => import('./components/Pickups').then((m) => ({ default: m.PickupsPage })))

const MenuEdit = lazy(() => import('./components/MenuEdit'))

export default function App() {
  const [session, setSession] = useState(undefined)
  const [me, setMe] = useState(undefined)
  const [guest, setGuest] = useState(null)

  useEffect(() => {
    if (!isConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      setSession(s)
      // Utloggad: rensa sparade kopior i telefonen
      if (e === 'SIGNED_OUT') { try { Object.keys(localStorage).filter((k) => k.startsWith('cache:') || k === 'outbox' || k === 'me').forEach((k) => localStorage.removeItem(k)) } catch { /* */ } }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const loadMe = async () => {
    if (!session) return setMe(undefined)
    // Snabb start: visa den sparade kopian direkt medan vi frågar servern
    const cached = (() => { try { return JSON.parse(localStorage.getItem('me') || 'null') } catch { return null } })()
    if (cached?.user_id === session.user.id) setMe((m) => m ?? cached)
    const { data, error } = await supabase.from('members').select('*').eq('user_id', session.user.id).maybeSingle()
    if (error && cached?.user_id === session.user.id) return // utan nät: behåll kopian
    if (!data) {
      const { data: g } = await supabase.from('guests').select('*').eq('user_id', session.user.id).maybeSingle()
      if (g) { setMe(null); setGuest(g); return }
    }
    try { localStorage.setItem('me', JSON.stringify(data)) } catch { /* */ }
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
  if (!session) return <Landing />
  if (me === undefined) return <div className="center">Laddar…</div>
  if (!me && guest) return <GuestHome guest={guest} />
  if (!me) return <Setup onDone={loadMe} />
  return <Home me={me} />
}

function Home({ me }) {
  const [tab, setTab] = useState(() => {
    let fromUrl = new URLSearchParams(location.search).get('tab')
    if (fromUrl) history.replaceState(null, '', '/')
    // Notisen om övertid öppnar Ekonomi → Övertid
    if (fromUrl === 'overtime') { localStorageSet('financeView', 'overtime'); fromUrl = 'finance' }
    return fromUrl || localStorageGet('tab') || 'today'
  })
  const members = useTable('members', me.household_id)
  const households = useTable('households', me.household_id)
  const linked = useLinked(me.household_id)
  setSharedLink(linked.households[0]?.link_id || null)
  const custodyRaw = useTable('custody', me.household_id)
  const custodyExc = useTable('custody_exceptions', me.household_id, 'from_date')
  const custody = { ...custodyRaw, rows: custodyRaw.rows.map((c) => ({ ...c, exceptions: custodyExc.rows.filter((e) => e.custody_id === c.id) })) }
  const messages = useTable('messages', me.household_id, 'created_at')
  const guestsT = useTable('guests', me.household_id)
  // Familjeremsan: vald person filtrerar Idag, Kalender och Sysslor
  const [focus, setFocusState] = useState(() => localStorageGet('focus') || null)
  const setFocus = (id) => { setFocusState(id); localStorageSet('focus', id || '') }
  const pick = (id) => { if (id !== 'kitchen') localStorageSet('tab', id); setTab(id); window.scrollTo(0, 0) }
  const household = households.rows[0]
  // Familjens ordning (Familj → Medlemmar), annars i den ordning de lades till
  const ord = household?.member_order || []
  const rank = (m) => { const i = ord.indexOf(m.id); return i === -1 ? 999 : i }
  const sorted = (list) => [...list].sort((a, b) => rank(a) - rank(b))
  // Smeknamn: bara för den inloggade (sparas på ens egen rad), riktiga namnet finns kvar i realName
  const nick = members.rows.find((m) => m.id === me.id)?.nicknames || {}
  const named = (list) => list.map((m) => (nick[m.id] ? { ...m, name: nick[m.id], realName: m.name } : m))
  const all = withInitials(named(sorted(members.rows)))
  // Alla personer vi kan behöva visa namn för, även föräldrar i det andra hushållet
  const people = withInitials(named([...sorted(members.rows), ...linked.people.filter((p) => !members.rows.some((m) => m.id === p.id)).map((p) => ({ ...p, role: 'parent', linked: true }))]))
  const props = { me, householdId: me.household_id, members: all, people, linked, custody: custody.rows, custodyTable: custodyRaw, custodyExc, membersTable: members, household, households, go: pick, guests: guestsT.rows, guestsTable: guestsT,
    focus: all.some((m) => m.id === focus) ? focus : null, setFocus }
  useEffect(() => { applyAccent(household?.theme?.accent) }, [household?.theme?.accent])
  // Menyn enligt egna val (Mer → Anpassa menyn)
  const myMenu = members.rows.find((m) => m.id === me.id)?.menu
  const menu = resolveMenu(myMenu)
  setMenuState(myMenu)
  const TABS = [...menu.bar, { id: 'more', label: 'Mer', icon: 'menu' }]
  const MORE = menu.more
  const active = TABS.some((t) => t.id === tab) ? tab : 'more'
  const seen = lastSeen()
  const unread = tab === 'messages' ? 0 : messages.rows.filter((m) => m.author !== me.id && m.created_at > seen).length
  const badge = { messages: unread }

  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(pendingCount())
  useEffect(() => {
    const up = () => { setOnline(navigator.onLine); setPending(pendingCount()) }
    for (const e of ['online', 'offline', 'outbox-changed', 'outbox-flushed']) window.addEventListener(e, up)
    return () => { for (const e of ['online', 'offline', 'outbox-changed', 'outbox-flushed']) window.removeEventListener(e, up) }
  }, [])
  const offlineBar = !online || pending ? <div className="offline-bar">{online ? `Skickar ${pending} ändringar…` : `Ingen anslutning${pending ? ` · ${pending} ändringar skickas sen` : ''}`}</div> : null

  // Testläge: det man gör räknas inte i statistiken och kan tas bort när man avslutar. Gäller bara den här telefonen.
  const [test, setTestState] = useState(isTest())
  useEffect(() => { const up = () => setTestState(isTest()); window.addEventListener('testmode-changed', up); return () => window.removeEventListener('testmode-changed', up) }, [])
  const toggleTest = async () => {
    if (!test) { if (confirm('Starta testläge? Det du gör nu räknas inte i statistiken, och du kan ta bort det när du avslutar.')) setTest(true); return }
    if (confirm('Ta bort det som skapades i testläget? (Avbryt = behåll det, men det räknas ändå inte i statistiken)')) {
      const n = await removeTestData(testSince())
      alert(`Testläget är avslutat. ${n} ${n === 1 ? 'sak' : 'saker'} togs bort.`)
    }
    setTest(false)
  }
  // Engångsnollning av statistiken (nov 2026): räkna allt från nu och nollställ mest köpta varor
  useEffect(() => {
    if (!household || household.stats_from) return
    households.update(household.id, { stats_from: new Date().toISOString() })
    supabase.from('item_catalog').update({ times_added: 0 }).eq('household_id', me.household_id).gt('times_added', 0).then(() => {})
  }, [household?.id, household?.stats_from])
  const testBar = test ? <div className="test-bar"><span>🧪 TESTLÄGE · räknas inte i statistiken</span><button onClick={toggleTest}>Avsluta</button></div> : null

  if (tab === 'kitchen') return <div className={test ? 'testmode' : ''}>{testBar}<Kitchen {...props} onExit={() => pick('today')} /></div>

  return (
    <div className={`app ${household?.theme?.accent ? 'own-accent' : ''} ${test ? 'testmode' : ''}`} data-tab={tab}>
      {testBar}
      {offlineBar}
      <main>
        <Suspense fallback={<p className="muted pad">Laddar…</p>}>
        {tab === 'today' && <Today {...props} />}
        {tab === 'more' && (
          <section>
            <h2>Mer</h2>
            {groupMore(MORE).map(([name, list]) => (
              <div key={name}>
                <h4 className="more-group">{name}</h4>
                <ul className="list">
                  {list.map((m) => (
                    <li key={m.id} className="tap" onClick={() => pick(m.id)}><span className="row"><Icon name={m.icon} /> {m.label}{badge[m.id] > 0 && <span className="count">{badge[m.id]}</span>}</span><Icon name="chevron" size={18} className="muted" /></li>
                  ))}
                  {name === 'Inställningar' && <MoreSettings pick={pick} test={test} toggleTest={toggleTest} />}
                </ul>
              </div>
            ))}
            {!groupMore(MORE).some(([n]) => n === 'Inställningar') && <><h4 className="more-group">Inställningar</h4><ul className="list"><MoreSettings pick={pick} test={test} toggleTest={toggleTest} /></ul></>}
            <p className="muted small">I testläget räknas inget du gör i statistiken eller i barnens stjärnor. Gäller bara den här telefonen.</p>
          </section>
        )}
        {tab === 'kids' && <Kids {...props} />}
        {tab === 'shopping' && <Shopping {...props} />}
        {tab === 'chores' && <Chores {...props} />}
        {tab === 'calendar' && <Calendar {...props} />}
        {tab === 'meals' && <Meals {...props} />}
        {tab === 'finance' && <Finance {...props} />}
        {tab === 'vab' && <Vab {...props} />}
        {tab === 'stats' && <Stats {...props} />}
        {tab === 'reminders' && <Reminders {...props} />}
        {tab === 'car' && <Car {...props} />}
        {tab === 'medicine' && <Medicines {...props} />}
        {tab === 'pickups' && <PickupsPage {...props} people={[...people, ...guestsT.rows.map((g) => ({ ...g, role: 'guest', short: g.name.slice(0, 1).toUpperCase() }))]} />}
        {tab === 'messages' && <section><h2>Meddelanden</h2><Messages {...props} /></section>}
        {tab === 'family' && <Family {...props} />}
        {tab === 'menu' && <MenuEdit menu={myMenu} onChange={(m) => members.update(me.id, { menu: m })} />}
        </Suspense>
      </main>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={active === t.id ? 'active' : ''} onClick={() => pick(t.id)}>
            <span className="tab-ico"><Icon name={t.icon} size={24} strokeWidth={active === t.id ? 2.4 : 1.8} />{(t.id === 'more' ? MORE.some((m) => m.id === 'messages') : t.id === 'messages') && unread > 0 && <span className="tab-badge">{unread}</span>}</span>
            <span>{t.id === 'more' ? t.label : SHORT[t.id] || t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function localStorageGet(k) { try { return localStorage.getItem(k) } catch { return null } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v) } catch { /* ignoreras */ } }

// Sista raderna under Inställningar på Mer
function MoreSettings({ pick, test, toggleTest }) {
  return (
    <>
      <li className="tap" onClick={() => pick('menu')}><span className="row"><Icon name="menu" /> Anpassa menyn</span><Icon name="chevron" size={18} className="muted" /></li>
      <li className="tap" onClick={toggleTest}><span className="row">🧪 Testläge{test && <span className="count test-on">PÅ</span>}</span><span className="muted small">{test ? 'Avsluta' : 'Starta'}</span></li>
    </>
  )
}
