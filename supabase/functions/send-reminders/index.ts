// Skickar pushnotiser: morgonsammanfattning och påminnelser före händelser.
// Anropas var 5:e minut av pg_cron (se migrations/003_push.sql).
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import webpush from 'npm:web-push@3.6.7'
import { occurrences } from './rrule.js'
import { planDue } from './plans.js'
import { nextBirthday, daysUntil } from './yearly.js'
import { nextHandover, withAnchor } from './custody.js'
import { medicineStatus } from './medicine.js'

const TZ = 'Europe/Stockholm'
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function localParts(d: Date) {
  const f = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, hm: `${String(Number(p.hour) % 24).padStart(2, '0')}:${p.minute}` }
}
const time = (d: Date) => d.toLocaleTimeString('sv-SE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })

Deno.serve(async (req) => {
  const { data: secrets } = await db.from('app_secrets').select('name, value')
  const s = Object.fromEntries((secrets ?? []).map((r) => [r.name, r.value]))
  if (req.headers.get('x-cron-secret') !== s.cron_secret) return new Response('nope', { status: 401 })
  // Apple kräver ett giltigt subject (https-adress eller riktig mailto), annars 403 BadJwtToken
  webpush.setVapidDetails(s.vapid_subject || 'https://hemapp.vercel.app', s.vapid_public, s.vapid_private)

  const body = await req.json().catch(() => ({}))
  const now = new Date()
  const { date: todayLocal, hour, hm } = localParts(now)
  const log: string[] = []
  // Delade händelser (delad vårdnad) har en gemensam reminded_at. Inom samma körning får båda hushållen notisen.
  const sentThisRun = new Map<string, number>()

  const { data: households } = await db.from('households').select('*')
  for (const h of households ?? []) {
    // Återkommande sysslor: lägg till nya när det är dags (efter kl 04)
    if (!body.test && !body.notify && hour >= 4) {
      const { data: plans } = await db.from('chore_plans').select('*').eq('household_id', h.id)
      for (const pl of plans ?? []) {
        const due = planDue(pl, todayLocal)
        if (!due) continue
        // Finns förra omgången kvar ogjord låter vi den ligga kvar i stället för att dubblera
        const { data: open } = await db.from('chores').select('id').eq('plan_id', pl.id).eq('done', false).limit(1)
        if (!open?.length) {
          await db.from('chores').insert({ household_id: h.id, title: pl.title, assigned_to: pl.assigned_to, stars: pl.stars, due_date: due, plan_id: pl.id })
          log.push(`syssla ${pl.title}`)
        }
        await db.from('chore_plans').update({ last_added: todayLocal }).eq('id', pl.id)
      }
    }

    const { data: subs } = await db.from('push_subscriptions').select('*').eq('household_id', h.id)
    if (!subs?.length) continue
    // Den som dolt en sida eller undersida i menyn (members.menu.hidden) får inte notiser om den.
    // Ämnet tas från payload.topic, annars från sidan i url:en (?tab=...).
    const { data: menus } = await db.from('members').select('id, menu').eq('household_id', h.id)
    const hiddenFor = Object.fromEntries((menus ?? []).map((m) => [m.id, (m.menu?.hidden ?? []) as string[]]))
    const TAB_TOPIC: Record<string, string> = { overtime: 'finance.overtime' }
    const muted = (memberId: string, topic?: string) => {
      if (!topic) return false
      const hidden = hiddenFor[memberId] ?? []
      return hidden.includes(topic.split('.')[0]) || hidden.includes(topic)
    }
    const send = async (payload: Record<string, string>, onlyMember?: string, exceptMember?: string) => {
      const tab = (payload.url ?? '').match(/tab=(\w+)/)?.[1]
      const topic = payload.topic ?? (tab ? TAB_TOPIC[tab] ?? tab : undefined)
      delete payload.topic
      for (const sub of subs) {
        if (onlyMember && sub.member_id !== onlyMember) continue
        if (exceptMember && sub.member_id === exceptMember) continue
        if (muted(sub.member_id, topic)) continue
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload))
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode
          if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', sub.id)
          log.push(`push-fel ${code} ${String((e as { body?: string }).body ?? '').slice(0, 120)}`)
        }
      }
    }

    // Testnotis från appen
    if (body.test && body.member_id) {
      await send({ title: 'Hemappen', body: 'Notiser fungerar! 🎉', url: '/' }, body.member_id)
      continue
    }
    // Notis till resten av familjen, t.ex. "Magnus har handlat"
    if (body.notify) {
      if (body.household_id === h.id) await send({ title: String(body.title || 'Hemappen'), body: '', url: String(body.url || '/') }, undefined, body.member_id)
      continue
    }

    // Delad vårdnad: kopplade hushåll, delade barn och bilar
    const { data: links } = await db.from('household_links').select('id, a, b').or(`a.eq.${h.id},b.eq.${h.id}`)
    const linkIds = (links ?? []).map((l) => l.id)
    const { data: shared } = linkIds.length ? await db.from('shared_children').select('child_id').in('link_id', linkIds) : { data: [] }
    const kidIds = [...new Set((shared ?? []).map((x) => x.child_id))]
    const inList = (ids: string[]) => ids.join(',')
    const { data: events } = await db.from('events').select('*')
      .or(`household_id.eq.${h.id}${kidIds.length ? `,member_id.in.(${inList(kidIds)})` : ''}`)
    const { data: ownMembers } = await db.from('members').select('id, name').eq('household_id', h.id)
    const { data: sharedKids } = kidIds.length ? await db.from('members').select('id, name').in('id', kidIds) : { data: [] }
    const members = [...(ownMembers ?? []), ...(sharedKids ?? []).filter((k) => !ownMembers?.some((m) => m.id === k.id))]
    const nameOf = (id: string | null) => members.find((m) => m.id === id)?.name

    // Påminnelser före händelser
    for (const e of events ?? []) {
      if (e.all_day || !e.remind_minutes) continue
      const windowEnd = new Date(now.getTime() + e.remind_minutes * 60000)
      const occ = occurrences(new Date(e.starts_at), e.rrule, now, windowEnd, e.exdates)
      for (const o of occ) {
        if (e.reminded_at && new Date(e.reminded_at).getTime() >= o.getTime() && sentThisRun.get(e.id) !== o.getTime()) continue
        const who = nameOf(e.member_id)
        const endTxt = e.ends_at ? '–' + time(new Date(o.getTime() + new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime())) : ''
        await send({ title: `${e.title} kl ${time(o)}${endTxt}`, body: [who, e.location].filter(Boolean).join(' · ') || 'Snart dags', url: '/?tab=calendar' })
        await db.from('events').update({ reminded_at: o.toISOString() }).eq('id', e.id)
        sentThisRun.set(e.id, o.getTime())
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
      const dur = (e: { starts_at: string; ends_at: string | null }) => (e.ends_at ? new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime() : 0)
      // Händelser som började igår och fortsätter idag
      const continuing = (events ?? []).filter((e) => !e.all_day && e.ends_at).flatMap((e) =>
        occurrences(new Date(e.starts_at), e.rrule, new Date(dayStart.getTime() - dur(e)), dayStart, e.exdates)
          .map((o) => new Date(o.getTime() + dur(e)))
          .filter((end) => end > dayStart)
          .map((end) => `Dag2 ${e.title} till ${time(end)}`))
      const todays = [
        ...continuing,
        ...(events ?? []).flatMap((e) =>
          e.all_day
            ? (new Date(e.starts_at) < dayEnd && new Date(e.ends_at ?? e.starts_at) > dayStart && !(continuing.length && e.title.trim().toLowerCase() === 'dag2') ? [`${e.title} (heldag)`] : [])
            : occurrences(new Date(e.starts_at), e.rrule, dayStart, dayEnd, e.exdates).map((o) => `${time(o)}${e.ends_at ? '–' + time(new Date(o.getTime() + dur(e))) : ''} ${e.title}`))
      ]
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

    // Årliga påminnelser och födelsedagar (en gång per dag, vid morgontimmen)
    if (hour >= h.morning_push_hour && h.last_yearly_push !== todayLocal) {
      const when = (n: number) => (n === 0 ? 'idag' : n === 1 ? 'imorgon' : `om ${n} dagar`)
      const { data: cars } = await db.from('cars').select('id').or(`household_id.eq.${h.id}${linkIds.length ? `,link_id.in.(${inList(linkIds)})` : ''}`)
      const carIds = (cars ?? []).map((c) => c.id)
      const { data: rems } = await db.from('reminders').select('*').or(`household_id.eq.${h.id}${carIds.length ? `,car_id.in.(${inList(carIds)})` : ''}`)
      for (const r of rems ?? []) {
        const n = daysUntil(todayLocal, r.due_date)
        // notified_by = { hushålls-id: datum } så att båda hushållen får bilens påminnelser
        const by = r.notified_by ?? {}
        if (n > r.remind_days || by[h.id] === r.due_date || (r.notified_for === r.due_date && !Object.keys(by).length)) continue
        await send({ title: `${r.emoji} ${r.title} ${n < 0 ? 'har passerat' : when(n)}`, body: r.note || 'Tryck för att se påminnelsen', url: r.car_id ? '/?tab=car' : '/?tab=reminders', topic: r.car_id ? 'car' : 'reminders.reminders' })
        await db.from('reminders').update({ notified_for: r.due_date, notified_by: { ...by, [h.id]: r.due_date } }).eq('id', r.id)
      }
      const { data: bdays } = await db.from('birthdays').select('*').eq('household_id', h.id)
      for (const b of bdays ?? []) {
        const x = nextBirthday(b.day, todayLocal)
        const age = b.year_known ? ` ${x.age} år` : ' år'
        if (x.daysLeft === 0) {
          await send({ title: `🎉 Idag fyller ${b.name}${age}!`, body: b.gift_ideas ? `🎁 ${b.gift_ideas}` : 'Glöm inte att gratulera', url: '/?tab=reminders', topic: 'reminders.birthdays' })
        } else if (x.daysLeft <= b.remind_days && b.notified_year !== +x.date.slice(0, 4)) {
          await send({ title: `🎂 ${b.name} fyller${age} ${when(x.daysLeft)}`, body: b.gift_ideas ? `🎁 Idéer: ${b.gift_ideas}` : 'Dags att fixa present?', url: '/?tab=reminders', topic: 'reminders.birthdays' })
          await db.from('birthdays').update({ notified_year: +x.date.slice(0, 4) }).eq('id', b.id)
        }
      }
      // Övertid: näst sista dagen i månaden påminns var och en (bara sig själv) om att lägga in övertiden hos arbetsgivaren
      const [ty, tm] = todayLocal.split('-').map(Number)
      const lastBut = new Date(Date.UTC(ty, tm, -1)).toISOString().slice(0, 10)
      if (todayLocal === lastBut) {
        const { data: ots } = await db.from('overtime_settings').select('*').eq('household_id', h.id)
        for (const st of ots ?? []) {
          if (st.last_reminder === todayLocal.slice(0, 7)) continue
          const { data: rows } = await db.from('overtime').select('starts_at, ends_at').eq('member_id', st.member_id).is('reported_at', null)
          if (rows?.length) {
            const mins = rows.reduce((a, r) => a + (new Date(r.ends_at).getTime() - new Date(r.starts_at).getTime()) / 60000, 0)
            const hh = Math.floor(mins / 60), mm = Math.round(mins % 60)
            await send({ title: '⏱️ Dags att lägga in övertiden', body: `${rows.length} pass, ${hh} h${mm ? ` ${mm} min` : ''} att föra in i arbetsgivarens system`, url: '/?tab=overtime' }, st.member_id)
            log.push(`övertid ${st.member_id}`)
          }
          await db.from('overtime_settings').update({ last_reminder: todayLocal.slice(0, 7) }).eq('member_id', st.member_id)
        }
      }
      // Medicin som snart tar slut (egna och delade barns). notified_by = { hushåll: opened_on }
      const { data: meds } = await db.from('medicines').select('*').or(`household_id.eq.${h.id}${kidIds.length ? `,member_id.in.(${inList(kidIds)})` : ''}`)
      for (const m of meds ?? []) {
        const st = medicineStatus(m, todayLocal)
        const by = m.notified_by ?? {}
        if (m.spare > 0 || st.daysLeft > m.remind_days || by[h.id] === m.opened_on) continue
        const who = nameOf(m.member_id) ?? ''
        await send({ title: `💊 ${m.name}${who ? ` till ${who}` : ''} ${st.left <= 0 ? 'är slut' : `räcker ${st.daysLeft === 0 ? 'bara idag' : `${st.daysLeft} dagar till`}`}`, body: m.note || 'Dags att hämta ut en ny flaska', url: '/?tab=medicine' })
        await db.from('medicines').update({ notified_for: m.opened_on, notified_by: { ...by, [h.id]: m.opened_on } }).eq('id', m.id)
        log.push(`medicin ${m.name} ${h.name}`)
      }
      await db.from('households').update({ last_yearly_push: todayLocal }).eq('id', h.id)
    }

    // Växelvis boende: notis kvällen före bytet till båda hushållen
    if (hour >= 18) {
      const { data: cust } = await db.from('custody').select('*').or(`household_id.eq.${h.id}${linkIds.length ? `,link_id.in.(${inList(linkIds)})` : ''}`)
      const custIds = (cust ?? []).map((c) => c.id)
      const { data: exc } = custIds.length ? await db.from('custody_exceptions').select('*').in('custody_id', custIds) : { data: [] }
      for (const c of cust ?? []) {
        c.exceptions = (exc ?? []).filter((x) => x.custody_id === c.id)
        const next = nextHandover(c, todayLocal, hm)
        const by = c.notified_by ?? {}
        if (daysUntil(todayLocal, next.date) !== 1 || by[h.id] === next.date) continue
        const kid = nameOf(c.child_id) ?? 'Barnet'
        const toUs = withAnchor(c, next.date, '23:59') === (c.household_id === h.id)
        let other = c.other_label
        if (c.link_id) {
          const l = links?.find((x) => x.id === c.link_id)
          const otherId = l ? (l.a === h.id ? l.b : l.a) : null
          const { data: oh } = otherId ? await db.from('households').select('name').eq('id', otherId).maybeSingle() : { data: null }
          if (oh?.name) other = oh.name
        }
        let packTxt = 'Glöm inte att packa väskan'
        if (!toUs) {
          const { data: pack } = await db.from('packing_items').select('title, packed_for').eq('household_id', h.id).eq('child_id', c.child_id)
          const left = (pack ?? []).filter((x) => x.packed_for !== next.date)
          if (pack?.length) packTxt = left.length ? `🎒 Kvar att packa: ${left.slice(0, 4).map((x) => x.title).join(', ')}${left.length > 4 ? '…' : ''}` : '🎒 Allt är packat!'
        }
        await send({ title: `🔁 Imorgon kl ${next.time} ${toUs ? `kommer ${kid} hem till er` : `åker ${kid} till ${other}`}`, body: toUs ? 'Dags att förbereda rummet och veckan' : packTxt, url: '/?tab=today' })
        await db.from('custody').update({ notified_by: { ...by, [h.id]: next.date }, notified_for: next.date }).eq('id', c.id)
        log.push(`byte ${kid} ${h.name}`)
      }
    }

    // Veckoöversikt söndag kväll kl 19: vad som händer nästa vecka
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(now)
    if (wd === 'Sun' && hour >= 19 && h.last_week_push !== todayLocal) {
      const offsetH = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date(`${todayLocal}T12:00:00Z`))) - 12
      const start = new Date(`${todayLocal}T00:00:00Z`); start.setUTCDate(start.getUTCDate() + 1); start.setUTCHours(start.getUTCHours() - offsetH)
      const end = new Date(start.getTime() + 7 * 86400000)
      const dayName = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: TZ, weekday: 'short' })
      const items: [number, string][] = []
      for (const e of events ?? []) {
        if (e.title?.trim().toLowerCase() === 'dag2') continue
        for (const o of occurrences(new Date(e.starts_at), e.rrule, start, end, e.exdates)) items.push([o.getTime(), `${dayName(o)} ${e.all_day ? '' : time(o) + ' '}${e.title}`])
      }
      items.sort((a, b) => a[0] - b[0])
      const lastDay = new Date(end.getTime() - 3600000).toISOString().slice(0, 10)
      const { data: meals } = await db.from('meal_plan').select('day').eq('household_id', h.id).gte('day', start.toISOString().slice(0, 10)).lte('day', lastDay)
      const lines = []
      if (items.length) lines.push(`📅 ${items.length} händelser: ${items.slice(0, 5).map((x) => x[1]).join(', ')}${items.length > 5 ? '…' : ''}`)
      else lines.push('📅 Inget inplanerat än')
      lines.push(`🍝 ${meals?.length ?? 0} av 7 middagar planerade`)
      await send({ title: 'Veckan som kommer', body: lines.join('\n'), url: '/?tab=calendar' })
      await db.from('households').update({ last_week_push: todayLocal }).eq('id', h.id)
      log.push(`vecka ${h.name}`)
    }

    // VAB: påminnelse söndag kväll om dagar som inte är anmälda till Försäkringskassan
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(now)
    if (weekday === 'Sun' && hour >= 18 && h.last_vab_push !== todayLocal) {
      const { data: vab } = await db.from('vab_days').select('day, parent_id, hours').eq('kind', 'vab').eq('reported', false)
        .or(`household_id.eq.${h.id}${kidIds.length ? `,child_id.in.(${inList(kidIds)})` : ''}`).order('day')
      const byParent = new Map<string, { day: string }[]>()
      for (const r of vab ?? []) { if (!r.parent_id || !ownMembers?.some((m) => m.id === r.parent_id)) continue; byParent.set(r.parent_id, [...(byParent.get(r.parent_id) ?? []), r]) }
      for (const [pid, list] of byParent) {
        const days = list.map((r) => new Date(r.day + 'T12:00:00Z').toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' }))
        await send({ title: `Anmäl ${list.length} VAB-dag${list.length === 1 ? '' : 'ar'} till Försäkringskassan`, body: days.join(', '), url: '/?tab=vab', topic: 'vab.vab' }, pid)
      }
      await db.from('households').update({ last_vab_push: todayLocal }).eq('id', h.id)
      if (byParent.size) log.push(`vab-påminnelse ${h.name}`)
    }
  }
  return new Response(JSON.stringify({ ok: true, log }), { headers: { 'Content-Type': 'application/json' } })
})
