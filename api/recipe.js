// Vercel-funktion: hämtar en receptsida och skickar tillbaka receptet (namn, portioner, ingredienser, steg).
// Behövs för att appen inte kan läsa andra sajter direkt från webbläsaren.
import { extractRecipe } from '../src/lib/recipe.js'

export default async function handler(req, res) {
  const url = String(req.query.url || '')
  let u
  try { u = new URL(url) } catch { return res.status(400).json({ error: 'Ogiltig länk' }) }
  if (!/^https?:$/.test(u.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(u.hostname)) return res.status(400).json({ error: 'Ogiltig länk' })
  try {
    const r = await fetch(u, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
      headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'accept-language': 'sv-SE,sv;q=0.9' }
    })
    if (!r.ok) return res.status(502).json({ error: `Sidan svarade ${r.status}` })
    const html = (await r.text()).slice(0, 3_000_000)
    const recipe = extractRecipe(html)
    if (!recipe || !recipe.ingredients.length) return res.status(422).json({ error: 'Hittade inget recept på sidan' })
    res.setHeader('cache-control', 'public, max-age=86400')
    return res.status(200).json(recipe)
  } catch {
    return res.status(502).json({ error: 'Kunde inte hämta sidan' })
  }
}
