import { useMemo, useState } from 'react'
import { useTable } from '../useTable'
import { linesFor, servingsFor, saveDish } from '../lib/dishdata'
import { combineLines, scaleQty, addToItem, isBasic, itemKey } from '../lib/qty'
import { guessSection } from '../lib/sections'
import { IngredientsEditor, Stepper } from './Recipe'
import Sheet from './Sheet'

// Lägg varorna till en eller flera rätter på inköpslistan, med mängder.
// Samma vara i flera rätter räknas ihop (två rätter med 1 gurka = 2 gurkor), och ligger varan redan
// på listan läggs mängden till där. Står en rätt två gånger i veckan blir det dubbla portioner.
export default function ShopForDishes({ householdId, me, dishes, portions: startPortions, title, onClose }) {
  const dishItems = useTable('dish_items', householdId)
  const items = useTable('shopping_items', householdId)
  const lists = useTable('shopping_lists', householdId)
  const catalog = useTable('item_catalog', householdId)
  const list = lists.rows.find((l) => l.is_default)
  const onList = Object.fromEntries(items.rows.filter((i) => i.list_id === list?.id && !i.done).map((i) => [itemKey(i.name), i]))

  // Rätter och hur många gånger de står med
  const counts = useMemo(() => {
    const m = new Map()
    for (const d of dishes) m.set(d, (m.get(d) || 0) + 1)
    return [...m]
  }, [dishes])
  const [portions, setPortions] = useState({})
  const portionsFor = (dish, times) => portions[dish] ?? (startPortions && counts.length === 1 ? startPortions : servingsFor(dishItems.rows, dish) * times)
  const [editing, setEditing] = useState(null)
  const [picked, setPicked] = useState({}) // namn -> true/false som man själv ändrat
  const [added, setAdded] = useState(0)

  const groups = counts.map(([dish, times]) => {
    const f = portionsFor(dish, times) / servingsFor(dishItems.rows, dish)
    return { dish, times, lines: linesFor(dishItems.rows, dish).map((l) => ({ ...l, qty: scaleQty(l.qty, f) })) }
  })
  const all = combineLines(groups)
  // Det som brukar finnas hemma och det som redan står på listan kryssas inte i från början
  const isOn = (x) => picked[x.name.toLowerCase()] ?? !(isBasic(x.name) || onList[itemKey(x.name)])
  const toAdd = all.filter(isOn)

  const addAll = async () => {
    if (!list || !toAdd.length) return
    const catBy = Object.fromEntries(catalog.rows.map((c) => [c.name.toLowerCase(), c.section]))
    const fresh = []
    for (const x of toAdd) {
      const existing = onList[itemKey(x.name)]
      if (existing) { if (x.qty) await items.update(existing.id, { qty: addToItem(existing.qty, x.qty) }) }
      else fresh.push({ name: x.name, qty: x.qty || null, list_id: list.id, added_by: me.id, section: catBy[x.name.toLowerCase()] || guessSection(x.name) })
    }
    if (fresh.length) await items.insert(fresh)
    setAdded(toAdd.length)
    setTimeout(onClose, 900)
  }

  return (
    <Sheet title={title || `Handla till ${dishes[0]}`} onClose={onClose}>
      {groups.map(({ dish, times }) => (
        <div key={dish} className="row between shop-dish">
          <span><strong>{dish}</strong>{times > 1 && <span className="muted small"> · {times} gånger</span>}
            <button type="button" className="link small" onClick={() => setEditing(editing === dish ? null : dish)}>{editing === dish ? 'Klar' : 'Ändra varor'}</button>
          </span>
          <span className="row small">Port. <Stepper value={portionsFor(dish, times)} onChange={(v) => setPortions({ ...portions, [dish]: v })} label={`Portioner ${dish}`} /></span>
        </div>
      ))}
      {editing && (
        <div className="card">
          <p className="muted small">Varor till {editing} för {servingsFor(dishItems.rows, editing)} portioner. Sparas på rätten.</p>
          <IngredientsEditor lines={linesFor(dishItems.rows, editing)} onChange={(next) => saveDish(dishItems, editing, { lines: next })} />
        </div>
      )}

      <ul className="list shop-lines">
        {all.map((x) => {
          const key = x.name.toLowerCase()
          const on = isOn(x)
          const already = onList[itemKey(x.name)]
          return (
            <li key={key} className="tap" onClick={() => setPicked({ ...picked, [key]: !on })}>
              <span className="check">
                <input type="checkbox" checked={on} readOnly aria-label={x.name} />
                <span>
                  {x.name}
                  {(already || (groups.length > 1 && x.dishes.length > 1) || isBasic(x.name)) && (
                    <span className="muted small"> · {already ? `på listan${already.qty ? ` (${already.qty})` : ''}` : isBasic(x.name) ? 'finns oftast hemma' : x.dishes.join(', ')}</span>
                  )}
                </span>
              </span>
              {x.qty && <span className="qty">{already && on ? addToItem(already.qty, x.qty) : x.qty}</span>}
            </li>
          )
        })}
      </ul>
      {all.length === 0 && <p className="muted">Inga varor kopplade än. Tryck på Ändra varor.</p>}
      <p className="muted small">Tryck på en vara för att ta med eller hoppa över den. Ligger varan redan på listan läggs mängden till där.</p>
      <button className="primary w100" onClick={addAll} disabled={!toAdd.length || !!added}>
        {added ? `La till ${added} varor ✓` : toAdd.length ? `Lägg ${toAdd.length} varor på ${list?.name || 'listan'}` : 'Inget att lägga till'}
      </button>
    </Sheet>
  )
}
