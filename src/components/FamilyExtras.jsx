import { useRef, useState } from 'react'
import { supabase } from '../supabase'
import { ACCENTS, applyAccent } from '../lib/accent'
import Icon from './Icon'
import { iso as localDay } from '../lib/dates'

// Profilbild: tryck på bilden för att välja en ny. Förminskas till 256 px i telefonen innan den laddas upp.
export function AvatarUpload({ member, householdId, membersTable, size = 40 }) {
  const ref = useRef()
  const [busy, setBusy] = useState(false)
  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const blob = await shrink(file, 256)
      const path = `${householdId}/${member.id}-${Date.now()}.jpg`
      const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await membersTable.update(member.id, { avatar_url: data.publicUrl })
    } catch (err) { alert(`Bilden kunde inte laddas upp: ${err.message || err}`) }
    setBusy(false)
  }
  return (
    <>
      <button type="button" className={`avatar-edit ${busy ? 'busy' : ''}`} style={{ width: size, height: size, background: member.color }} onClick={() => ref.current.click()} aria-label={`Byt bild för ${member.name}`}>
        {member.avatar_url ? <img src={member.avatar_url} alt="" /> : <span>{member.short || member.name.slice(0, 1)}</span>}
        <i>📷</i>
      </button>
      <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
      {member.avatar_url && <button type="button" className="link small" onClick={() => membersTable.update(member.id, { avatar_url: null })}>Ta bort bild</button>}
    </>
  )
}

async function shrink(file, max) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url })
    // Beskär till en kvadrat i mitten
    const s = Math.min(img.width, img.height)
    const c = document.createElement('canvas')
    c.width = c.height = Math.min(max, s)
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, c.width, c.height)
    return await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85))
  } finally { URL.revokeObjectURL(url) }
}

// Familjens färg och säsongsfigurer
export function AccentPicker({ household, households }) {
  if (!household) return null
  const theme = household.theme || {}
  const save = (patch) => {
    const t = { ...theme, ...patch }
    households.update(household.id, { theme: t })
    applyAccent(t.accent)
  }
  return (
    <div className="stack">
      <span className="muted small">Färg i appen: varje flik har sin egen färg, eller välj en färg för hela familjen</span>
      <div className="row wrap">
        {ACCENTS.map((c, i) => (
          <button key={c} type="button" className={`swatch ${(theme.accent || ACCENTS[0]) === c ? 'on' : ''}`} style={{ background: i === 0 ? 'var(--card)' : c }}
            onClick={() => save({ accent: i === 0 ? null : c })} aria-label={i === 0 ? 'Flikarnas egna färger' : `Färg ${i + 1}`}>{i === 0 ? '🌈' : null}</button>
        ))}
      </div>
      <label className="row"><input type="checkbox" checked={theme.season !== false} onChange={(e) => save({ season: e.target.checked })} /> Säsongsfigur i hälsningen (🎄 🌸 ☀️ 🍂)</label>
    </div>
  )
}

// Plats för vädret på köksskärmen
export function PlacePicker({ household, households }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState(null)
  if (!household) return null
  const search = async (e) => {
    e.preventDefault()
    if (!q.trim()) return
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=5&language=sv&countryCode=SE`).then((x) => x.json()).catch(() => null)
    setHits(r?.results || [])
  }
  const choose = (h) => { households.update(household.id, { lat: h.latitude, lon: h.longitude, place_name: h.name }); setHits(null); setQ('') }
  return (
    <div className="card stack">
      <h3 className="row"><Icon name="sun" size={18} /> Väder</h3>
      <p className="muted small">{household.place_name ? `Vädret på köksskärmen visas för ${household.place_name}.` : 'Välj ort så visas vädret på köksskärmen.'}</p>
      <form className="row" onSubmit={search}>
        <input placeholder="Ort (t.ex. Uppsala)" value={q} onChange={(e) => setQ(e.target.value)} />
        <button>Sök</button>
      </form>
      {hits && (hits.length ? (
        <ul className="list">{hits.map((h) => <li key={h.id} className="tap" onClick={() => choose(h)}><span>{h.name}</span><span className="muted small">{h.admin1}</span></li>)}</ul>
      ) : <p className="muted small">Hittade ingen ort med det namnet.</p>)}
    </div>
  )
}

// Gäster: mor- och farföräldrar m.fl. som får se kalendern och skriva lappar och meddelanden
export function Guests({ guests, guestsTable }) {
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const create = async () => {
    setMsg('')
    const { data, error } = await supabase.rpc('create_guest_invite')
    if (error) setMsg(error.message); else setCode(data)
  }
  const remove = async (g) => {
    if (!confirm(`Ta bort ${g.name} som gäst? Hen ser då inte familjen längre.`)) return
    const { error } = await supabase.from('guests').delete().eq('id', g.id)
    if (error) alert(error.message)
    guestsTable.reload()
  }
  return (
    <div className="card stack">
      <h3 className="row"><Icon name="users" size={18} /> Gäster</h3>
      <p className="muted small">Till exempel mormor och morfar. De ser kalendern, middagarna, lapparna och familjens meddelanden, och kan skriva lappar och meddelanden. De ser inte ekonomi, sysslor eller VAB.</p>
      {guests.length > 0 && (
        <ul className="list">{guests.map((g) => <li key={g.id}><span>👵 {g.name}</span><button className="chip" onClick={() => remove(g)}>Ta bort</button></li>)}</ul>
      )}
      {!code && <button onClick={create}>Bjud in en gäst</button>}
      {code && (
        <>
          <p>Gästen skapar ett konto i appen, väljer <em>Jag är gäst</em> och skriver:</p>
          <p className="code">{code}</p>
          <p className="muted small">Koden gäller i 30 dagar.</p>
        </>
      )}
      {msg && <p className="error">{msg}</p>}
    </div>
  )
}

// Exportera allt: en JSON-fil med hushållets data och kalendern som .ics
const EXPORT_TABLES = ['households', 'members', 'events', 'shopping_lists', 'shopping_items', 'item_catalog', 'chores', 'chore_plans', 'chore_templates', 'routines', 'dishes', 'meal_plan',
  'bills', 'settlements', 'vab_days', 'reminders', 'birthdays', 'notes', 'messages', 'custody', 'packing_items', 'medicines', 'pickups', 'moods', 'grocery_spend', 'pantry_items', 'subscriptions', 'cars', 'guests', 'medicine_takes']
export function ExportData({ householdId, household }) {
  const [busy, setBusy] = useState(false)
  const save = (name, text, type) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type }))
    a.download = name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
  const stamp = new Date().toISOString().slice(0, 10)
  const json = async () => {
    setBusy(true)
    const out = { exported_at: new Date().toISOString() }
    for (const t of EXPORT_TABLES) {
      const q = supabase.from(t).select('*')
      const { data } = t === 'households' ? await q.eq('id', householdId) : t === 'events' || t === 'members' || t === 'messages' || t === 'medicine_takes' ? await q : await q.eq('household_id', householdId)
      out[t] = data || []
    }
    save(`hemappen-${stamp}.json`, JSON.stringify(out, null, 2), 'application/json')
    setBusy(false)
  }
  const ics = async () => {
    const { data } = await supabase.from('events').select('*').eq('household_id', householdId)
    save(`kalender-${stamp}.ics`, toIcs(data || [], household?.name), 'text/calendar')
  }
  return (
    <div className="card stack">
      <h3>Exportera</h3>
      <p className="muted small">Ladda ner en kopia av allt ni har lagt in, eller kalendern som .ics-fil som går att öppna i Kalender på iPhone.</p>
      <div className="row wrap">
        <button onClick={json} disabled={busy}>{busy ? 'Hämtar…' : 'All data (.json)'}</button>
        <button onClick={ics}>Kalendern (.ics)</button>
      </div>
    </div>
  )
}

const icsDate = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const icsDay = (v) => localDay(new Date(v)).replace(/-/g, '')
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')
export function toIcs(events, name = 'Familjen') {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hemappen//SV', `X-WR-CALNAME:${esc(name)}`]
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.id}@hemappen`, `DTSTAMP:${icsDate(e.created_at || new Date().toISOString())}`, `SUMMARY:${esc(e.title)}`)
    if (e.all_day) {
      lines.push(`DTSTART;VALUE=DATE:${icsDay(e.starts_at)}`)
      const end = new Date(e.ends_at || e.starts_at); if (!e.ends_at || icsDay(e.ends_at) === icsDay(e.starts_at)) end.setDate(end.getDate() + 1)
      lines.push(`DTEND;VALUE=DATE:${icsDay(end)}`)
    } else {
      lines.push(`DTSTART:${icsDate(e.starts_at)}`)
      if (e.ends_at) lines.push(`DTEND:${icsDate(e.ends_at)}`)
    }
    if (e.rrule) lines.push(e.rrule.startsWith('RRULE:') ? e.rrule : `RRULE:${e.rrule}`)
    for (const x of e.exdates || []) lines.push(`EXDATE:${icsDate(x)}`)
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
