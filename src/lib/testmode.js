// Testläge: det man gör räknas inte i statistiken, och kan tas bort när man avslutar.
// Gäller bara den här telefonen.
import { supabase } from '../supabase'

export const TEST_TABLES = ['chores', 'vab_days', 'pickups', 'grocery_spend', 'meal_plan', 'medicine_takes', 'moods']
const TIME_COL = { medicine_takes: 'taken_at' }
const get = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* */ } }

export const isTest = () => !!get('testmode')
export const testSince = () => get('testmode')
export function setTest(on) {
  set('testmode', on ? new Date().toISOString() : null)
  window.dispatchEvent(new Event('testmode-changed'))
}

// Tar bort det som skapades i testläget (rader som ändrats utanför testläget räknas som riktiga och ligger kvar)
export async function removeTestData(since) {
  let n = 0
  for (const t of TEST_TABLES) {
    const { data } = await supabase.from(t).delete().eq('is_test', true).gte(TIME_COL[t] || 'created_at', since).select('id')
    n += data?.length || 0
  }
  window.dispatchEvent(new Event('outbox-flushed')) // läs om tabellerna
  return n
}

// Räknas raden i statistiken? Inte testrader, och inte sådant före "Nolla statistiken".
// Räknas raden i statistiken? Inte testrader, och inte sånt från före nollningen (households.stats_from)
export function counts(r, col, from) {
  if (r.is_test) return false
  const v = r[col]
  if (!from || !v) return true
  if (v.length === 10) { const d = new Date(from); return v >= `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  return new Date(v) >= new Date(from)
}
