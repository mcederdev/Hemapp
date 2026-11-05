import { useState } from 'react'
import { today, addDays, prettyDay, parseDay, iso } from '../lib/dates'
import { withUs, nextHandover, isHandover } from '../lib/custody'
import Icon from './Icon'

const nowHM = () => new Date().toTimeString().slice(0, 5)

// Namnet på "det andra stället" sett från mitt hushåll
export function otherName(c, me, linked) {
  if (c.household_id !== me.household_id) return linked?.households.find((h) => h.household_id === c.household_id)?.name || c.other_label
  return linked?.households.find((h) => h.link_id === c.link_id)?.name || c.other_label
}

// Var är barnet nu, och när är nästa byte?
export function custodyStatus(c, me, linked, date = today(), time = nowHM()) {
  const here = withUs(c, me.household_id, date, time)
  const next = nextHandover(c, date, time)
  const nextHere = withUs(c, me.household_id, next.date, '23:59')
  return { here, other: otherName(c, me, linked), next, nextHere }
}

const dayWord = (d) => { const t = today(); return d === t ? 'idag' : d === addDays(t, 1) ? 'imorgon' : prettyDay(d) }

// En rad på Idag och köksskärmen: "Juhani är hos oss · byte sön kl 18"
export function CustodyLine({ custody, members, me, linked, big = false }) {
  if (!custody?.length) return null
  return (
    <div className={`custody-line ${big ? 'big' : ''}`}>
      {custody.map((c) => {
        const kid = members.find((m) => m.id === c.child_id)
        if (!kid) return null
        const s = custodyStatus(c, me, linked)
        return (
          <div key={c.id} className="row custody-item">
            <span className="avatar" style={{ background: kid.color, width: big ? 34 : 26, height: big ? 34 : 26 }}>{kid.short || kid.name[0]}</span>
            <span><strong>{kid.name}</strong> är {s.here ? 'hos oss' : `hos ${s.other}`}
              <span className="muted"> · {s.nextHere ? 'kommer' : 'åker'} {dayWord(s.next.date)} kl {s.next.time}</span></span>
          </div>
        )
      })}
    </div>
  )
}

// Liten markering i kalendern: vilka dagar barnet är hos oss och när det är byte
export function custodyForDay(custody, me, date) {
  return (custody || []).map((c) => ({ c, here: withUs(c, me.household_id, date, '12:00'), swap: isHandover(c, date) }))
}

// Inställning per barn i Familj-sidan
export function CustodyEditor({ child, custody, table, me, linked }) {
  const c = custody.find((x) => x.child_id === child.id)
  const [open, setOpen] = useState(false)
  const t = today()
  // Förslag: nästa söndag
  const sunday = (() => { const d = parseDay(t); d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); return iso(d) })()
  const [form, setForm] = useState(null)
  const start = () => {
    setForm(c ? { arrive: nextArrival(c, me), every: c.every_days, time: String(c.handover_time).slice(0, 5), other: c.other_label }
      : { arrive: sunday, every: 7, time: '18:00', other: 'andra föräldern' })
    setOpen(true)
  }
  const save = async () => {
    const mine = !c || c.household_id === me.household_id
    // Datumet är en dag då barnet kommer till oss. Är schemat det andra hushållets räknar vi om till deras ankare.
    const anchor = mine ? form.arrive : addDays(form.arrive, Number(form.every))
    const v = { anchor, every_days: Number(form.every) || 7, handover_time: form.time || '18:00', other_label: form.other || 'andra föräldern', notified_for: null, notified_by: {} }
    if (c) await table.update(c.id, v)
    else {
      const link = linked.households[0]?.link_id || null
      await table.insert({ ...v, child_id: child.id, link_id: link })
    }
    setOpen(false)
  }
  const s = c && custodyStatus(c, me, linked)
  return (
    <div className="custody-edit">
      {!open && (
        <button className="link small" onClick={start}>
          <Icon name="repeat" size={14} /> {c ? `Växelvis: ${s.here ? 'hos oss' : `hos ${s.other}`}, byte ${prettyDay(s.next.date)} kl ${s.next.time}` : 'Ställ in växelvis boende'}
        </button>
      )}
      {open && form && (
        <div className="stack">
          <label className="field"><span className="muted small">En dag {child.name} kommer till er</span>
            <input type="date" value={form.arrive} onChange={(e) => setForm({ ...form, arrive: e.target.value })} /></label>
          <div className="row">
            <label className="field"><span className="muted small">Byte</span>
              <select value={form.every} onChange={(e) => setForm({ ...form, every: e.target.value })}>
                <option value={7}>Varannan vecka</option><option value={14}>Varannan 14-dagars</option><option value={3}>Var 3:e dag</option><option value={2}>Varannan dag</option>
              </select></label>
            <label className="field"><span className="muted small">Klockan</span><input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
          </div>
          {!linked.households.length && <input placeholder="Andra hemmet heter (t.ex. pappa)" value={form.other} onChange={(e) => setForm({ ...form, other: e.target.value })} />}
          <div className="row">
            <button className="primary" onClick={save}>Spara</button>
            <button onClick={() => setOpen(false)}>Avbryt</button>
            {c && <button className="danger" onClick={() => { if (confirm('Ta bort schemat?')) { table.remove(c.id); setOpen(false) } }}>Ta bort</button>}
          </div>
        </div>
      )}
    </div>
  )
}

// Nästa dag barnet kommer till oss (för att fylla i formuläret)
function nextArrival(c, me) {
  let n = nextHandover(c, today(), '00:00')
  if (withUs(c, me.household_id, n.date, '23:59')) return n.date
  return addDays(n.date, c.every_days || 7)
}
