import { useMemo, useState } from 'react'
import { useTable } from '../useTable'
import { DEFAULT_DISH_ITEMS } from '../lib/defaults'
import { guessSection } from '../lib/sections'
import Sheet from './Sheet'

// Lägg varorna till en eller flera rätter på inköpslistan. Varorna per rätt går att ändra och sparas.
export default function ShopForDishes({ householdId, me, dishes, title, onClose }) {
  const dishItems = useTable('dish_items', householdId)
  const items = useTable('shopping_items', householdId)
  const lists = useTable('shopping_lists', householdId)
  const catalog = useTable('item_catalog', householdId)
  const list = lists.rows.find((l) => l.is_default)
  const onList = new Set(items.rows.filter((i) => i.list_id === list?.id && !i.done).map((i) => i.name.toLowerCase()))
  const saved = Object.fromEntries(dishItems.rows.map((d) => [d.dish.toLowerCase(), d]))
  const itemsFor = (dish) => saved[dish.toLowerCase()]?.items ?? DEFAULT_DISH_ITEMS[dish] ?? findDefault(dish)
  const [unchecked, setUnchecked] = useState(() => new Set())
  const [newItem, setNewItem] = useState({})
  const [added, setAdded] = useState(0)

  const all = useMemo(() => {
    const seen = new Map()
    for (const d of dishes) for (const it of itemsFor(d)) if (!seen.has(it.toLowerCase())) seen.set(it.toLowerCase(), it)
    return [...seen.values()]
  }, [dishes, dishItems.rows])
  const toAdd = all.filter((n) => !onList.has(n.toLowerCase()) && !unchecked.has(n.toLowerCase()))

  const setItems = async (dish, next) => {
    const row = saved[dish.toLowerCase()]
    if (row) await dishItems.update(row.id, { items: next })
    else await dishItems.insert({ dish, items: next })
  }
  const toggle = (n) => setUnchecked((s) => { const x = new Set(s); x.has(n.toLowerCase()) ? x.delete(n.toLowerCase()) : x.add(n.toLowerCase()); return x })
  const addAll = async () => {
    if (!list || !toAdd.length) return
    const catBy = Object.fromEntries(catalog.rows.map((c) => [c.name.toLowerCase(), c.section]))
    await items.insert(toAdd.map((name) => ({ name, list_id: list.id, added_by: me.id, section: catBy[name.toLowerCase()] || guessSection(name) })))
    setAdded(toAdd.length)
    setTimeout(onClose, 900)
  }

  return (
    <Sheet title={title || `Handla till ${dishes[0]}`} onClose={onClose}>
      {dishes.map((dish) => {
        const its = itemsFor(dish)
        return (
          <div key={dish} className="mb">
            {dishes.length > 1 && <h4 className="day">{dish}</h4>}
            <div className="chips">
              {its.map((n) => {
                const already = onList.has(n.toLowerCase())
                const off = unchecked.has(n.toLowerCase())
                return (
                  <span key={n} className={`chip dish-item ${already ? 'already' : off ? 'off' : 'on'}`}>
                    <button type="button" onClick={() => !already && toggle(n)}>{already ? '✓ ' : off ? '' : '+ '}{n}</button>
                    <button type="button" className="x" aria-label={`Ta bort ${n} från ${dish}`} onClick={() => setItems(dish, its.filter((x) => x !== n))}>✕</button>
                  </span>
                )
              })}
            </div>
            <form className="row mt" onSubmit={(e) => { e.preventDefault(); const v = (newItem[dish] || '').trim(); if (v) { setItems(dish, [...its, v]); setNewItem({ ...newItem, [dish]: '' }) } }}>
              <input placeholder={`Lägg till vara för ${dish}`} value={newItem[dish] || ''} onChange={(e) => setNewItem({ ...newItem, [dish]: e.target.value })} />
              <button>Spara</button>
            </form>
          </div>
        )
      })}
      <p className="muted small">✓ = finns redan på listan. Tryck på en vara för att hoppa över den den här gången. ✕ tar bort varan från rätten för gott.</p>
      <button className="primary w100" onClick={addAll} disabled={!toAdd.length}>
        {added ? `La till ${added} varor ✓` : toAdd.length ? `Lägg ${toAdd.length} varor på ${list?.name || 'listan'}` : 'Allt finns redan på listan'}
      </button>
    </Sheet>
  )
}

function findDefault(dish) {
  const k = Object.keys(DEFAULT_DISH_ITEMS).find((n) => n.toLowerCase() === dish.toLowerCase())
  return k ? DEFAULT_DISH_ITEMS[k] : []
}
