import { guessSection } from './sections.js'

// Bocka av en vara. Ligger samma vara i Komplettera (det som tagit slut hemma) försvinner den därifrån också.
// Är det en skafferivara (mat som sparas hemma) läggs den i skafferiet, kylen eller frysen.
export function checkOff(items, item, lists, pantry = null) {
  items.update(item.id, { done: true })
  if (pantry) toPantry(pantry, item)
  const refill = lists.find((l) => l.is_refill)
  if (!refill || item.list_id === refill.id) return
  const n = item.name.trim().toLowerCase()
  for (const x of items.rows) if (x.list_id === refill.id && !x.done && x.id !== item.id && x.name.trim().toLowerCase() === n) items.remove(x.id)
}

// Var varan hamnar hemma, och ungefär hur länge den håller (dagar). null = inte en skafferivara
// (frukt och grönt, dryck, hygien, hushåll m.m. hoppas över).
const PLACES = { 'Mejeri': ['kyl', 7], 'Kött & fisk': ['kyl', 2], 'Chark': ['kyl', 7], 'Bröd': ['skafferi', 4], 'Frys': ['frys', null], 'Skafferi': ['skafferi', null], 'Godis & snacks': ['skafferi', null] }
export function pantryPlace(item) {
  const name = item.name.toLowerCase()
  if (/fryst|frysta|glass|fiskpinnar|pommes/.test(name)) return { place: 'frys', days: null }
  const section = item.section && PLACES[item.section] ? item.section : guessSection(item.name)
  const p = PLACES[section]
  return p ? { place: p[0], days: p[1] } : null
}

const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function toPantry(pantry, item) {
  const p = pantryPlace(item)
  if (!p) return
  const name = item.name.trim()
  const best_before = p.days ? addDays(p.days) : null
  const same = pantry.rows.find((x) => x.name.trim().toLowerCase() === name.toLowerCase())
  if (same) { if (best_before && (!same.best_before || same.best_before < best_before)) pantry.update(same.id, { best_before }) }
  else pantry.insert({ name: name.charAt(0).toUpperCase() + name.slice(1), place: p.place, best_before })
}
