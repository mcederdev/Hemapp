// Varor och recept per rätt. Sparas i dish_items (en rad per rätt och hushåll, kopplad på namnet).
// Rätter utan egen rad använder de föreslagna varorna i defaults.js.
import { DEFAULT_DISH_ITEMS, DEFAULT_SERVINGS } from './defaults.js'
import { linesOf } from './qty.js'

const low = (s) => String(s || '').trim().toLowerCase()
export const rowFor = (rows, dish) => (rows || []).find((r) => low(r.dish) === low(dish))
export function defaultsFor(dish) {
  const k = Object.keys(DEFAULT_DISH_ITEMS).find((n) => low(n) === low(dish))
  return k ? DEFAULT_DISH_ITEMS[k] : []
}
export const linesFor = (rows, dish) => linesOf(rowFor(rows, dish), defaultsFor(dish))
export const servingsFor = (rows, dish) => rowFor(rows, dish)?.servings || DEFAULT_SERVINGS
export const hasRecipe = (row) => !!(row?.instructions?.trim() || row?.recipe_url)

// Spara varor/recept för en rätt. items (bara namnen) skrivs också, så att äldre versioner av appen fungerar.
export async function saveDish(table, dish, patch) {
  const data = { ...patch }
  if (patch.lines) {
    data.lines = patch.lines.map((l) => ({ name: l.name.trim(), qty: (l.qty || '').trim() })).filter((l) => l.name)
    data.items = data.lines.map((l) => l.name)
  }
  const row = rowFor(table.rows, dish)
  if (row) return table.update(row.id, data)
  return table.insert({ dish, items: [], ...data })
}
