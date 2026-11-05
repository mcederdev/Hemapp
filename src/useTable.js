import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Tabeller där delade barns rader från det andra hushållet också ska med.
// Där sköter databasens behörighetsregler vad vi får se.
const SHARED = new Set(['events', 'vab_days', 'members', 'custody', 'cars', 'messages', 'custody_exceptions', 'medicines', 'pickups', 'packing_items'])
// Tabeller utan household_id-kolumn
const NO_HOUSEHOLD = new Set(['custody_exceptions'])

// Sparad kopia i telefonen så att appen visar något direkt vid start (och utan nät)
const cacheKey = (table, col, val) => `cache:${table}:${col}:${val}`
const readCache = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } }
const writeCache = (k, rows) => { try { localStorage.setItem(k, JSON.stringify(rows)) } catch { /* fullt, strunt i det */ } }

// Ändringar som gjorts utan nät skickas när nätet är tillbaka
const OUTBOX = 'outbox'
const readOutbox = () => { try { return JSON.parse(localStorage.getItem(OUTBOX) || '[]') } catch { return [] } }
const writeOutbox = (q) => { try { localStorage.setItem(OUTBOX, JSON.stringify(q)) } catch { /* */ } }
const offlineError = (error) => !navigator.onLine || /fetch|network|load failed/i.test(error?.message || '')
let flushing = false
export async function flushOutbox() {
  if (flushing || !navigator.onLine) return
  flushing = true
  try {
    let q = readOutbox()
    while (q.length) {
      const m = q[0]
      let res
      if (m.op === 'insert') res = await supabase.from(m.table).upsert(m.rows)
      else if (m.op === 'update') res = await supabase.from(m.table).update(m.values).eq('id', m.id)
      else res = await supabase.from(m.table).delete().eq('id', m.id)
      if (res.error && offlineError(res.error)) break
      q = readOutbox().slice(1)
      writeOutbox(q)
    }
  } finally {
    flushing = false
    window.dispatchEvent(new Event('outbox-flushed'))
  }
}
export const pendingCount = () => readOutbox().length
if (typeof window !== 'undefined') {
  window.addEventListener('online', flushOutbox)
  setTimeout(flushOutbox, 3000)
}
const queue = (m) => { writeOutbox([...readOutbox(), m]); window.dispatchEvent(new Event('outbox-changed')) }

// Hämtar en tabell för hushållet och håller den uppdaterad live
// när någon annan i familjen ändrar något.
// where = [kolumn, värde] hämtar på något annat än hushållet, t.ex. ['car_id', id]
export function useTable(table, householdId, order = 'created_at', where = null) {
  const shared = SHARED.has(table) && !where
  const [col, val] = where || [table === 'households' ? 'id' : 'household_id', householdId]
  const key = cacheKey(table, col, val)
  const [rows, setRowsRaw] = useState(() => (val && readCache(key)) || [])
  const [loading, setLoading] = useState(() => !(val && readCache(key)))
  const setRows = useCallback((f) => setRowsRaw((r) => { const n = typeof f === 'function' ? f(r) : f; writeCache(key, n); return n }), [key])

  const load = useCallback(async () => {
    if (!val) { setRowsRaw([]); setLoading(false); return }
    if (readOutbox().some((m) => m.table === table)) { setLoading(false); return } // vänta tills offline-ändringarna skickats
    let q = supabase.from(table).select('*')
    if (!shared) q = q.eq(col, val)
    const { data, error } = await q.order(order, { ascending: true })
    if (!error) setRows(data)
    setLoading(false)
  }, [table, val, order, col, shared, setRows])

  useEffect(() => {
    setRowsRaw((val && readCache(key)) || [])
    load()
    const channel = supabase
      .channel(`${table}-${val}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes',
        shared ? { event: '*', schema: 'public', table } : { event: '*', schema: 'public', table, filter: `${col}=eq.${val}` },
        load)
      .subscribe()
    window.addEventListener('outbox-flushed', load)
    return () => { supabase.removeChannel(channel); window.removeEventListener('outbox-flushed', load) }
  }, [load, table, val, shared, col, key])

  const insert = async (values) => {
    const base = where ? { [col]: val } : NO_HOUSEHOLD.has(table) ? {} : { household_id: householdId }
    const list = (Array.isArray(values) ? values : [values]).map((v) => ({ ...base, ...v }))
    if (!navigator.onLine) return queueInsert(list)
    const { data, error } = await supabase.from(table).insert(list).select()
    if (error) {
      if (offlineError(error)) return queueInsert(list)
      alert(error.message)
    }
    load()
    return data
  }
  const queueInsert = (list) => {
    const withIds = list.map((v) => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...v }))
    queue({ table, op: 'insert', rows: withIds })
    setRows((r) => [...r, ...withIds])
    return withIds
  }
  const update = async (id, values) => {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...values } : x)))
    if (!navigator.onLine) return queue({ table, op: 'update', id, values })
    const { error } = await supabase.from(table).update(values).eq('id', id)
    if (error) {
      if (offlineError(error)) return queue({ table, op: 'update', id, values })
      alert(error.message)
    }
    load()
  }
  const remove = async (id) => {
    setRows((r) => r.filter((x) => x.id !== id))
    if (!navigator.onLine) return queue({ table, op: 'delete', id })
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error && offlineError(error)) return queue({ table, op: 'delete', id })
    load()
  }

  return { rows, loading, insert, update, remove, reload: load }
}
