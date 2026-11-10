import { useState } from 'react'
import { useTable } from '../useTable'
import { linesFor, servingsFor, rowFor, saveDish, hasRecipe } from '../lib/dishdata'
import { parseIngredient, scaleQty, splitTyped } from '../lib/qty'
import { DEFAULT_SERVINGS } from '../lib/defaults'
import Sheet from './Sheet'
import Icon from './Icon'

// Lista med varor och mängd som går att ändra: namn, mängd, ✕. Nya varor skrivs som "2 st gurka" eller "gurka 2".
export function IngredientsEditor({ lines, onChange }) {
  const [text, setText] = useState('')
  const set = (i, patch) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const add = (e) => {
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    const next = v.split(/\n|,(?!\d)/).map((x) => x.trim()).filter(Boolean).map(splitTyped)
    onChange([...lines, ...next])
    setText('')
  }
  return (
    <div className="ing-edit">
      {lines.length > 0 && (
        <ul className="list ing-list">
          {lines.map((l, i) => (
            <li key={i}>
              <input className="ing-name" value={l.name} onChange={(e) => set(i, { name: e.target.value })} aria-label="Vara" />
              <input className="ing-qty" value={l.qty} placeholder="Mängd" onChange={(e) => set(i, { qty: e.target.value })} aria-label={`Mängd ${l.name}`} />
              <button type="button" className="icon-btn del" onClick={() => onChange(lines.filter((_, j) => j !== i))} aria-label={`Ta bort ${l.name}`}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <div className="row">
        <input placeholder="Lägg till vara, t.ex. 2 st gurka" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(e) }} enterKeyHint="done" />
        <button type="button" onClick={add}>Lägg till</button>
      </div>
    </div>
  )
}

export function Stepper({ value, onChange, min = 1, label }) {
  return (
    <span className="stepper" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Färre">−</button>
      <span>{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} aria-label="Fler">+</button>
    </span>
  )
}

// Hämta varor och "gör så här" från en receptlänk (via /api/recipe)
async function importRecipe(url) {
  const r = await fetch(`/api/recipe?url=${encodeURIComponent(url)}`)
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || 'Kunde inte läsa receptet')
  return data
}

// Ny rätt eller ändra en rätt: namn, kategori, receptlänk, portioner, varor med mängd och hur man lagar den.
// En föreslagen rätt som byter namn eller kategori sparas som en egen, och originalet döljs.
export function DishEditor({ householdId, dish, categories, onClose, onHide, onRemove }) {
  const dishes = useTable('dishes', householdId)
  const dishItems = useTable('dish_items', householdId, 'dish')
  const isNew = !dish
  const row = dish ? rowFor(dishItems.rows, dish.name) : null
  const [name, setName] = useState(dish?.name || '')
  const [category, setCategory] = useState(dish?.category || '')
  const [url, setUrl] = useState(row?.recipe_url || '')
  const [servings, setServings] = useState(dish ? servingsFor(dishItems.rows, dish.name) : DEFAULT_SERVINGS)
  const [lines, setLines] = useState(() => (dish ? linesFor(dishItems.rows, dish.name) : []))
  const [instructions, setInstructions] = useState(row?.instructions || '')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  // Raden i dish_items kan komma in efter att rutan öppnats (laddas från servern)
  const [synced, setSynced] = useState(!!row || isNew)
  if (!synced && !dishItems.loading) {
    setSynced(true)
    const r = dish && rowFor(dishItems.rows, dish.name)
    if (r) { setUrl(r.recipe_url || ''); setServings(r.servings || DEFAULT_SERVINGS); setLines(linesFor(dishItems.rows, dish.name)); setInstructions(r.instructions || '') }
  }

  const fetchRecipe = async () => {
    const u = url.trim()
    if (!u) return
    setLoading(true); setMsg('')
    try {
      const r = await importRecipe(/^https?:\/\//.test(u) ? u : `https://${u}`)
      const got = r.ingredients.map(parseIngredient).filter((l) => l.name)
      if (lines.length && !confirm(`Byta ut varorna mot de ${got.length} från receptet?`)) setLines([...lines, ...got.filter((g) => !lines.some((l) => l.name.toLowerCase() === g.name.toLowerCase()))])
      else setLines(got)
      if (r.servings) setServings(r.servings)
      if (r.instructions?.length) setInstructions(r.instructions.join('\n'))
      if (!name.trim() && r.name) setName(r.name)
      setMsg(`Hämtade ${got.length} varor${r.instructions?.length ? ` och ${r.instructions.length} steg` : ''}. Kolla gärna mängderna.`)
    } catch (e) {
      setMsg(`${e.message}. Du kan skriva in varorna själv.`)
    }
    setLoading(false)
  }

  const save = async (e) => {
    e.preventDefault()
    const n = name.trim(), c = category.trim() || null
    if (!n || saving) return
    setSaving(true)
    const recipe = { lines, servings, recipe_url: url.trim() || null, instructions: instructions.trim() || null }
    const renamed = dish && n.toLowerCase() !== dish.name.toLowerCase()
    if (isNew) await dishes.insert({ name: n, category: c })
    else if (dish.own && (renamed || c !== (dish.category || null))) await dishes.update(dish.id, { name: n, category: c })
    else if (!dish.own && (renamed || c !== (dish.category || null))) { await dishes.insert({ name: n, category: c }); if (renamed) onHide?.(dish.name) }
    // Varorna följer med när rätten byter namn
    await saveDish(dishItems, dish?.name || n, { ...recipe, dish: n }, householdId)
    setSaving(false)
    onClose(n)
  }

  return (
    <Sheet title={isNew ? 'Ny rätt' : 'Ändra rätt'} onClose={() => onClose()} tall>
      <form className="stack" onSubmit={save}>
        <input placeholder="T.ex. Mormors köttbullar" value={name} onChange={(e) => setName(e.target.value)} autoFocus={isNew} aria-label="Namn" />
        <input list="cats" placeholder="Kategori (valfritt)" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Kategori" />
        <datalist id="cats">{(categories || []).map((x) => <option key={x} value={x} />)}</datalist>

        <label className="muted small">Receptlänk (valfritt)</label>
        <div className="row">
          <input type="url" inputMode="url" placeholder="https://www.ica.se/recept/..." value={url} onChange={(e) => setUrl(e.target.value)} />
          <button type="button" onClick={fetchRecipe} disabled={!url.trim() || loading}>{loading ? 'Hämtar…' : 'Hämta'}</button>
        </div>
        {msg && <p className="muted small">{msg}</p>}

        <div className="row between"><strong>Varor</strong><span className="row small">Portioner <Stepper value={servings} onChange={setServings} label="Portioner" /></span></div>
        <IngredientsEditor lines={lines} onChange={setLines} />
        <p className="muted small">Mängden gäller för {servings} portioner. Lämna tom om det inte spelar någon roll.</p>

        <label className="muted small" htmlFor="howto">Gör så här (valfritt, ett steg per rad)</label>
        <textarea id="howto" rows={5} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Sätt ugnen på 225°..." />

        <button className="primary" disabled={saving}>{saving ? 'Sparar…' : 'Spara'}</button>
        {!isNew && <button type="button" className="danger" onClick={() => (dish.own ? onRemove?.(dish) : onHide?.(dish.name, true))}>{dish.own ? 'Ta bort rätten' : 'Dölj från listan'}</button>}
        {!isNew && !dish.own && <p className="muted small">Byter du namn eller kategori på en föreslagen rätt sparas den som er egen. Varorna kan du ändra utan det.</p>}
      </form>
    </Sheet>
  )
}

// Visa en rätt: varor (räknas om för antal portioner) och hur man lagar den
export function DishView({ householdId, dish, onClose, onEdit, onShop }) {
  const dishItems = useTable('dish_items', householdId, 'dish')
  const row = rowFor(dishItems.rows, dish)
  const base = servingsFor(dishItems.rows, dish)
  const [portions, setPortions] = useState(null)
  const p = portions || base
  const lines = linesFor(dishItems.rows, dish)
  const steps = (row?.instructions || '').split('\n').map((s) => s.trim()).filter(Boolean)
  return (
    <Sheet title={dish} onClose={onClose}>
      <div className="row between"><strong>Varor</strong><span className="row small">Portioner <Stepper value={p} onChange={setPortions} label="Portioner" /></span></div>
      {lines.length ? (
        <ul className="list recipe-lines">
          {lines.map((l, i) => <li key={i}><span>{l.name}</span><span className="muted">{scaleQty(l.qty, p / base)}</span></li>)}
        </ul>
      ) : <p className="muted">Inga varor än. Tryck på Ändra för att lägga till.</p>}
      {steps.length > 0 && (
        <>
          <strong>Gör så här</strong>
          <ol className="recipe-steps">{steps.map((s, i) => <li key={i}>{s.replace(/^\d+[.)]\s*/, '')}</li>)}</ol>
        </>
      )}
      {row?.recipe_url && <p><a href={row.recipe_url} target="_blank" rel="noreferrer">Öppna originalreceptet ↗</a></p>}
      <div className="row mt">
        {onShop && <button className="primary" style={{ flex: 1 }} onClick={() => onShop(dish, p)}><Icon name="cart" size={18} /> Handla varorna</button>}
        {onEdit && <button style={{ flex: 1 }} onClick={() => onEdit(dish)}>Ändra</button>}
      </div>
    </Sheet>
  )
}

export { hasRecipe }
