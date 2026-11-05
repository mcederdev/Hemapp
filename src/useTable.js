import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Hämtar en tabell för hushållet och håller den uppdaterad live
// när någon annan i familjen ändrar något.
export function useTable(table, householdId, order = 'created_at') {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('household_id', householdId)
      .order(order, { ascending: true })
    if (!error) setRows(data)
    setLoading(false)
  }, [table, householdId, order])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`${table}-${householdId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` },
        load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load, table, householdId])

  const insert = async (values) => {
    const { error } = await supabase.from(table).insert({ household_id: householdId, ...values })
    if (error) alert(error.message)
    load()
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
