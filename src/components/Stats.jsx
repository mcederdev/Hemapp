import { useState } from 'react'
import { useTable } from '../useTable'
import { today, startOfWeek, addDays } from '../lib/dates'
import { MemberTag } from './MemberPicker'
import VabStats from './VabStats'
import { counts } from '../lib/testmode'
import { pickSub, shows } from '../lib/menu'

// Statistiksidan: sysslor, sjukdagar och VAB, mat och handling
export default function Stats({ householdId, members, people, household }) {
  const from = household?.stats_from
  const [rawView, setView] = useState('chores')
  const view = pickSub('stats', rawView, [])
  const vab = useTable('vab_days', householdId, 'day')
  return (
    <section>
      <h2>Statistik</h2>
      <div className="seg mb">
        {shows('stats.chores') && <button className={view === 'chores' ? 'active' : ''} onClick={() => setView('chores')}>Sysslor</button>}
        {shows('stats.sick') && <button className={view === 'sick' ? 'active' : ''} onClick={() => setView('sick')}>Sjuk & VAB</button>}
        {shows('stats.food') && <button className={view === 'food' ? 'active' : ''} onClick={() => setView('food')}>Mat</button>}
        {shows('stats.pickups') && <button className={view === 'pickups' ? 'active' : ''} onClick={() => setView('pickups')}>Hämta</button>}
      </div>
      {view === 'chores' && <ChoreStats householdId={householdId} members={members} since={from} />}
      {view === 'sick' && <VabStats rows={vab.rows.filter((r) => !r.is_test)} members={people || members} />}
      {view === 'food' && <FoodStats householdId={householdId} since={from} />}
      {view === 'pickups' && <PickupStats householdId={householdId} people={people || members} since={from} />}
    </section>
  )
}

const PERIODS = [['week', 'Vecka'], ['month', 'Månad'], ['year', 'År']]

function ChoreStats({ householdId, members, since }) {
  const choresT = useTable('chores', householdId)
  const chores = { rows: choresT.rows.filter((c) => (c.household_id === householdId || members.some((m) => m.id === (c.done_by || c.assigned_to))) && (!c.done || counts(c, 'done_at', since))) }
  const [period, setPeriod] = useState('month')
  const t = today()
  const from = period === 'week' ? startOfWeek(t) : period === 'month' ? t.slice(0, 7) + '-01' : t.slice(0, 4) + '-01-01'
  const done = chores.rows.filter((c) => c.done && c.done_at && c.done_at.slice(0, 10) >= from)
  const who = (c) => c.done_by || c.assigned_to
  const perMember = members.map((m) => ({ m, n: done.filter((c) => who(c) === m.id).length, stars: done.filter((c) => who(c) === m.id).reduce((s, c) => s + (c.stars || 0), 0) }))
  const unknown = done.filter((c) => !who(c)).length
  const max = Math.max(1, ...perMember.map((x) => x.n))
  const total = done.length

  // Vanligaste sysslorna och vem som oftast gör dem
  const byTitle = new Map()
  for (const c of done) {
    const k = c.title.trim()
    const e = byTitle.get(k) || { n: 0, by: {} }
    e.n++; if (who(c)) e.by[who(c)] = (e.by[who(c)] || 0) + 1
    byTitle.set(k, e)
  }
  const top = [...byTitle.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8)
  const byId = Object.fromEntries(members.map((m) => [m.id, m]))

  // Senaste 8 veckorna
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(startOfWeek(t), -7 * (7 - i)))
  const weekRows = weeks.map((w) => members.map((m) => chores.rows.filter((c) => c.done && c.done_at && who(c) === m.id && c.done_at.slice(0, 10) >= w && c.done_at.slice(0, 10) < addDays(w, 7)).length))
  const weekMax = Math.max(1, ...weekRows.map((r) => r.reduce((a, b) => a + b, 0)))
  const late = chores.rows.filter((c) => !c.done && c.due_date && c.due_date < t).length

  return (
    <div>
      <div className="seg mb small-seg">
        {PERIODS.map(([v, l]) => <button key={v} className={period === v ? 'active' : ''} onClick={() => setPeriod(v)}>{l}</button>)}
      </div>
      <div className="stat-tiles">
        <div className="stat-tile"><strong>{total}</strong><span>gjorda</span></div>
        <div className="stat-tile"><strong>{perMember.reduce((s, x) => s + x.stars, 0)}</strong><span>stjärnor</span></div>
        <div className="stat-tile"><strong className={late ? 'error' : ''}>{late}</strong><span>sena nu</span></div>
      </div>

      <div className="card mt">
        <strong>Vem gjorde vad</strong>
        <div className="bars mt">
          {perMember.map(({ m, n, stars }) => (
            <div key={m.id} className="bar-row">
              <span className="bar-label row"><MemberTag member={m} size={22} /> {m.name}</span>
              <span className="bar-track"><i style={{ width: `${(n / max) * 100}%`, background: m.color }} /></span>
              <span className="bar-n">{n}</span>
            </div>
          ))}
        </div>
        {total > 0 && <p className="muted small">{perMember.filter((x) => x.n).map((x) => `${x.m.name} ${Math.round((x.n / total) * 100)} %`).join(' · ')}{unknown ? ` · ${unknown} utan namn` : ''}{perMember.some((x) => x.stars) ? ` · ${perMember.filter((x) => x.stars).map((x) => `${x.m.name} ${x.stars} ⭐`).join(', ')}` : ''}</p>}
      </div>

      <div className="card">
        <strong>Senaste 8 veckorna</strong>
        <div className="months weeks mt">
          {weekRows.map((r, i) => (
            <div key={i} className="mcol">
              <span className="mval">{r.reduce((a, b) => a + b, 0) || ''}</span>
              <div className="stack-col" style={{ height: `${(r.reduce((a, b) => a + b, 0) / weekMax) * 100}%` }}>
                {r.map((n, j) => n ? <i key={j} style={{ flex: n, background: members[j].color }} /> : null)}
              </div>
              <span className="mlabel">v{isoWeek(weeks[i])}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <strong>Vanligaste sysslorna</strong>
        {top.length === 0 && <p className="muted small">Inga gjorda sysslor under perioden.</p>}
        <ul className="plain mt">
          {top.map(([title, e]) => (
            <li key={title} className="row between small">
              <span>{title}</span>
              <span className="row">{e.n}× {Object.entries(e.by).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => <MemberTag key={id} member={byId[id]} size={20} />)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function FoodStats({ householdId, since }) {
  const mealsT = useTable('meal_plan', householdId, 'day')
  const meals = { rows: mealsT.rows.filter((m) => counts(m, 'day', since)) }
  const catalog = useTable('item_catalog', householdId)
  const t = today()
  const year = meals.rows.filter((m) => m.day >= addDays(t, -365) && m.day <= t)
  const dishCount = new Map()
  for (const m of year) dishCount.set(m.dish, (dishCount.get(m.dish) || 0) + 1)
  const dishes = [...dishCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  const items = [...catalog.rows].sort((a, b) => (b.times_added || 0) - (a.times_added || 0)).slice(0, 10)
  const dmax = Math.max(1, ...dishes.map((d) => d[1])), imax = Math.max(1, ...items.map((i) => i.times_added || 0))
  const planned = meals.rows.filter((m) => m.day >= addDays(t, -28) && m.day <= t).length
  return (
    <div>
      <FoodSpend householdId={householdId} since={since} />
      <div className="stat-tiles mt">
        <div className="stat-tile"><strong>{dishCount.size}</strong><span>olika rätter i år</span></div>
        <div className="stat-tile"><strong>{Math.round((planned / 28) * 100)} %</strong><span>planerade middagar (4 v)</span></div>
        <div className="stat-tile"><strong>{catalog.rows.length}</strong><span>varor ni köpt</span></div>
      </div>
      <div className="card mt">
        <strong>Mest ätna middagar</strong>
        {dishes.length === 0 && <p className="muted small">Lägg in middagar i veckomenyn så fylls det här på.</p>}
        <div className="bars mt">{dishes.map(([d, n]) => <Bar key={d} label={d} n={n} max={dmax} />)}</div>
      </div>
      <div className="card">
        <strong>Mest köpta varor</strong>
        {items.length === 0 && <p className="muted small">Inget köpt än.</p>}
        <div className="bars mt">{items.map((i) => <Bar key={i.id} label={i.name} n={i.times_added || 0} max={imax} />)}</div>
      </div>
    </div>
  )
}

function Bar({ label, n, max, fmt = (x) => x }) {
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <span className="bar-track"><i style={{ width: `${(n / max) * 100}%`, background: 'var(--accent)' }} /></span>
      <span className="bar-n">{fmt(n)}</span>
    </div>
  )
}

function isoWeek(s) {
  const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7)
}

const kr = (n) => Math.round(n).toLocaleString('sv-SE') + ' kr'
// Matkostnad: vad handlingen kostat per månad (fylls i när man trycker "Klar med handlingen")
function FoodSpend({ householdId, since }) {
  const spendT = useTable('grocery_spend', householdId, 'day')
  const spend = { ...spendT, rows: spendT.rows.filter((r) => counts(r, 'day', since)) }
  const [amount, setAmount] = useState('')
  const t = today()
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(t + 'T12:00'); d.setDate(1); d.setMonth(d.getMonth() - (5 - i)); return d.toISOString().slice(0, 7) })
  const sum = (m) => spend.rows.filter((r) => r.day.slice(0, 7) === m).reduce((a, r) => a + Number(r.amount), 0)
  const sums = months.map((m) => [m, sum(m)])
  const max = Math.max(1, ...sums.map((x) => x[1]))
  const prev = sums.slice(0, 5).filter((x) => x[1] > 0)
  const avg = prev.length ? prev.reduce((a, x) => a + x[1], 0) / prev.length : 0
  const add = async (e) => {
    e.preventDefault()
    const n = Number(amount.replace(/\s/g, '').replace(',', '.'))
    if (n > 0) await spend.insert({ amount: n, day: t })
    setAmount('')
  }
  const name = (m) => new Date(m + '-15T12:00').toLocaleDateString('sv-SE', { month: 'short' }).replace('.', '')
  return (
    <div className="card">
      <strong>Matkostnad</strong>
      <div className="stat-tiles mt">
        <div className="stat-tile"><strong>{kr(sums[5][1])}</strong><span>den här månaden</span></div>
        <div className="stat-tile"><strong>{kr(sums[4][1])}</strong><span>förra månaden</span></div>
        <div className="stat-tile"><strong>{avg ? kr(avg) : '–'}</strong><span>snitt per månad</span></div>
      </div>
      {spend.rows.length === 0 && <p className="muted small">Efter "Jag handlar nu" frågar appen vad det kostade. Du kan också skriva in ett kvitto här.</p>}
      <div className="bars mt">{sums.map(([m, n]) => <Bar key={m} label={name(m)} n={n} max={max} fmt={kr} />)}</div>
      <form className="row mt" onSubmit={add}>
        <input inputMode="decimal" placeholder="Lägg till kvitto (kr)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button disabled={!amount.trim()}>Lägg till</button>
      </form>
      {spend.rows.length > 0 && (
        <ul className="list plain mt small">
          {[...spend.rows].reverse().slice(0, 5).map((r) => (
            <li key={r.id} className="row between"><span className="muted">{r.day.slice(5).replace('-', '/')} {r.store || ''}</span><span className="row">{kr(r.amount)}<button className="icon-btn" onClick={() => confirm('Ta bort kvittot?') && spend.remove(r.id)} aria-label="Ta bort">✕</button></span></li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Lämna och hämta: vem har gjort det. "Båda" räknas för båda föräldrarna.
function PickupStats({ householdId, people, since }) {
  const pickupsT = useTable('pickups', householdId, 'day')
  const pickups = { rows: pickupsT.rows.filter((p) => counts(p, 'day', since)) }
  const [period, setPeriod] = useState('month')
  const t = today()
  const from = period === 'week' ? startOfWeek(t) : period === 'month' ? t.slice(0, 7) + '-01' : t.slice(0, 4) + '-01-01'
  const rows = pickups.rows.filter((p) => p.day >= from && p.day <= t && (p.person_id || p.person_name || p.both_parents))
  const adults = people.filter((m) => m.role !== 'child' && m.role !== 'guest')
  const count = new Map()
  const add = (key, kind) => { const e = count.get(key) || { lamna: 0, hamta: 0 }; e[kind]++; count.set(key, e) }
  for (const p of rows) {
    if (p.both_parents) adults.filter((m) => m.household_id === p.household_id).forEach((m) => add(m.id, p.kind))
    else add(p.person_id || 'n:' + p.person_name, p.kind)
  }
  const byId = Object.fromEntries(people.map((m) => [m.id, m]))
  const list = [...count.entries()].map(([k, e]) => ({ k, m: byId[k], name: byId[k]?.name || k.replace(/^n:/, ''), ...e, n: e.lamna + e.hamta })).sort((a, b) => b.n - a.n)
  const max = Math.max(1, ...list.map((x) => x.n))
  const together = rows.filter((p) => p.both_parents).length
  return (
    <div>
      <div className="seg mb small-seg">
        {PERIODS.map(([v, l]) => <button key={v} className={period === v ? 'active' : ''} onClick={() => setPeriod(v)}>{l}</button>)}
      </div>
      <div className="stat-tiles">
        <div className="stat-tile"><strong>{rows.filter((p) => p.kind === 'lamna').length}</strong><span>lämningar</span></div>
        <div className="stat-tile"><strong>{rows.filter((p) => p.kind === 'hamta').length}</strong><span>hämtningar</span></div>
        <div className="stat-tile"><strong>{together}</strong><span>tillsammans</span></div>
      </div>
      <div className="card mt">
        <strong>Vem lämnar och hämtar</strong>
        {list.length === 0 && <p className="muted small">Inget valt under perioden. Det räknas när ni väljer vem under Mer → Lämna och hämta.</p>}
        <div className="bars mt">
          {list.map((x) => (
            <div key={x.k} className="bar-row">
              <span className="bar-label row">{x.m ? <MemberTag member={x.m} size={22} /> : '👤'} {x.name}</span>
              <span className="bar-track"><i style={{ width: `${(x.n / max) * 100}%`, background: x.m?.color || 'var(--accent)' }} /></span>
              <span className="bar-n">{x.n}</span>
            </div>
          ))}
        </div>
        {list.length > 0 && <p className="muted small">{list.map((x) => `${x.name}: lämnat ${x.lamna}, hämtat ${x.hamta}`).join(' · ')}</p>}
        {together > 0 && <p className="muted small">När ni gjort det tillsammans räknas det för er båda.</p>}
      </div>
    </div>
  )
}
