import { useTable } from './useTable'
import { pantryPlace } from './lib/refill'

// Streckkoder som familjen har skannat (tabellen barcodes) och uppslag i Open Food Facts.
export function useBarcodes(householdId) {
  const codes = useTable('barcodes', householdId)

  // Kom ihåg vad koden betyder hos oss
  const remember = (code, v) => {
    const known = codes.rows.find((r) => r.code === code)
    const row = { name: v.name, place: v.place || null, qty: v.qty || null }
    if (!known) codes.insert({ code, ...row })
    else if (known.name !== row.name || known.place !== row.place || (known.qty || null) !== row.qty) codes.update(known.id, row)
  }

  // Vad är det för vara? Först det vi skannat förut, sen Open Food Facts.
  // from: 'known' (skannad förut), 'off' (hittad i registret) eller 'unknown'
  const lookup = async (code, fallbackPlace = 'kyl') => {
    const known = codes.rows.find((r) => r.code === code)
    if (known) return { name: known.name, place: known.place || 'skafferi', qty: known.qty || '', from: 'known' }
    try {
      const r = await fetch(`/api/barcode?code=${code}`)
      if (r.ok) {
        const p = await r.json()
        return { name: p.name, brand: p.brand, qty: p.qty || '', place: p.place || pantryPlace({ name: p.name })?.place || 'skafferi', from: 'off' }
      }
    } catch { /* utan nät: skriv själv */ }
    return { name: '', qty: '', place: fallbackPlace, from: 'unknown' }
  }

  return { lookup, remember }
}
