// Skickar pushnotiser: morgonsammanfattning och påminnelser före händelser.
// Anropas var 5:e minut av pg_cron (se migrations/003_push.sql).
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import webpush from 'npm:web-push@3.6.7'
import { occurrences } from './rrule.js'

const TZ = 'Europe/Stockholm'
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function localParts(d: Date) {
  const f = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 }
}
const time = (d: Date) => d.toLocaleTimeString('sv-SE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })

Deno.serve(async (req) => {
  const { data: secrets } = await db.from('app_secrets').select('name, value')
  const s = Object.fromEntries((secrets ?? []).map((r) => [r.name, r.value]))
  if (req.headers.get('x-cron-secret') !== s.cron_secret) return new Response('nope', { status: 401 })
  webpush.setVapidDetails('mailto:noreply@hemappen.local', s.vapid_public, s.vapid_private)

  const body = await req.json().catch(() => ({}))
  const now = new Date()
  const { date: todayLocal, hour } = localParts(now)
  const log: string[] = []

  const { data: households } = await db.from('households').select('*')
  for (const h of households ?? []) {
    const { data: subs } = await db.from('push_subscriptions').select('*').eq('household_id', h.id)
    if (!subs?.length) continue
    const send = async (payload: Record<string, string>, onlyMember?: string) => {
      for (const sub of subs) {
        if (onlyMember && sub.member_id !== onlyMember) continue
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload))
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode
          if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', sub.id)
          log.push(`push-fel ${code}`)
        }
      }
    }

    // Testnotis från appen
    if (body.test && body.member_id) {
      await send({ title: 'Hemappen', body: 'Notiser fungerar! 🎉', url: '/' }, body.member_id)
      continue
    }

    const { data: events } = await db.from('events').select('*').eq('household_id', h.id)
    const { data: members } = await db.from('members').select('id, name').eq('household_id', h.id)
    const nameOf = (id: string | null) => members?.find((m) => m.id === id)?.name

    // Påminnelser före händelser
    for (const e of events ?? []) {
      if (e.all_day || !e.remind_minutes) continue
      const windowEnd = new Date(now.getTime() + e.remind_minutes * 60000)
      const occ = occurrences(new Date(e.starts_at), e.rrule, now, windowEnd)
      for (const o of occ) {
        if (e.reminded_at && new Date(e.reminded_at).getTime() >= o.getTime()) continue
        const who = nameOf(e.member_id)
        await send({ title: `${e.title} kl ${time(o)}`, body: [who, e.location].filter(Boolean).join(' · ') || 'Snart dags', url: '/?tab=calendar' })
        await db.from('events').update({ reminded_at: o.toISOString() }).eq('id', e.id)
        log.push(`påminnelse ${e.title}`)
      }
    }

    // Morgonsammanfattning
    if (hour >= h.morning_push_hour && h.last_morning_push !== todayLocal) {
      const dayStart = new Date(`${todayLocal}T00:00:00`)
      // Justera till svensk tid: hitta UTC-förskjutning
      const offsetH = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date(`${todayLocal}T12:00:00Z`))) - 12
      dayStart.setUTCHours(dayStart.getUTCHours() - offsetH)
      const dayEnd = new Date(dayStart.getTime() + 86400000)
      const todays = (events ?? []).flatMap((e) =>
        e.all_day
          ? (e.starts_at.slice(0, 10) <= todayLocal && (e.ends_at ?? e.starts_at).slice(0, 10) >= todayLocal ? [`${e.title} (heldag)`] : [])
          : occurrences(new Date(e.starts_at), e.rrule, dayStart, dayEnd).map((o) => `${time(o)} ${e.title}`))
      const { data: chores } = await db.from('chores').select('title, assigned_to').eq('household_id', h.id).eq('done', false).lte('due_date', todayLocal)
      const { data: meal } = await db.from('meal_plan').select('dish').eq('household_id', h.id).eq('day', todayLocal).maybeSingle()
      const parts = []
      if (todays.length) parts.push(`📅 ${todays.sort().join(', ')}`)
      if (chores?.length) parts.push(`✅ ${chores.length} sysslor: ${chores.slice(0, 3).map((c) => c.title).join(', ')}${chores.length > 3 ? '…' : ''}`)
      if (meal) parts.push(`🍝 Middag: ${meal.dish}`)
      if (parts.length) await send({ title: 'God morgon! Det här händer idag', body: parts.join('\n'), url: '/' })
      await db.from('households').update({ last_morning_push: todayLocal }).eq('id', h.id)
      log.push(`morgon ${h.name}: ${parts.length} rader`)
    }
  }
  return new Response(JSON.stringify({ ok: true, log }), { headers: { 'Content-Type': 'application/json' } })
})
