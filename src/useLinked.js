import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Kopplade hushåll (delad vårdnad): andra hushållets namn och föräldrar
export function useLinked(householdId) {
  const [state, setState] = useState({ households: [], people: [] })
  const load = useCallback(async () => {
    const [h, p] = await Promise.all([supabase.rpc('linked_households'), supabase.rpc('linked_people')])
    setState({ households: h.data || [], people: p.data || [] })
  }, [])
  useEffect(() => {
    load()
    const ch = supabase.channel(`links-${householdId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_links' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_children' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, householdId])
  return { ...state, reload: load }
}
