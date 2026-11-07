import { MemberTag } from './MemberPicker'
import { useState } from 'react'
import { today, addDays, prettyDay, parseDay, iso } from '../lib/dates'
import { withUs, nextHandover, isHandover, moveHandover } from '../lib/custody'
import Icon from './Icon'
import Sheet from './Sheet'
import { useTable } from '../useTable'

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
  const items = useTable('packing_items', me.household_id)
  const [packFor, setPackFor] = useState(null)
  const [moving, setMoving] = useState(null)
  if (!custody?.length) return null
  const packFc = packFor && custody.find((c) => c.child_id === packFor.id)
  return (
    <div className={`custody-line ${big ? 'big' : ''}`}>
      {packFor && packFc && (
        <Sheet title={`Packlista för ${packFor.name}`} onClose={() => setPackFor(null)}>
          <PackingList child={packFor} custody={packFc} me={me} linked={linked} items={items} />
        </Sheet>
      )}
      {moving && <MoveHandover c={moving.c} kid={moving.kid} me={me} linked={linked} onClose={() => setMoving(null)} />}
      {custody.map((c) => {
        const kid = members.find((m) => m.id === c.child_id)
        if (!kid) return null
        const s = custodyStatus(c, me, linked)
        return (
          <div key={c.id} className="row custody-item">
            <MemberTag member={kid} size={big ? 34 : 26} />
            <span className="grow"><strong>{kid.name}</strong> är {s.here ? 'hos oss' : `hos ${s.other}`}
              <button className="link-inline muted" onClick={() => setMoving({ c, kid })} aria-label="Flytta bytet"> · {s.nextHere ? 'kommer' : 'åker'} {dayWord(s.next.date)} kl {s.next.time} ✎</button></span>
            <PackChip kid={kid} c={c} me={me} linked={linked} items={items} onClick={() => setPackFor(kid)} />
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
export function CustodyEditor({ child, custody, table, me, linked, excTable }) {
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
      {c && !open && excTable && <Holidays c={c} me={me} linked={linked} excTable={excTable} kid={child} />}
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

// Nästa gång barnet åker från oss (packlistan gäller det bytet)
export function nextLeave(c, me, linked) {
  const s = custodyStatus(c, me, linked)
  return s.here ? s.next.date : addDays(s.next.date, c.every_days || 7)
}

const PACK_SUGGESTIONS = ['Kläder', 'Underkläder & strumpor', 'Pyjamas', 'Tandborste', 'Mediciner', 'Laddare', 'Skolväska & böcker', 'Gympapåse', 'Gosedjur', 'Surfplatta', 'Jacka & mössa', 'Läxor', 'Fritidsgrejer']

// Packlista inför bytet. En sak räknas som packad om den är bockad inför just nästa byte.
export function PackingList({ child, custody, me, linked, items }) {
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const leave = nextLeave(custody, me, linked)
  const mine = (i) => i.household_id === me.household_id
  const list = items.rows.filter((i) => i.child_id === child.id && mine(i)).sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at))
  // Det som det andra hemmet packade med inför senaste bytet hit
  const arrived = lastArrival(custody, me)
  const fromOther = arrived ? items.rows.filter((i) => i.child_id === child.id && !mine(i) && i.packed_for === arrived) : []
  const other = custodyStatus(custody, me, linked).other
  const packed = list.filter((i) => i.packed_for === leave).length
  const add = (title) => {
    const t = title.trim()
    if (!t || list.some((i) => i.title.toLowerCase() === t.toLowerCase())) return
    items.insert({ child_id: child.id, title: t, sort: list.length })
  }
  const toggle = (i) => items.update(i.id, { packed_for: i.packed_for === leave ? null : leave })
  const suggestions = PACK_SUGGESTIONS.filter((s) => !list.some((i) => i.title.toLowerCase() === s.toLowerCase()))
  return (
    <div className="stack">
      <p className="muted small">Inför bytet {prettyDay(leave)} kl {String(custody.handover_time).slice(0, 5)} · {packed} av {list.length} packade. Bockarna nollställs av sig själva till nästa byte.</p>
      <ul className="list">
        {list.map((i) => (
          <li key={i.id} className={i.packed_for === leave ? 'is-done' : ''}>
            <label className="check grow"><input type="checkbox" checked={i.packed_for === leave} onChange={() => toggle(i)} /> <span>{i.title}</span></label>
            {editing && <button className="icon-btn" onClick={() => items.remove(i.id)} aria-label={`Ta bort ${i.title}`}>✕</button>}
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="muted">Inga saker än. Välj bland förslagen eller skriv egna.</p>}
      {fromOther.length > 0 && (
        <>
          <h4 className="day">Kom med från {other} {prettyDay(arrived)}</h4>
          <p className="muted small">Bocka i det ni skickar tillbaka, så ser {other} det.</p>
          <ul className="list">
            {fromOther.map((i) => (
              <li key={i.id} className={i.returned_for === leave ? 'is-done' : ''}>
                <label className="check grow"><input type="checkbox" checked={i.returned_for === leave} onChange={() => items.update(i.id, { returned_for: i.returned_for === leave ? null : leave })} /> <span>{i.title}</span></label>
              </li>
            ))}
          </ul>
        </>
      )}
      {list.some((i) => i.returned_for && i.packed_for && i.returned_for > i.packed_for) && (
        <p className="small">↩︎ Kom tillbaka från {other}: {list.filter((i) => i.returned_for && i.packed_for && i.returned_for > i.packed_for).map((i) => i.title).join(', ')}</p>
      )}
      <form className="row" onSubmit={(e) => { e.preventDefault(); add(text); setText('') }}>
        <input placeholder="Lägg till sak" value={text} onChange={(e) => setText(e.target.value)} />
        <button disabled={!text.trim()}>Lägg till</button>
      </form>
      {suggestions.length > 0 && <div className="chips">{suggestions.map((s) => <button key={s} className="chip" onClick={() => add(s)}>+ {s}</button>)}</div>}
      {list.length > 0 && <button className="link" onClick={() => setEditing(!editing)}>{editing ? 'Klar' : 'Ta bort saker'}</button>}
    </div>
  )
}

function PackChip({ kid, c, me, linked, items, onClick }) {
  const leave = nextLeave(c, me, linked)
  const list = items.rows.filter((i) => i.child_id === kid.id && i.household_id === me.household_id)
  const left = list.filter((i) => i.packed_for !== leave).length
  const soon = daysBetween(today(), leave) <= 2
  return (
    <button className={`chip pack-chip ${soon && left ? 'warn' : ''}`} onClick={onClick}>
      🎒 {list.length ? (left ? `${left} kvar` : 'Packat') : 'Packlista'}
    </button>
  )
}
const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000)

// Senaste dagen barnet kom till oss (för att visa vad som packades med därifrån)
export function lastArrival(c, me) {
  const t = today()
  for (let i = 0; i < 60; i++) {
    const d = addDays(t, -i)
    if (isHandover(c, d) && withUs(c, me.household_id, d, '23:59')) return d
  }
  return null
}

// Lov och semester: perioder då schemat inte följer varannan vecka
function Holidays({ c, me, linked, excTable, kid }) {
  const [form, setForm] = useState(null)
  const [moving, setMoving] = useState(false)
  const mine = c.household_id === me.household_id
  const other = otherName(c, me, linked)
  const list = (c.exceptions || []).filter((x) => x.to_date >= today()).sort((a, b) => a.from_date.localeCompare(b.from_date))
  const save = async () => {
    if (!form.from || !form.to || form.to < form.from) return alert('Välj ett slutdatum efter startdatumet')
    await excTable.insert({ custody_id: c.id, from_date: form.from, to_date: form.to, with_anchor: mine ? form.here : !form.here, note: form.note || null })
    setForm(null)
  }
  const hereIn = (x) => (mine ? x.with_anchor : !x.with_anchor)
  return (
    <div className="holidays">
      {list.map((x) => (
        <div key={x.id} className="row between small">
          <span>{x.from_time ? `🔁 ${x.note || 'Flyttat byte'}: ${prettyDay(x.from_date)} kl ${x.from_time} – ${prettyDay(x.to_date)} kl ${x.to_time} ${hereIn(x) ? 'hos er' : `hos ${other}`}`
            : <>🏖️ {prettyDay(x.from_date)}–{prettyDay(x.to_date)}: {hereIn(x) ? 'hos er' : `hos ${other}`}{x.note ? ` · ${x.note}` : ''}</>}</span>
          <button className="icon-btn" onClick={() => confirm('Ta bort perioden?') && excTable.remove(x.id)} aria-label="Ta bort perioden">✕</button>
        </div>
      ))}
      {!form && !moving && <button className="link small" onClick={() => setMoving(true)}>🔁 Flytta nästa byte en gång</button>}
      {moving && <MoveHandover c={c} kid={kid} me={me} linked={linked} onClose={() => setMoving(false)} />}
      {!form && <button className="link small" onClick={() => setForm({ from: '', to: '', here: true, note: '' })}>+ Lov eller semester som avviker</button>}
      {form && (
        <div className="stack card-inset">
          <input placeholder="Vad (t.ex. Jullov, Sommar vecka 1)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <div className="row">
            <label className="field"><span className="muted small">Från (kl {String(c.handover_time).slice(0, 5)})</span><input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></label>
            <label className="field"><span className="muted small">Till (kl {String(c.handover_time).slice(0, 5)})</span><input type="date" value={form.to} min={form.from} onChange={(e) => setForm({ ...form, to: e.target.value })} /></label>
          </div>
          <div className="seg">
            <button type="button" className={form.here ? 'active' : ''} onClick={() => setForm({ ...form, here: true })}>{kid.name} hos er</button>
            <button type="button" className={!form.here ? 'active' : ''} onClick={() => setForm({ ...form, here: false })}>Hos {other}</button>
          </div>
          <div className="row"><button className="primary" onClick={save}>Spara</button><button onClick={() => setForm(null)}>Avbryt</button></div>
        </div>
      )}
    </div>
  )
}

// Flytta nästa byte en gång, t.ex. lämna på lördag i stället för söndag. Sparas som en kort avvikelse med klockslag.
export function MoveHandover({ c, kid, me, linked, onClose }) {
  const exc = useTable('custody_exceptions', me.household_id, 'from_date')
  const next = nextHandover(c, today(), nowHM())
  const toUs = withUs(c, me.household_id, next.date, '23:59')
  const other = otherName(c, me, linked)
  const [date, setDate] = useState(today())
  const [time, setTime] = useState(() => { const d = new Date(); d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0); return d.toTimeString().slice(0, 5) })
  const same = date === next.date && time === next.time
  const save = async () => {
    if (same) return onClose()
    const x = moveHandover(c, next, { date, time })
    await exc.insert({ custody_id: c.id, ...x, note: 'Flyttat byte' })
    onClose()
  }
  const what = toUs ? `${kid.name} kommer till er` : `${kid.name} åker till ${other}`
  return (
    <Sheet title="Flytta bytet en gång" onClose={onClose}>
      <p>Vanligtvis: {what} <strong>{dayWord(next.date)} kl {next.time}</strong>.</p>
      <p className="muted small">Välj när bytet blir den här gången. Schemat fortsätter som vanligt efteråt, och det andra hemmet ser ändringen.</p>
      <div className="chips">
        {[-1, 0, 1].map((n) => { const d = addDays(next.date, n); return d >= today() && <button key={n} type="button" className={`chip ${date === d ? 'active' : ''}`} onClick={() => setDate(d)}>{dayWord(d)}</button> })}
      </div>
      <div className="row mt">
        <label className="field"><span className="muted small">Dag</span><input type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field"><span className="muted small">Klockan</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>
      <button className="primary wide mt" onClick={save} disabled={!date || !time}>{same ? 'Stäng' : `Flytta till ${dayWord(date)} kl ${time}`}</button>
    </Sheet>
  )
}
