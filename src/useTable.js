import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { isTest, TEST_TABLES } from './lib/testmode'

// Tabeller där delade barns rader från det andra hushållet också ska med.
// Där sköter databasens behörighetsregler vad vi får se.
const SHARED = new Set(['events', 'vab_days', 'members', 'custody', 'cars', 'messages', 'custody_exceptions', 'medicines', 'packing_items', 'medicine_takes', 'chores'])
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

// Delade lager: alla komponenter som läser samma tabell (och filter) delar en hämtning
// och en live-prenumeration, i stället för att varje ruta på Idag öppnar sin egen.
const stores = new Map()
function storeFor(table, col, val, order, shared) {
  const key = `${table}:${col}:${val}:${order}`
  let s = stores.get(key)
  if (!s) {
    const ck = cacheKey(table, col, val) + (order === 'created_at' ? '' : `:${order}`)
    const cached = val ? readCache(ck) : null
    s = { key, ck, table, col, val, order, shared, rows: cached || [], loading: !cached, subs: new Set(), refs: 0, channel: null, timer: null }
    stores.set(key, s)
  }
  return s
}
const emit = (s) => { const v = { rows: s.rows, loading: s.loading }; for (const f of s.subs) f(v) }
const setStoreRows = (s, f) => { s.rows = typeof f === 'function' ? f(s.rows) : f; writeCache(s.ck, s.rows); emit(s) }
async function loadStore(s) {
  if (!s.val) { s.rows = []; s.loading = false; return emit(s) }
  if (readOutbox().some((m) => m.table === s.table)) { s.loading = false; return emit(s) } // vänta tills offline-ändringarna skickats
  let q = supabase.from(s.table).select('*')
  if (!s.shared) q = q.eq(s.col, s.val)
  const { data, error } = await q.order(s.order, { ascending: true })
  s.loading = false
  if (!error) setStoreRows(s, data); else emit(s)
}
// Flera ändringar i rad (t.ex. någon bockar av fem varor) ger bara en ny hämtning
const soon = (s) => { clearTimeout(s.timer); s.timer = setTimeout(() => loadStore(s), 250) }
function acquire(s) {
  if (s.refs++ > 0) return
  loadStore(s)
  if (!s.val) return
  s.onFlush = () => loadStore(s)
  window.addEventListener('outbox-flushed', s.onFlush)
  s.channel = supabase
    .channel(`${s.key}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes',
      s.shared ? { event: '*', schema: 'public', table: s.table } : { event: '*', schema: 'public', table: s.table, filter: `${s.col}=eq.${s.val}` },
      () => soon(s))
    .subscribe()
}
function release(s) {
  if (--s.refs > 0) return
  clearTimeout(s.timer)
  if (s.channel) supabase.removeChannel(s.channel)
  if (s.onFlush) window.removeEventListener('outbox-flushed', s.onFlush)
  s.channel = null; s.onFlush = null
}

// Hämtar en tabell för hushållet och håller den uppdaterad live
// när någon annan i familjen ändrar något.
// where = [kolumn, värde] hämtar på något annat än hushållet, t.ex. ['car_id', id]
export function useTable(table, householdId, order = 'created_at', where = null) {
  const shared = SHARED.has(table) && !where
  const [col, val] = where || [table === 'households' ? 'id' : 'household_id', householdId]
  const s = storeFor(table, col, val, order, shared)
  const [state, setState] = useState(() => ({ rows: s.rows, loading: s.loading }))
  useEffect(() => {
    s.subs.add(setState)
    setState({ rows: s.rows, loading: s.loading })
    acquire(s)
    return () => { s.subs.delete(setState); release(s) }
  }, [s])
  const { rows, loading } = state
  const load = useCallback(() => loadStore(s), [s])
  const setRows = (f) => setStoreRows(s, f)

  const insert = async (values) => {
    const base = where ? { [col]: val } : NO_HOUSEHOLD.has(table) ? {} : { household_id: householdId }
    const mark = TEST_TABLES.includes(table) && isTest() ? { is_test: true } : {}
    const list = (Array.isArray(values) ? values : [values]).map((v) => ({ ...base, ...v, ...mark }))
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
  const update = async (id, v0) => {
    // I testläget märks raden som test, utanför testläget blir den riktig igen
    const values = TEST_TABLES.includes(table) ? { ...v0, is_test: isTest() } : v0
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
    if (error) {
      if (offlineError(error)) return queue({ table, op: 'delete', id })
      alert(error.message)
    }
    load()
  }

  return { rows, loading, insert, update, remove, reload: load }
}
