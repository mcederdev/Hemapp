import { useState } from 'react'
import { useTable } from '../useTable'
import { today, prettyDay } from '../lib/dates'
import { simpleRrule } from '../lib/rrule'
import { guessSection } from '../lib/sections'
import { guessCategory } from '../lib/categories'
import { parseQuick, guessKind } from '../lib/quickadd'
import { shows } from '../lib/menu'
import Sheet, { Fab } from './Sheet'

const KINDS = [['event', '📅 Händelse', 'calendar'], ['item', '🛒 Vara', 'shopping'], ['chore', '✅ Syssla', 'chores'], ['note', '📝 Lapp', null]]
const REPEAT = { weekly: 'varje vecka', biweekly: 'varannan vecka', daily: 'varje dag', monthly: 'varje månad', yearly: 'varje år', weekdays: 'varje vardag' }

// Ett plus för allt: skriv som du pratar, så läser appen ut dag, tid och person
export default function QuickAdd({ householdId, members, me, household }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Fab onClick={() => setOpen(true)} label="Lägg till" />
      {open && <QuickSheet householdId={householdId} members={members} me={me} household={household} onClose={() => setOpen(false)} />}
    </>
  )
}

function QuickSheet({ householdId, members, me, household, onClose }) {
  const events = useTable('events', householdId, 'starts_at')
  const chores = useTable('chores', householdId)
  const items = useTable('shopping_items', householdId)
  const lists = useTable('shopping_lists', householdId)
  const notes = useTable('notes', householdId)
  const [text, setText] = useState('')
  const [kind, setKind] = useState(null)
  const [done, setDone] = useState(null)
  const t = today()
  const q = parseQuick(text, { today: t, members })
  const k = kind || (text.trim() ? guessKind(text, q) : 'event')
  const byId = Object.fromEntries(members.map((m) => [m.id, m]))
  const kinds = KINDS.filter(([, , page]) => !page || shows(page))
  const defaultList = lists.rows.find((l) => l.is_default)

  const preview = () => {
    if (!text.trim()) return null
    if (k === 'item') return (q.items || [text.replace(/^\s*(köp|handla)\s+/i, '').trim()]).filter(Boolean).map((x) => `🛒 ${x}`).join('  ')
    const parts = [q.title || '…']
    if (k === 'event') parts.push(q.date ? prettyDay(q.date) : 'idag', q.time ? `kl ${q.time}${q.endTime ? `–${q.endTime}` : ''}` : 'heldag')
    if (k === 'chore' && q.date) parts.push(`senast ${prettyDay(q.date)}`)
    if (q.member) parts.push(byId[q.member]?.name)
    if (k === 'event' && q.repeat) parts.push(REPEAT[q.repeat])
    return parts.filter(Boolean).join(' · ')
  }

  const save = async (e) => {
    e?.preventDefault()
    if (!text.trim()) return
    if (k === 'event') {
      const date = q.date || t
      const starts = new Date(`${date}T${q.time || '00:00'}`)
      const ends = q.endTime ? new Date(`${date}T${q.endTime}`) : null
      await events.insert({ title: q.title || text.trim(), starts_at: starts.toISOString(), ends_at: ends?.toISOString() || null, all_day: !q.time,
        member_id: q.member, rrule: simpleRrule(q.repeat), category: guessCategory(q.title, household?.category_rules || []) || null, remind_minutes: q.time ? 30 : 0 })
    } else if (k === 'item') {
      if (!defaultList) return
      const names = q.items || [text.replace(/^\s*(köp|handla)\s+/i, '').trim()]
      const on = new Set(items.rows.filter((i) => !i.done && i.list_id === defaultList.id).map((i) => i.name.toLowerCase()))
      for (const n of names) if (n && !on.has(n.toLowerCase())) await items.insert({ name: n, list_id: defaultList.id, added_by: me.id, section: guessSection(n) })
    } else if (k === 'chore') {
      await chores.insert({ title: q.title || text.trim(), assigned_to: q.member, due_date: q.date || null, stars: 0 })
    } else {
      await notes.insert({ text: text.trim(), color: 'yellow', author: me.id, to_member: q.member && q.member !== me.id ? q.member : null })
    }
    setDone(`${KINDS.find(([x]) => x === k)[1]} tillagd`)
    setText(''); setKind(null)
  }

  return (
    <Sheet title="Lägg till" onClose={onClose}>
      <form onSubmit={save} className="stack">
        <input autoFocus value={text} onChange={(e) => { setText(e.target.value); setDone(null) }} enterKeyHint="done"
          placeholder="T.ex. Tandläkare Juhani tis 15–16 eller mjölk, ägg" aria-label="Vad vill du lägga till?" />
        <div className="seg seg-sm">
          {kinds.map(([id, label]) => <button type="button" key={id} className={k === id ? 'active' : ''} onClick={() => setKind(id)}>{label}</button>)}
        </div>
        {preview() && <p className="quick-preview">Blir: <strong>{preview()}</strong></p>}
        {done && <p className="ok small">✓ {done}. Skriv nästa eller stäng.</p>}
        <button className="primary" disabled={!text.trim()}>Lägg till</button>
        <p className="muted small">Skriv dag (idag, imorgon, tis, 12 nov), tid (kl 15, 15–16), ett namn och gärna ”varje vecka”. Flera varor skiljer du med komma.</p>
      </form>
    </Sheet>
  )
}
