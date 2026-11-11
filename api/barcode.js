// Vercel-funktion: slår upp en streckkod i Open Food Facts (öppet register över matvaror)
// och skickar tillbaka namn, märke, storlek och om varan hör hemma i kyl, frys eller skafferi.
import { validCode, productFromOff } from '../src/lib/barcode.js'

const FIELDS = 'product_name,product_name_sv,generic_name,generic_name_sv,brands,quantity,categories_tags'

export default async function handler(req, res) {
  const code = String(req.query.code || '').trim()
  if (!validCode(code)) return res.status(400).json({ error: 'Ogiltig streckkod' })
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'Hemappen/1.0 (familjeapp, hemapp.vercel.app)', accept: 'application/json' }
    })
    if (r.status === 404) return res.status(404).json({ error: 'Okänd vara' })
    if (!r.ok) return res.status(502).json({ error: `Registret svarade ${r.status}` })
    const product = productFromOff(await r.json())
    if (!product) return res.status(404).json({ error: 'Okänd vara' })
    res.setHeader('cache-control', 'public, max-age=604800')
    return res.status(200).json(product)
  } catch {
    return res.status(502).json({ error: 'Kunde inte nå registret' })
  }
}
