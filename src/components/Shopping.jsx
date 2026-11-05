import { useEffect, useMemo, useState } from 'react'
import { useTable } from '../useTable'
import { guessSection, SECTIONS, DEFAULT_STAPLES } from '../lib/sections'
import { parseDay } from '../lib/dates'
import Sheet, { Fab } from './Sheet'

export default function Shopping({ householdId, me, members }) {
  const lists = useTable('shopping_lists', householdId)
  const items = useTable('shopping_items', householdId)
  const catalog = useTable('item_catalog', householdId)
  const [listId, setListId] = useState(null)
  const [text, setText] = useState('')
  const [view, setView] = useState('list') // list | home | lists
  const [groupBySection, setGroupBySection] = useState(true)
  const [adding, setAdding] = useState(false)
  const byId = Object.fromEntries(members.map((m) => [m.id, m]))

  const activeLists = lists.rows.filter((l) => !l.archived)
    .sort((a, b) => Number(b.is_default) - Number(a.is_default) || (a.for_date || '9').localeCompare(b.for_date || '9'))
  const defaultList = lists.rows.find((l) => l.is_default)
  const list = lists.rows.find((l) => l.id === listId) || defaultList
  useEffect(() => { if (!listId && defaultList) setListId(defaultList.id) }, [defaultList, listId])

  const inList = items.rows.filter((i) => i.list_id === list?.id)
  const todo = inList.filter((i) => !i.done)
  const done = inList.filter((i) => i.done)
  const onList = new Set(todo.map((i) => i.name.toLowerCase()))

  const catalogByName = useMemo(() => Object.fromEntries(catalog.rows.map((c) => [c.name.toLowerCase(), c])), [catalog.rows])
  const suggestions = catalog.rows
    .filter((c) => !onList.has(c.name.toLowerCase()))
    .sort((a, b) => b.times_added - a.times_added)
    .slice(0, 12)
  const typed = text.trim().toLowerCase()
  const matches = typed ? catalog.rows.filter((c) => c.name.toLowerCase().includes(typed) && !onList.has(c.name.toLowerCase())).slice(0, 6) : []

  const add = (name, targetList = list) => {
    const n = name.trim()
    if (!n || !targetList) return
    const existing = items.rows.find((i) => i.list_id === targetList.id && !i.done && i.name.toLowerCase() === n.toLowerCase())
    if (existing) return
    const section = catalogByName[n.toLowerCase()]?.section || guessSection(n)
    items.insert({ name: n, list_id: targetList.id, added_by: me.id, section })
  }
  const submit = (e) => { e.preventDefault(); add(text); setText('') }
  const clearDone = () => done.forEach((i) => items.remove(i.id))

  const groups = groupBySection
    ? SECTIONS.map((s) => [s, todo.filter((i) => (i.section || 'Övrigt') === s)]).filter(([, v]) => v.length)
    : [[null, todo]]

  return (
    <section>
      <div className="row between">
        <h2>Handla</h2>
        <select value={list?.id || ''} onChange={(e) => { setListId(e.target.value); setView('list') }} style={{ maxWidth: 190 }}>
          {activeLists.map((l) => <option key={l.id} value={l.id}>{l.name}{l.for_date ? ` (${short(l.for_date)})` : ''}</option>)}
        </select>
      </div>

      <div className="seg">
        <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>Lista</button>
        <button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>Slut hemma</button>
        <button className={view === 'lists' ? 'active' : ''} onClick={() => setView('lists')}>Listor</button>
      </div>

      {view === 'list' && list && (
        <>
          <div className="mt" />
          <Fab onClick={() => setAdding(true)} label="Lägg till vara" />
          {adding && (
            <Sheet title={`Lägg till i ${list.name}`} onClose={() => { setAdding(false); setText('') }}>
              <form className="row" onSubmit={submit}>
                <input placeholder="Vara…" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
                <button className="primary">Lägg till</button>
              </form>
              {matches.length > 0 && (
                <div className="chips mt">{matches.map((m) => <button key={m.id} className="chip" onClick={() => { add(m.name); setText('') }}>+ {m.name}</button>)}</div>
              )}
              {!typed && suggestions.length > 0 && (
                <>
                  <p className="muted small mt">Brukar ni köpa</p>
                  <div className="chips">{suggestions.map((c) => <button key={c.id} className="chip" onClick={() => add(c.name)}>+ {c.name}</button>)}</div>
                </>
              )}
              {todo.length > 0 && <p className="muted small mt">På listan: {todo.map((i) => i.name).join(', ')}</p>}
            </Sheet>
          )}
          {groups.map(([section, rows]) => (
            <div key={section || 'all'}>
              {section && <h4 className="day">{section}</h4>}
              <ul className="list">
                {rows.map((i) => (
                  <li key={i.id}>
                    <label className="check">
                      <input type="checkbox" checked={false} onChange={() => items.update(i.id, { done: true })} />
                      <span>{i.name}</span>
                    </label>
                    <span className="meta">
                      {byId[i.added_by] && <span className="dot" style={{ background: byId[i.added_by].color }} title={`Tillagd av ${byId[i.added_by].name}`}>{byId[i.added_by].name[0]}</span>}
                      <button className="icon-btn" onClick={() => items.remove(i.id)} aria-label="Ta bort">✕</button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!items.loading && todo.length === 0 && <p className="muted">Listan är tom.</p>}
          <div className="row between">
            <button className="link" onClick={() => setGroupBySection(!groupBySection)}>{groupBySection ? 'Visa utan avdelningar' : 'Sortera efter avdelning'}</button>
          </div>

          {suggestions.length > 0 && (
            <>
              <h3>Brukar ni köpa</h3>
              <div className="chips">{suggestions.map((c) => <button key={c.id} className="chip" onClick={() => add(c.name)}>+ {c.name}</button>)}</div>
            </>
          )}

          {done.length > 0 && (
            <>
              <div className="row between"><h3>I korgen</h3><button className="link" onClick={clearDone}>Rensa</button></div>
              <ul className="list done">
                {done.map((i) => (
                  <li key={i.id}>
                    <label className="check">
                      <input type="checkbox" checked onChange={() => items.update(i.id, { done: false })} />
                      <span>{i.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {view === 'home' && <OutAtHome catalog={catalog} onList={onList} add={(n) => add(n, defaultList)} defaultList={defaultList} />}
      {view === 'lists' && <Lists lists={lists} items={items} onOpen={(id) => { setListId(id); setView('list') }} />}
    </section>
  )
}

// "Slut hemma": tryck på det som tar slut så hamnar det på veckohandlingen
function OutAtHome({ catalog, onList, add, defaultList }) {
  const [name, setName] = useState('')
  const [edit, setEdit] = useState(false)
  const [adding, setAdding] = useState(false)
  const staples = catalog.rows.filter((c) => c.is_staple).sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  const usingDefaults = staples.length === 0

  const tiles = usingDefaults ? DEFAULT_STAPLES.map((n) => ({ id: n, name: n })) : staples

  const addStaple = async (e) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    const existing = catalog.rows.find((c) => c.name.toLowerCase() === n.toLowerCase())
    if (existing) await catalog.update(existing.id, { is_staple: true })
    else await catalog.insert({ name: n, section: guessSection(n), is_staple: true })
    setName('')
    setAdding(false)
  }
  const adoptDefaults = async () => {
    const missing = DEFAULT_STAPLES.filter((n) => !catalog.rows.some((c) => c.name.toLowerCase() === n.toLowerCase()))
    if (missing.length) await catalog.insert(missing.map((n) => ({ name: n, section: guessSection(n), is_staple: true })))
    for (const c of catalog.rows) if (DEFAULT_STAPLES.some((n) => n.toLowerCase() === c.name.toLowerCase())) catalog.update(c.id, { is_staple: true })
  }

  return (
    <div className="mt">
      <p className="muted small">Tryck på det som håller på att ta slut så läggs det direkt på {defaultList?.name || 'inköpslistan'}.</p>
      <div className="tiles">
        {tiles.map((t) => {
          const added = onList.has(t.name.toLowerCase())
          return (
            <button key={t.id} className={`tile ${added ? 'on' : ''}`}
              onClick={() => (edit && !usingDefaults ? catalog.update(t.id, { is_staple: false }) : add(t.name))}>
              {edit && !usingDefaults ? `✕ ${t.name}` : added ? `✓ ${t.name}` : t.name}
            </button>
          )
        })}
      </div>
      {usingDefaults && <p className="muted small">Det här är förslag. <button className="link" onClick={adoptDefaults}>Använd dem som våra</button> eller lägg till egna nedan.</p>}
      <Fab onClick={() => setAdding(true)} label="Ny basvara" />
      {adding && (
        <Sheet title="Ny vara som brukar ta slut" onClose={() => setAdding(false)}>
          <form className="row" onSubmit={addStaple}>
            <input placeholder="T.ex. Havregryn" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <button className="primary">Spara</button>
          </form>
        </Sheet>
      )}
      {!usingDefaults && <button className="link" onClick={() => setEdit(!edit)}>{edit ? 'Klar' : 'Ta bort varor'}</button>}
    </div>
  )
}

function Lists({ lists, items, onOpen }) {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [adding, setAdding] = useState(false)
  const visible = lists.rows.filter((l) => showArchived || !l.archived)
    .sort((a, b) => Number(b.is_default) - Number(a.is_default) || (a.for_date || '9').localeCompare(b.for_date || '9'))
  const count = (id) => items.rows.filter((i) => i.list_id === id && !i.done).length

  const create = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    const rows = await lists.insert({ name: name.trim(), for_date: date || null })
    setName(''); setDate(''); setAdding(false)
    if (rows?.[0]) onOpen(rows[0].id)
  }

  return (
    <div className="mt">
      <Fab onClick={() => setAdding(true)} label="Ny lista" />
      {adding && (
        <Sheet title="Ny inköpslista" onClose={() => setAdding(false)}>
          <form className="stack" onSubmit={create}>
            <input placeholder="T.ex. Kalas lördag, Jul, Stugan" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <label className="field"><span className="muted small">Datum (valfritt)</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <button className="primary">Skapa lista</button>
          </form>
        </Sheet>
      )}
      <ul className="list">
        {visible.map((l) => (
          <li key={l.id} className={l.archived ? 'is-done' : ''}>
            <span className="tap grow" onClick={() => onOpen(l.id)}>
              <strong>{l.name}</strong>{l.is_default && <span className="muted small"> · standard</span>}
              <div className="muted small">{count(l.id)} varor{l.for_date ? ` · ${short(l.for_date)}` : ''}</div>
            </span>
            {!l.is_default && (
              <span className="meta">
                <button className="link" onClick={() => lists.update(l.id, { archived: !l.archived })}>{l.archived ? 'Återställ' : 'Arkivera'}</button>
                <button className="icon-btn" onClick={() => confirm(`Ta bort ${l.name} och dess varor?`) && lists.remove(l.id)} aria-label="Ta bort">✕</button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <button className="link" onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Dölj arkiverade' : 'Visa arkiverade'}</button>
    </div>
  )
}

function short(d) { return parseDay(d).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) }
