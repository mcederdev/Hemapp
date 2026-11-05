import { useEffect, useState } from 'react'

// Uppdaterar "nu" med jämna mellanrum (för nu-linjer och klockor)
export function useNow(ms = 60000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), ms); return () => clearInterval(id) }, [ms])
  return now
}

// Håller skärmen tänd så länge komponenten visas (där webbläsaren stöder det)
export function useWakeLock(active = true) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock = null, stopped = false
    const get = async () => { try { lock = await navigator.wakeLock.request('screen') } catch { /* ignoreras */ } }
    const onVis = () => { if (document.visibilityState === 'visible' && !stopped) get() }
    get()
    document.addEventListener('visibilitychange', onVis)
    return () => { stopped = true; document.removeEventListener('visibilitychange', onVis); lock?.release().catch(() => {}) }
  }, [active])
}
