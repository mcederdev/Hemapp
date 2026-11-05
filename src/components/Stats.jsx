import { useState } from 'react'
import { useTable } from '../useTable'
import { today, startOfWeek, addDays } from '../lib/dates'
import { MemberTag } from './MemberPicker'
import VabStats from './VabStats'

// Statistiksidan: sysslor, sjukdagar och VAB, mat och handling
export default function Stats({ householdId, members, people }) {
  const [view, setView] = useState('chores')
  const vab = useTable('vab_days', householdId, 'day')
  return (
    <section>
      <h2>Statistik</h2>
      <div className="seg mb">
        <button className={view === 'chores' ? 'active' : ''} onClick={() => setView('chores')}>Sysslor</button>
        <button className={view === 'sick' ? 'active' : ''} onClick={() => setView('sick')}>Sjuk & VAB</button>
        <button className={view === 'food' ? 'active' : ''} onClick={() => setView('food')}>Mat & handla</button>
      </div>
      {view === 'chores' && <ChoreStats householdId={householdId} members={members} />}
      {view === 'sick' && <VabStats rows={vab.rows} members={people || members} />}
      {view === 'food' && <FoodStats householdId={householdId} />}
    </section>
  )
}

const PERIODS = [['week', 'Vecka'], ['month', 'Månad'], ['year', 'År']]

function ChoreStats({ householdId, members }) {
  const chores = useTable('chores', householdId)
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

function FoodStats({ householdId }) {
  const meals = useTable('meal_plan', householdId, 'day')
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
      <div className="stat-tiles">
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

function Bar({ label, n, max }) {
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <span className="bar-track"><i style={{ width: `${(n / max) * 100}%`, background: 'var(--accent)' }} /></span>
      <span className="bar-n">{n}</span>
    </div>
  )
}

function isoWeek(s) {
  const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7)
}
