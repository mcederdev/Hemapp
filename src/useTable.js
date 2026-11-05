import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Tabeller där delade barns rader från det andra hushållet också ska med.
// Där sköter databasens behörighetsregler vad vi får se.
const SHARED = new Set(['events', 'vab_days', 'members', 'custody', 'cars', 'messages'])

// Hämtar en tabell för hushållet och håller den uppdaterad live
// när någon annan i familjen ändrar något.
// where = [kolumn, värde] hämtar på något annat än hushållet, t.ex. ['car_id', id]
export function useTable(table, householdId, order = 'created_at', where = null) {
  const shared = SHARED.has(table) && !where
  const [col, val] = where || [table === 'households' ? 'id' : 'household_id', householdId]
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!val) { setRows([]); setLoading(false); return }
    let q = supabase.from(table).select('*')
    if (!shared) q = q.eq(col, val)
    const { data, error } = await q.order(order, { ascending: true })
    if (!error) setRows(data)
    setLoading(false)
  }, [table, val, order, col, shared])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`${table}-${val}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes',
        shared ? { event: '*', schema: 'public', table } : { event: '*', schema: 'public', table, filter: `${col}=eq.${val}` },
        load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load, table, val, shared, col])

  const insert = async (values) => {
    const base = where ? { [col]: val } : { household_id: householdId }
    const rows = (Array.isArray(values) ? values : [values]).map((v) => ({ ...base, ...v }))
    const { data, error } = await supabase.from(table).insert(rows).select()
    if (error) alert(error.message)
    load()
    return data
  }
  const update = async (id, values) => {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...values } : x)))
    const { error } = await supabase.from(table).update(values).eq('id', id)
    if (error) alert(error.message)
    load()
  }
  const remove = async (id) => {
    setRows((r) => r.filter((x) => x.id !== id))
    await supabase.from(table).delete().eq('id', id)
    load()
  }

  return { rows, loading, insert, update, remove, reload: load }
}
