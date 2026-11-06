import { useState } from 'react'
import { useTable } from '../useTable'
import { startOfWeek, addDays, today, prettyDay } from '../lib/dates'
import { completeChore, showToday } from './Chores'
import Sheet from './Sheet'
import { buzz } from './Swipe'
import Mood from './Mood'

const DEFAULT_ROUTINES = {
  morning: [['🪥', 'Borsta tänderna'], ['👕', 'Klä på dig'], ['🥣', 'Äta frukost'], ['🛏️', 'Bädda sängen'], ['🎒', 'Packa väskan'], ['👟', 'Skor på']],
  evening: [['🧸', 'Plocka undan'], ['🛁', 'Bada eller duscha'], ['🩳', 'Pyjamas på'], ['🪥', 'Borsta tänderna'], ['📖', 'Läsa en saga'], ['😴', 'Sova']]
}
const EMOJIS = ['🪥', '👕', '🥣', '🛏️', '🎒', '👟', '🧥', '🧸', '🛁', '🩳', '📖', '😴', '🍎', '💧', '🐶', '🎹', '📚', '🧹', '🍽️', '⭐']

export default function Kids({ householdId, members, household, households, membersTable, go }) {
  const chores = useTable('chores', householdId)
  const routines = useTable('routines', householdId, 'sort')
  const checks = useTable('routine_checks', householdId)
  const kids = members.filter((m) => m.role === 'child')
  const [kidId, setKidId] = useState(null)
  const [part, setPart] = useState(() => (new Date().getHours() < 14 ? 'morning' : 'evening'))
  const [editing, setEditing] = useState(false)
  const [newCard, setNewCard] = useState(null)
  const [goalForm, setGoalForm] = useState(null)
  const kid = kids.find((k) => k.id === kidId) || kids[0]
  const t = today()
  const week = startOfWeek(t)
  const perStar = Number(household?.kr_per_star ?? 5)

  if (!kid) {
    return (
      <section>
        <h2>Barnens sida</h2>
        <p className="muted">Lägg till barnet under Familj först.</p>
        <button className="primary" onClick={() => go('family')}>Till Familj</button>
      </section>
    )
  }

  const theirs = chores.rows.filter((c) => c.assigned_to === kid.id)
  const todo = theirs.filter((c) => showToday(c, t) || (!c.done && c.due_date === addDays(t, 1)))
    .sort((a, b) => (a.due_date || '9').localeCompare(b.due_date || '9'))
  const doneBy = chores.rows.filter((c) => (c.done_by || c.assigned_to) === kid.id && !c.is_test && c.household_id === householdId)
  const doneIn = (from, to) => doneBy.filter((c) => c.done && c.done_at && c.done_at.slice(0, 10) >= from && c.done_at.slice(0, 10) < to)
  const thisWeek = doneIn(week, addDays(week, 7))
  const lastWeek = doneIn(addDays(week, -7), week)
  const stars = (list) => list.reduce((s, c) => s + (c.stars || 0), 0)
  const starsNow = stars(thisWeek)

  // Rutiner och dagens ring
  const cards = routines.rows.filter((r) => r.member_id === kid.id && r.part === part).sort((a, b) => a.sort - b.sort)
  const allToday = routines.rows.filter((r) => r.member_id === kid.id)
  const checkFor = (r) => checks.rows.find((c) => c.routine_id === r.id && c.day === t)
  const doneCards = cards.filter(checkFor).length
  const choresToday = theirs.filter((c) => (c.due_date === t) || (c.done && c.done_at?.slice(0, 10) === t))
  const ringTotal = allToday.length + choresToday.length
  const ringDone = allToday.filter(checkFor).length + choresToday.filter((c) => c.done).length
  const toggleCard = (r) => {
    if (editing) return confirm(`Ta bort "${r.title}"?`) && routines.remove(r.id)
    buzz()
    const c = checkFor(r)
    if (c) checks.remove(c.id)
    else checks.insert({ routine_id: r.id, day: t })
  }
  const seed = () => routines.insert(DEFAULT_ROUTINES[part].map(([emoji, title], i) => ({ member_id: kid.id, part, emoji, title, sort: i })))
  const addCard = async (e) => {
    e.preventDefault()
    if (!newCard.title.trim()) return
    await routines.insert({ member_id: kid.id, part, emoji: newCard.emoji, title: newCard.title.trim(), sort: cards.length })
    setNewCard(null)
  }

  // Sparmål: stjärnor intjänade sedan målet sattes
  const hasGoal = kid.goal_title && kid.goal_amount > 0
  const saved = hasGoal ? stars(doneBy.filter((c) => c.done && c.done_at && c.done_at.slice(0, 10) >= (kid.goal_since || '0'))) * perStar : 0
  const goalPct = hasGoal ? Math.min(100, (saved / kid.goal_amount) * 100) : 0
  const saveGoal = async (e) => {
    e.preventDefault()
    await membersTable.update(kid.id, { goal_title: goalForm.title.trim() || null, goal_amount: Number(goalForm.amount) || null, goal_since: goalForm.keep ? kid.goal_since || t : t })
    setGoalForm(null)
  }

  const hour = new Date().getHours()
  const greet = hour < 10 ? 'God morgon' : hour < 17 ? 'Hej' : 'God kväll'

  return (
    <section className="kids">
      {kids.length > 1 && (
        <div className="seg mb">
          {kids.map((k) => <button key={k.id} className={k.id === kid.id ? 'active' : ''} onClick={() => setKidId(k.id)}>{k.name}</button>)}
        </div>
      )}
      <div className="kid-top">
        <Ring done={ringDone} total={ringTotal} color={kid.color} />
        <div>
          <h2>{greet} {kid.name}!</h2>
          <p className="muted">{ringTotal === 0 ? 'Inget planerat idag' : ringDone === ringTotal ? 'Allt klart idag! 🎉' : `${ringDone} av ${ringTotal} klara idag`}</p>
        </div>
      </div>

      <Mood householdId={householdId} kid={kid} />

      <div className="seg mb mt">
        <button className={part === 'morning' ? 'active' : ''} onClick={() => setPart('morning')}>☀️ Morgon</button>
        <button className={part === 'evening' ? 'active' : ''} onClick={() => setPart('evening')}>🌙 Kväll</button>
      </div>
      {cards.length > 0 && <p className="muted small">{part === 'morning' ? 'Morgonrutin' : 'Kvällsrutin'} {doneCards}/{cards.length}</p>}
      <div className="routine-grid">
        {cards.map((r) => {
          const on = !!checkFor(r)
          return (
            <button key={r.id} className={`routine ${on && !editing ? 'on' : ''} ${editing ? 'editing' : ''}`} style={{ '--c': kid.color }} onClick={() => toggleCard(r)}>
              <span className="r-emoji">{r.emoji}</span>
              <span className="r-title">{editing ? `✕ ${r.title}` : r.title}</span>
              {on && !editing && <span className="r-check">✓</span>}
            </button>
          )
        })}
        {editing && <button className="routine add" onClick={() => setNewCard({ emoji: '⭐', title: '' })}><span className="r-emoji">＋</span><span className="r-title">Nytt kort</span></button>}
      </div>
      {cards.length === 0 && !editing && (
        <div className="card center-text">
          <p>Ingen {part === 'morning' ? 'morgonrutin' : 'kvällsrutin'} än.</p>
          <button className="primary" onClick={seed}>Lägg till förslag</button> <button onClick={() => setEditing(true)}>Gör egen</button>
        </div>
      )}
      {(cards.length > 0 || editing) && <button className="link" onClick={() => setEditing(!editing)}>{editing ? 'Klar' : 'Ändra korten'}</button>}

      <div className="card goal mt" style={{ '--c': kid.color }}>
        {hasGoal ? (
          <>
            <div className="row between"><strong>🎯 {kid.goal_title}</strong><span>{Math.round(saved)}/{kid.goal_amount} kr</span></div>
            <div className="goal-bar"><i style={{ width: `${goalPct}%` }} /></div>
            <p className="muted small">{goalPct >= 100 ? 'Målet är nått! 🎉' : `${Math.ceil((kid.goal_amount - saved) / Math.max(1, perStar))} stjärnor kvar`}</p>
            <button className="link" onClick={() => setGoalForm({ title: kid.goal_title, amount: kid.goal_amount, keep: true })}>Ändra mål</button>
            {goalPct >= 100 && <button className="link" onClick={() => setGoalForm({ title: '', amount: '', keep: false })}>Nytt mål</button>}
          </>
        ) : (
          <div className="row between"><span>🎯 Inget sparmål än</span><button onClick={() => setGoalForm({ title: '', amount: '', keep: false })}>Sätt ett mål</button></div>
        )}
      </div>

      <div className="card kid-hero" style={{ borderColor: kid.color }}>
        <div className="stars">{starsNow > 0 ? '⭐'.repeat(Math.min(starsNow, 30)) : 'Inga stjärnor än den här veckan'}</div>
        <p className="big-text">{starsNow} ⭐ = <strong>{starsNow * perStar} kr</strong> i veckopeng</p>
        {lastWeek.length > 0 && <p className="muted small">Förra veckan: {stars(lastWeek)} ⭐ ({stars(lastWeek) * perStar} kr)</p>}
      </div>

      <h3>Sysslor</h3>
      <div className="kid-tasks">
        {todo.map((c) => (
          <button key={c.id} className="kid-task" onClick={() => completeChore(chores, c, kid.id)}>
            <span className="box" />
            <span className="grow">
              {c.title}
              {c.due_date && <span className="muted small"> · {c.due_date === t ? 'idag' : prettyDay(c.due_date)}</span>}
            </span>
            {c.stars > 0 && <span>⭐{c.stars}</span>}
          </button>
        ))}
        {todo.length === 0 && <p className="muted">Inga sysslor just nu. Bra jobbat! 🎉</p>}
      </div>

      {thisWeek.length > 0 && (
        <>
          <h3>Klart den här veckan</h3>
          <ul className="list done">
            {thisWeek.map((c) => <li key={c.id} className="is-done"><span>✓ {c.title}</span>{c.stars > 0 && <span>⭐{c.stars}</span>}</li>)}
          </ul>
        </>
      )}

      <details className="card mt">
        <summary>Inställningar för veckopeng</summary>
        <label className="row between mt">
          <span>Kronor per stjärna</span>
          <input type="number" inputMode="numeric" defaultValue={perStar} style={{ maxWidth: 100 }}
            onBlur={(e) => household && households.update(household.id, { kr_per_star: Number(e.target.value) || 0 })} />
        </label>
        <p className="muted small">Ge sysslor stjärnor när du lägger till dem under Sysslor och väljer barnet. Stjärnorna räknas också mot sparmålet.</p>
      </details>

      {newCard && (
        <Sheet title="Nytt rutinkort" onClose={() => setNewCard(null)}>
          <form className="stack" onSubmit={addCard}>
            <div className="emoji-pick">
              {EMOJIS.map((e) => <button type="button" key={e} className={newCard.emoji === e ? 'on' : ''} onClick={() => setNewCard({ ...newCard, emoji: e })}>{e}</button>)}
            </div>
            <input placeholder="T.ex. Ta vitaminer" value={newCard.title} onChange={(e) => setNewCard({ ...newCard, title: e.target.value })} />
            <button className="primary">Lägg till</button>
          </form>
        </Sheet>
      )}
      {goalForm && (
        <Sheet title={`Sparmål för ${kid.name}`} onClose={() => setGoalForm(null)}>
          <form className="stack" onSubmit={saveGoal}>
            <input placeholder="T.ex. Ny boll" value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} autoFocus />
            <label className="field"><span className="muted small">Kostar (kr)</span>
              <input type="number" inputMode="numeric" value={goalForm.amount} onChange={(e) => setGoalForm({ ...goalForm, amount: e.target.value })} /></label>
            <p className="muted small">Stjärnor från sysslor räknas mot målet från och med {goalForm.keep ? 'när målet sattes' : 'idag'}.</p>
            <button className="primary">Spara</button>
          </form>
        </Sheet>
      )}
    </section>
  )
}

function Ring({ done, total, color }) {
  const r = 30, c = 2 * Math.PI * r
  const pct = total ? done / total : 0
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" className="ring" aria-label={`${done} av ${total} klara`}>
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
      <circle cx="38" cy="38" r={r} fill="none" stroke={color || 'var(--accent)'} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 38 38)" style={{ transition: 'stroke-dashoffset .4s' }} />
      <text x="38" y="43" textAnchor="middle" fontSize="16" fontWeight="700" fill="currentColor">{total ? `${Math.round(pct * 100)}%` : '–'}</text>
    </svg>
  )
}
