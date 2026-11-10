// Plockar ut ett recept ur en receptsida. Nästan alla receptsajter (ICA, Arla, Köket, Coop, Mathem m.fl.)
// lägger receptet som schema.org/Recipe i JSON-LD, så det räcker att leta upp det.

const text = (s) => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&deg;/g, '°').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
const isRecipe = (o) => o && typeof o === 'object' && [].concat(o['@type'] || []).some((t) => String(t).toLowerCase() === 'recipe')

function findRecipe(node) {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n); if (r) return r } return null }
  if (isRecipe(node)) return node
  for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) { const r = findRecipe(node[k]); if (r) return r }
  return null
}

// Stegen kan vara text, en lista med text, HowToStep eller HowToSection med steg i
function steps(x) {
  if (!x) return []
  if (typeof x === 'string') return x.split(/\n+|(?<=\.)\s+(?=\d+\.\s)/).map(text).filter(Boolean)
  if (Array.isArray(x)) return x.flatMap(steps)
  if (x.itemListElement) return steps(x.itemListElement)
  return [text(x.text || x.name)].filter(Boolean)
}

function servings(y) {
  const s = [].concat(y || []).map(String).join(' ')
  const m = s.match(/\d+/)
  return m ? Number(m[0]) : null
}

export function extractRecipe(html) {
  const blocks = [...String(html).matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1])
  for (const b of blocks) {
    let data
    try { data = JSON.parse(b.trim()) } catch { try { data = JSON.parse(b.trim().replace(/[\u0000-\u001f]+/g, ' ')) } catch { continue } }
    const r = findRecipe(data)
    if (!r) continue
    return {
      name: text(r.name),
      servings: servings(r.recipeYield),
      ingredients: [].concat(r.recipeIngredient || r.ingredients || []).map(text).filter(Boolean),
      instructions: steps(r.recipeInstructions).filter((s, i, a) => a.indexOf(s) === i)
    }
  }
  return null
}
