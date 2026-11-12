import { useEffect, useMemo, useState } from 'react'
import { useTable } from '../useTable'
import { guessSection, SECTIONS, DEFAULT_STAPLES } from '../lib/sections'
import { parseDay } from '../lib/dates'
import Sheet, { Fab } from './Sheet'
import SwipeRow, { Check } from './Swipe'
import { MemberTag } from './MemberPicker'
import ShopMode from './ShopMode'
import Pantry from './Pantry'
import Scanner from './Scanner'
import { useBarcodes } from '../useBarcodes'
import Icon from './Icon'
import { checkOff } from '../lib/refill'
import { pickSub, shows } from '../lib/menu'
import { splitTyped, addToItem } from '../lib/qty'
import { findActive, sectionFor, bySection } from '../lib/shopping'

export default function Shopping({ householdId, me, members }) {
  const lists = useTable('shopping_lists', householdId)
  const items = useTable('shopping_items', householdId)
  const catalog = useTable('item_catalog', householdId)
  const pantry = useTable('pantry_items', householdId, 'best_before')
  const [listId, setListId] = useState(null)
  const [text, setText] = useState('')
  const [rawView, setView] = useState('list')
  const view = pickSub('shopping', rawView, ['list'], 'list') // list | home | lists
  const [groupBySection, setGroupBySection] = useState(true)
  const [adding, setAdding] = useState(false)
  const [shopping, setShopping] = useState(false)
  const [editItem, setEditItem] = useState(null) // { id, name, qty }
  const byId = Object.fromEntries(members.map((m) => [m.id, m]))

  const activeLists = lists.rows.filter((l) => !l.archived)
    .sort((a, b) => Number(b.is_default) - Number(a.is_default) || Number(b.is_refill) - Number(a.is_refill) || (a.for_date || '9').localeCompare(b.for_date || '9'))
  const defaultList = lists.rows.find((l) => l.is_default)
  const refillList = lists.rows.find((l) => l.is_refill)
  // Komplettera-listan skapas en gång om den saknas
  useEffect(() => { if (!lists.loading && lists.rows.length && !refillList) lists.insert({ name: 'Komplettera', is_refill: true }) }, [lists.loading, lists.rows.length, refillList])
  const tick = (i) => checkOff(items, i, lists.rows, pantry)
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

  // Mängd går att skriva direkt: "2 gurkor" eller "mjölk 1 l". Finns varan redan läggs mängden till.
  const add = (name, targetList = list, qty = '') => {
    const n = name.trim()
    if (!n || !targetList) return
    const existing = findActive(items.rows, targetList.id, n)
    if (existing) { if (qty) items.update(existing.id, { qty: addToItem(existing.qty, qty) }); return }
    const section = sectionFor(n, catalogByName)
    items.insert({ name: n, list_id: targetList.id, added_by: me.id, section, ...(qty ? { qty } : {}) })
  }
  // Flera varor på en gång: "mjölk, ägg och bröd", "2 gurkor, 1 l mjölk"
  const submit = (e) => { e.preventDefault(); text.split(/,(?!\d)|\soch\s/).map((x) => x.trim()).filter(Boolean).map(splitTyped).forEach((x) => add(x.name, list, x.qty)); setText('') }
  const saveItem = (e) => {
    e.preventDefault()
    const n = editItem.name.trim()
    if (n) items.update(editItem.id, { name: n.charAt(0).toUpperCase() + n.slice(1), qty: editItem.qty.trim() || null })
    setEditItem(null)
  }
  const clearDone = () => done.forEach((i) => items.remove(i.id))

  // Prio-markerade varor ligger överst och syns på Idag
  const prioFirst = (rows) => [...rows].sort((a, b) => Number(!!b.prio) - Number(!!a.prio))
  const groups = groupBySection
    ? bySection(todo).map(([s, v]) => [s, prioFirst(v)])
    : [[null, prioFirst(todo)]]

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
        {shows('shopping.home') && <button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>Slut hemma</button>}
        {shows('shopping.pantry') && <button className={view === 'pantry' ? 'active' : ''} onClick={() => setView('pantry')}>Skafferi</button>}
        {shows('shopping.lists') && <button className={view === 'lists' ? 'active' : ''} onClick={() => setView('lists')}>Listor</button>}
      </div>

      {view === 'list' && list && (
        <>
          {todo.length > 0 && <button className="primary wide shop-now" onClick={() => setShopping(true)}><Icon name="cart" size={18} /> Jag handlar nu</button>}
          <div className="mt" />
          {shopping && <ShopMode list={list} items={items} lists={lists.rows} householdId={householdId} me={me} onClose={() => setShopping(false)} />}
          <Fab onClick={() => setAdding(true)} label="Lägg till vara" />
          {adding && (
            <Sheet title={`Lägg till i ${list.name}`} onClose={() => { setAdding(false); setText('') }}>
              <form className="row" onSubmit={submit}>
                <input placeholder="Vara, eller flera: 2 gurkor, mjölk, bröd" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
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
                  <SwipeRow key={i.id} onCheck={() => tick(i)} onDelete={() => items.remove(i.id)} checkLabel="I korgen">
                    <span className="check">
                      <Check checked={false} onChange={() => tick(i)} label={`Bocka av ${i.name}`} />
                      <span className={`item-name ${i.prio ? 'prio-name' : ''}`} onClick={(e) => { e.stopPropagation(); setEditItem({ id: i.id, name: i.name, qty: i.qty || '' }) }}>{i.name}</span>
                    </span>
                    <span className="meta">
                      {i.qty && <span className="qty" onClick={() => setEditItem({ id: i.id, name: i.name, qty: i.qty || '' })}>{i.qty}</span>}
                      <button className={`icon-btn prio-btn ${i.prio ? 'on' : ''}`} onClick={() => items.update(i.id, { prio: !i.prio })}
                        aria-pressed={!!i.prio} aria-label={i.prio ? `Ta bort prio på ${i.name}` : `Prio-markera ${i.name}`}>!</button>
                      <MemberTag member={byId[i.added_by]} size={22} />
                      <button className="icon-btn del" onClick={() => items.remove(i.id)} aria-label="Ta bort">✕</button>
                    </span>
                  </SwipeRow>
                ))}
              </ul>
            </div>
          ))}
          {!items.loading && todo.length === 0 && <p className="muted">Listan är tom.</p>}
          {todo.length > 0 && <p className="muted small">Tryck på en vara för att ändra mängd. Tryck på ! för att prio-markera, prio-varorna syns på Idag.</p>}
          {editItem && (
            <Sheet title="Ändra vara" onClose={() => setEditItem(null)}>
              <form className="stack" onSubmit={saveItem}>
                <input value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} aria-label="Vara" />
                <input value={editItem.qty} placeholder="Mängd, t.ex. 2 st eller 500 g" onChange={(e) => setEditItem({ ...editItem, qty: e.target.value })} aria-label="Mängd" autoFocus />
                <div className="chips">{['1 st', '2 st', '3 st', '4 st', '500 g', '1 kg', '1 l', '1 paket'].map((q) => <button type="button" key={q} className="chip" onClick={() => setEditItem({ ...editItem, qty: q })}>{q}</button>)}</div>
                <button className="primary">Spara</button>
              </form>
            </Sheet>
          )}
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
                  <SwipeRow key={i.id} onDelete={() => items.remove(i.id)}>
                    <span className="check">
                      <Check checked onChange={() => items.update(i.id, { done: false })} label={`Ångra ${i.name}`} />
                      <span>{i.name}{i.qty && <span className="muted small"> · {i.qty}</span>}</span>
                    </span>
                  </SwipeRow>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {view === 'home' && <OutAtHome householdId={householdId} catalog={catalog} items={items} pantry={pantry} add={(n) => add(n, refillList || defaultList)} defaultList={refillList || defaultList} />}
      {view === 'pantry' && <Pantry householdId={householdId} onOut={(n) => add(n, refillList || defaultList)} />}
      {view === 'lists' && <Lists lists={lists} items={items} onOpen={(id) => { setListId(id); setView('list') }} />}
    </section>
  )
}

// "Slut hemma": tryck på det som tar slut så hamnar det på veckohandlingen, tryck igen för att ångra
function OutAtHome({ householdId, catalog, items, pantry, add, defaultList }) {
  const [edit, setEdit] = useState(false)
  const [scan, setScan] = useState(false)
  const [note, setNote] = useState('')
  const { lookup, remember } = useBarcodes(householdId)
  const [sheet, setSheet] = useState(null) // null | { id?, name, section }
  const staples = catalog.rows.filter((c) => c.is_staple).sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  const usingDefaults = staples.length === 0
  const tiles = usingDefaults ? DEFAULT_STAPLES.map((n) => ({ id: n, name: n })) : staples

  const onDefault = items.rows.filter((i) => i.list_id === defaultList?.id && !i.done)
  const itemFor = (n) => onDefault.find((i) => i.name.toLowerCase() === n.toLowerCase())

  const toggle = (t) => {
    const existing = itemFor(t.name)
    if (existing) items.remove(existing.id)
    else add(t.name)
  }

  // Skanna den tomma förpackningen: varan läggs på listan och tas bort ur skafferiet
  const scanned = async (code) => {
    setScan(false)
    setNote('Letar upp varan…')
    const p = await lookup(code)
    let name = p.name
    if (!name) {
      setNote('')
      name = (prompt('Okänd streckkod. Vad är det för vara? Appen kommer ihåg det till nästa gång.') || '').trim()
      if (!name) return
    }
    if (p.from !== 'known') remember(code, { name, place: p.place, qty: p.qty })
    const n = name.toLowerCase()
    const here = pantry?.rows.filter((x) => x.name.trim().toLowerCase() === n)
      .sort((a, b) => (a.best_before || '9999').localeCompare(b.best_before || '9999'))[0]
    if (here) pantry.remove(here.id)
    const shown = here?.name || name
    const already = itemFor(shown)
    if (!already) add(shown)
    setNote(`${shown} ${already ? 'låg redan' : 'är lagd'} på ${defaultList?.name || 'inköpslistan'}${here ? ' och borttagen ur skafferiet' : ''}.`)
  }

  const adoptDefaults = async () => {
    const missing = DEFAULT_STAPLES.filter((n) => !catalog.rows.some((c) => c.name.toLowerCase() === n.toLowerCase()))
    if (missing.length) await catalog.insert(missing.map((n) => ({ name: n, section: guessSection(n), is_staple: true })))
    for (const c of catalog.rows) if (DEFAULT_STAPLES.some((n) => n.toLowerCase() === c.name.toLowerCase())) catalog.update(c.id, { is_staple: true })
  }
  const startEdit = async () => { if (usingDefaults) await adoptDefaults(); setEdit(true) }

  const save = async (e) => {
    e.preventDefault()
    const n = sheet.name.trim()
    if (!n) return
    const section = sheet.section || guessSection(n)
    const same = catalog.rows.find((c) => c.name.toLowerCase() === n.toLowerCase() && c.id !== sheet.id)
    if (sheet.id) {
      const old = catalog.rows.find((c) => c.id === sheet.id)
      if (same) { await catalog.update(same.id, { is_staple: true, section }); await catalog.update(sheet.id, { is_staple: false }) }
      else await catalog.update(sheet.id, { name: n, section })
      // byt namn även på varan om den redan ligger på listan
      const onListItem = old && itemFor(old.name)
      if (onListItem) items.update(onListItem.id, { name: n, section })
    } else if (same) await catalog.update(same.id, { is_staple: true, section })
    else await catalog.insert({ name: n, section, is_staple: true })
    setSheet(null)
  }
  const removeStaple = async () => {
    if (!confirm(`Ta bort ${sheet.name} från Slut hemma?`)) return
    await catalog.update(sheet.id, { is_staple: false })
    setSheet(null)
  }

  return (
    <div className="mt">
      <p className="muted small">
        {edit ? 'Tryck på en vara för att ändra eller ta bort den.' : `Tryck på det som håller på att ta slut så läggs det på ${defaultList?.name || 'inköpslistan'}. Tryck igen för att ångra.`}
      </p>
      {!edit && (
        <div className="scan-btns mt">
          <button onClick={() => { setNote(''); setScan(true) }}>📷 Skanna det som är slut</button>
        </div>
      )}
      {note && <p className="muted small mt">{note}</p>}
      {scan && <Scanner title="Vad är slut?" hint="Skanna den tomma förpackningen." onCode={scanned} onClose={() => setScan(false)} />}
      <div className="tiles mt">
        {tiles.map((t) => {
          const added = !!itemFor(t.name)
          return (
            <button key={t.id} className={`tile ${added && !edit ? 'on' : ''} ${edit ? 'editing' : ''}`}
              onClick={() => (edit ? setSheet({ id: t.id, name: t.name, section: t.section || guessSection(t.name) }) : toggle(t))}>
              {edit ? `✎ ${t.name}` : added ? `✓ ${t.name}` : t.name}
            </button>
          )
        })}
      </div>
      {usingDefaults && <p className="muted small">Det här är förslag. <button className="link" onClick={adoptDefaults}>Använd dem som våra</button> eller lägg till egna med plusset.</p>}
      <Fab onClick={() => setSheet({ name: '', section: '' })} label="Ny vara" />
      {sheet && (
        <Sheet title={sheet.id ? 'Ändra vara' : 'Ny vara som brukar ta slut'} onClose={() => setSheet(null)}>
          <form className="stack" onSubmit={save}>
            <input placeholder="T.ex. Havregryn" value={sheet.name} onChange={(e) => setSheet({ ...sheet, name: e.target.value })} autoFocus={!sheet.id} />
            <label className="field"><span className="muted small">Avdelning i butiken</span>
              <select value={sheet.section || guessSection(sheet.name)} onChange={(e) => setSheet({ ...sheet, section: e.target.value })}>
                {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <button className="primary">Spara</button>
            {sheet.id && <button type="button" className="danger" onClick={removeStaple}>Ta bort varan</button>}
          </form>
        </Sheet>
      )}
      <button className="link" onClick={() => (edit ? setEdit(false) : startEdit())}>{edit ? 'Klar' : 'Redigera varor'}</button>
    </div>
  )
}

function Lists({ lists, items, onOpen }) {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [adding, setAdding] = useState(false)
  const visible = lists.rows.filter((l) => showArchived || !l.archived)
    .sort((a, b) => Number(b.is_default) - Number(a.is_default) || Number(b.is_refill) - Number(a.is_refill) || (a.for_date || '9').localeCompare(b.for_date || '9'))
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
              <strong>{l.name}</strong>{l.is_default && <span className="muted small"> · standard</span>}{l.is_refill && <span className="muted small"> · från Slut hemma</span>}
              <div className="muted small">{count(l.id)} varor{l.for_date ? ` · ${short(l.for_date)}` : ''}</div>
            </span>
            {!l.is_default && !l.is_refill && (
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
