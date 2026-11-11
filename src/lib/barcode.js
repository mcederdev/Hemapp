// Streckkoder på varor (EAN-13, EAN-8, UPC): kontroll av siffrorna och tolkning av svaret från Open Food Facts.

// Sista siffran är en kontrollsiffra. Stämmer den inte är koden felläst.
export function validCode(code) {
  const s = String(code || '').trim()
  if (!/^\d+$/.test(s) || ![8, 12, 13, 14].includes(s.length)) return false
  const d = s.split('').map(Number)
  const check = d.pop()
  const sum = d.reverse().reduce((a, n, i) => a + n * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

// Kyl, frys, skafferi eller kryddor utifrån Open Food Facts kategorier. null = vet inte.
export function placeFromCategories(tags = []) {
  const t = (tags || []).join(' ')
  if (/frozen|surgel|fryst|frysta/.test(t)) return 'frys'
  if (/dairies|milks|cheeses|yogurts|creams|butters|eggs|meats|fishes|seafood|sausages|hams|refrigerated|chilled|fresh-/.test(t)) return 'kyl'
  if (/spices|seasonings|herbs|spice-mixes|peppers-ground|salts/.test(t)) return 'kryddor'
  if (/groceries|cereals|pastas|rices|canned|sauces|spreads|snacks|biscuits|breakfast|condiments|spices|flours|sugars|beverages|coffees|teas/.test(t)) return 'skafferi'
  return null
}

const tidy = (s) => {
  let x = String(s || '').replace(/\s+/g, ' ').trim()
  if (x && x === x.toUpperCase() && /[A-ZÅÄÖ]{5}/.test(x)) x = x.toLowerCase() // "MELLANMJÖLK" → "mellanmjölk"
  return x.charAt(0).toUpperCase() + x.slice(1)
}

// Svar från https://world.openfoodfacts.org/api/v2/product/<kod>.json → { name, brand, qty, place } eller null
export function productFromOff(json) {
  const p = json?.product
  if (!p || json.status === 0) return null
  const name = tidy(p.product_name_sv || p.product_name || p.generic_name_sv || p.generic_name)
  if (!name) return null
  const brand = tidy(String(p.brands || '').split(',')[0])
  const qty = String(p.quantity || '').replace(/\s+/g, ' ').trim().slice(0, 30) || null
  return { name, brand: brand || null, qty, place: placeFromCategories(p.categories_tags) }
}
