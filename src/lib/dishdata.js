// Varor och recept per rätt. Sparas i dish_items (en rad per rätt och hushåll, kopplad på namnet).
// Rätter utan egen rad använder de föreslagna varorna i defaults.js.
import { DEFAULT_DISH_ITEMS, DEFAULT_SERVINGS } from './defaults.js'
import { linesOf } from './qty.js'
import { supabase } from '../supabase.js'

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
export async function saveDish(table, dish, patch, householdId) {
  const data = { ...patch }
  if (patch.lines) {
    data.lines = patch.lines.map((l) => ({ name: l.name.trim(), qty: (l.qty || '').trim() })).filter((l) => l.name)
    data.items = data.lines.map((l) => l.name)
  }
  let row = rowFor(table.rows, dish)
  // Listan i telefonen kan vara gammal: kolla i databasen innan en ny rad skapas (en rad per rätt och hushåll)
  if (!row && householdId && supabase) {
    const { data: found } = await supabase.from('dish_items').select('id, dish').eq('household_id', householdId).ilike('dish', String(dish).trim().replace(/[%_\\]/g, '\\$&'))
    row = found?.[0]
  }
  // Byter rätten namn till en rätt som redan har en egen rad: skriv över den och ta bort den gamla
  // (annars krockar det, det får bara finnas en rad per rätt och hushåll)
  const target = data.dish && low(data.dish) !== low(dish) ? rowFor(table.rows, data.dish) : null
  if (target && target.id !== row?.id) {
    await table.update(target.id, { ...data, dish: target.dish })
    if (row) await table.remove(row.id)
    return
  }
  if (row) { await table.update(row.id, data); table.reload?.(); return }
  return table.insert({ dish, items: [], ...data })
}
