import { supabase } from '../supabase'

export const VAPID_PUBLIC = 'BDi1anC2rBQbs9Kj9MhzcAUoCpKsYelW-tAIskmkmXVqdJBWoKMuHanl00xxF1OSPHLBKAUKVgqoZYqzMqeDCtI'

function b64ToBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export function pushSupport() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    const ios = /iPhone|iPad/.test(navigator.userAgent)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone
    if (ios && !standalone) return 'install'
    return 'unsupported'
  }
  return 'ok'
}

export async function currentSubscription() {
  if (pushSupport() !== 'ok') return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function enablePush(me) {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notiser nekades. Ändra under Inställningar → Notiser på iPhone.')
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) }))
  const j = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({
    household_id: me.household_id, member_id: me.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth
  }, { onConflict: 'endpoint' })
  if (error) throw error
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
