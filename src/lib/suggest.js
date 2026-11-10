import { DEFAULT_DISH_ITEMS } from './defaults.js'
import { linesOf } from './qty.js'
// Förslag på veckans middagar: inte ätit på två veckor, gärna det familjen brukar äta,
// gärna det som använder sådant i skafferiet/kylen som snart går ut, och inte samma sorts mat två dagar i rad.
const p = (s) => new Date(s + 'T12:00:00Z')
const add = (s, n) => { const d = p(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const low = (s) => String(s || '').toLowerCase()

// Vilka skafferivaror som snart går ut (inom days dagar)
export function expiringSoon(pantry, today, days = 4) {
  return (pantry || []).filter((x) => x.best_before && x.best_before <= add(today, days))
}

// Använder rätten någon av varorna? (via rättens varor, de föreslagna om rätten inte har egna, annars namnet)
export function usesItems(dish, items, dishItems) {
  const row = (dishItems || []).find((d) => low(d.dish) === low(dish))
  const def = Object.keys(DEFAULT_DISH_ITEMS).find((n) => low(n) === low(dish))
  const ing = linesOf(row, def ? DEFAULT_DISH_ITEMS[def] : []).map((l) => low(l.name).trim()).filter(Boolean)
  return items.filter((x) => {
    const n = low(x.name)
    return ing.some((i) => i.includes(n) || n.includes(i)) || low(dish).includes(n)
  })
}

export function suggestWeek({ all, plan, days, today, pantry = [], dishItems = [], random = Math.random }) {
  const recent = new Set(plan.filter((m) => m.day >= add(today, -14) && m.day <= add(today, 14)).map((m) => low(m.dish)))
  const count = new Map()
  for (const m of plan) if (m.day >= add(today, -365) && m.day < today) count.set(low(m.dish), (count.get(low(m.dish)) || 0) + 1)
  const soon = expiringSoon(pantry, today)
  const used = new Set()
  const out = []
  let prevCat = null
  for (const day of days) {
    const planned = plan.find((m) => m.day === day)
    if (planned) { prevCat = all.find((d) => low(d.name) === low(planned.dish))?.category ?? null; continue }
    if (day < today) continue
    let best = null
    for (const d of all) {
      const n = low(d.name)
      if (recent.has(n) || used.has(n)) continue
      let score = random() * 1.5
      if (d.own) score += 2
      score += Math.min(4, count.get(n) || 0) * 0.5
      const hits = usesItems(d.name, soon, dishItems)
      if (hits.length) score += 5
      if (prevCat && d.category === prevCat) score -= 2
      if (!best || score > best.score) best = { d, score, hits }
    }
    if (!best) break
    used.add(low(best.d.name))
    prevCat = best.d.category
    out.push({ day, dish: best.d.name, uses: best.hits.map((h) => h.name) })
  }
  return out
}
