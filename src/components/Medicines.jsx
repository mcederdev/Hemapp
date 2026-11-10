import { useState } from 'react'
import { useTable } from '../useTable'
import { today, prettyDay } from '../lib/dates'
import { medicineStatus, custodyOf, UNITS, unitText, packName } from '../lib/medicine'
import { MemberTag } from './MemberPicker'
import Sheet, { Fab } from './Sheet'

const blank = (memberId) => ({ name: '', member_id: memberId, unit: 'ml', full_size: 100, dose: 5, doses_per_day: 1, remind_days: 5, opened_on: today(), note: '', spare: 0, times: [{ amount: 1, time: '08:00' }] })
const timesOf = (m) => (m.times || []).filter((x) => x.time && Number(String(x.amount).replace(',', '.')) > 0).sort((a, b) => a.time.localeCompare(b.time))

// Medicin: flaskans storlek och dosen ger hur länge den räcker. "Ny flaska" nollställer.
// Varje hushåll har sin egen uppsättning. Med delad vårdnad räknas den bara ner när barnet är hos er,
// och andra hushållets mediciner syns bara (de kan inte ändras härifrån).
export default function Medicines({ householdId, members, custody, linked }) {
  const meds = useTable('medicines', householdId)
  const [edit, setEdit] = useState(null)
  const t = today()
  const byId = Object.fromEntries(members.map((m) => [m.id, m]))
  const kidsFirst = [...members].sort((a, b) => Number(b.role === 'child') - Number(a.role === 'child'))
  const status = (m) => medicineStatus(m, t, custodyOf(custody, m.member_id))
  const otherHome = (m) => linked?.households?.find((h) => h.household_id === m.household_id)?.name || 'andra hushållet'
  // Gör en egen kopia av andra hushållets medicin: samma namn och tider, egen flaska
  const copy = (m) => setEdit({ ...blank(m.member_id), name: m.name, unit: m.unit, full_size: m.full_size || m.bottle_size, times: m.times?.length ? m.times : [{ amount: m.dose, time: '08:00' }], remind_days: m.remind_days, note: m.note || '' })

  const save = async (e) => {
    e.preventDefault()
    if (!edit.name.trim()) return
    const full = Number(String(edit.full_size).replace(',', '.')) || 0
    const num = (x) => Number(String(x ?? '').replace(',', '.')) || 0
    const v = { name: edit.name.trim(), member_id: edit.member_id, unit: edit.unit, full_size: full, dose: num(edit.dose),
      doses_per_day: num(edit.doses_per_day), remind_days: Number(edit.remind_days) || 0, note: edit.note || null }
    // Tider: dygnsdosen blir summan av alla tider (så räknas flaskan som förut)
    const times = timesOf({ times: (edit.times || []).map((x) => ({ time: x.time, amount: num(x.amount) })) })
    if (!times.length) return alert('Skriv in minst en tid och mängd.')
    const others = (edit.hide_today || []).filter((h) => h !== householdId)
    v.hide_today = edit.showToday === false ? [...others, householdId] : others
    Object.assign(v, { times, dose: times.reduce((a, x) => a + x.amount, 0), doses_per_day: 1 })
    if (edit.id) await meds.update(edit.id, v)
    else await meds.insert({ ...v, bottle_size: full, opened_on: edit.opened_on || t, spare: Number(edit.spare) || 0 })
    setEdit(null)
  }
  const setTime = (i, patch) => setEdit({ ...edit, times: edit.times.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  const newBottle = (m) => confirm(`Öppna en ny ${packName(m.unit)} ${m.name} (${fmtN(m.full_size || m.bottle_size)} ${unitText(m.unit, m.full_size || m.bottle_size)})?${m.spare > 0 ? ' Den tas från de ni har hemma.' : ''}`) &&
    meds.update(m.id, { bottle_size: m.full_size || m.bottle_size, opened_on: t, spare: Math.max(0, (m.spare || 0) - 1), notified_for: null, notified_by: {} })
  const adjust = (m) => {
    const v = prompt(m.unit === 'doser' ? 'Hur många doser finns kvar nu?' : `Hur mycket finns kvar i ${m.unit === 'st' ? 'asken' : 'flaskan'} nu (${m.unit})?`, String(status(m).left))
    if (v === null) return
    const n = Number(v.replace(',', '.'))
    if (Number.isFinite(n)) meds.update(m.id, { bottle_size: n, opened_on: t, notified_for: null, notified_by: {} })
  }

  return (
    <section>
      <h2>Medicin</h2>
      {meds.rows.length === 0 && <p className="muted">Lägg till en medicin med +. Appen räknar ut när flaskan tar slut och påminner i tid.</p>}
      {[...kidsFirst, null].map((person) => {
        const all = meds.rows.filter((m) => person ? m.member_id === person.id : !byId[m.member_id])
        const list = all.filter((m) => m.household_id === householdId)
        const theirs = all.filter((m) => m.household_id !== householdId)
        if (!all.length) return null
        return (
          <div key={person?.id || 'x'} className="med-group">
            <div className="row med-person">
              {person ? <MemberTag member={person} size={34} /> : <span className="big-emoji">👤</span>}
              <strong className="grow">{person?.name || 'Övriga'}</strong>
              {person && <button className="link small" onClick={() => setEdit(blank(person.id))}>+ Lägg till</button>}
            </div>
      <ul className="list">
        {list.map((m) => {
          const s = status(m)
          const spare = m.spare || 0
          const low = spare === 0 && s.daysLeft <= m.remind_days
          return (
            <li key={m.id} className="col med">
              <div className="row between w100">
                <span className="row tap grow" onClick={() => setEdit({ ...m, full_size: m.full_size || m.bottle_size, times: m.times?.length ? m.times : [{ amount: m.dose, time: '08:00' }], showToday: !(m.hide_today || []).includes(householdId) })}>
                  <span className="big-emoji">{m.unit === 'doser' ? '💨' : '💊'}</span>
                  <span><strong>{m.name}</strong>
                    <div className="muted small">{timesOf(m).length ? timesOf(m).map((x) => `${fmtN(x.amount)} ${unitText(m.unit, x.amount)} kl ${x.time}`).join(' · ') : `${fmtN(m.dose)} ${unitText(m.unit, m.dose)} × ${fmtN(m.doses_per_day)} om dagen`}{m.note ? ` · ${m.note}` : ''}{(m.hide_today || []).includes(householdId) ? ' · visas inte på Idag' : ''}</div></span>
                </span>
                <span className="med-spare" title={`${spare} ${m.unit === 'st' ? 'askar' : m.unit === 'doser' ? 'förpackningar' : 'flaskor'} hemma`}>
                  <button className="icon-btn" disabled={spare === 0} onClick={() => meds.update(m.id, { spare: spare - 1 })} aria-label="En mindre hemma">−</button>
                  <span className="spare-n"><Pack unit={m.unit} />{spare}</span>
                  <button className="icon-btn" onClick={() => meds.update(m.id, { spare: spare + 1, notified_for: null, notified_by: {} })} aria-label="En till hemma">+</button>
                </span>
              </div>
              <div className="med-bar"><i style={{ width: `${Math.round(s.share * 100)}%`, background: low ? 'var(--danger)' : 'var(--accent)' }} /></div>
              <div className="row between w100">
                <span className={`small ${low ? 'error' : 'muted'}`}>
                  {s.left <= 0 ? 'Slut!' : `Kvar ${m.unit === 'ml' ? 'ca ' : ''}${fmtN(s.left)} ${unitText(m.unit, s.left)} · räcker ${s.daysLeft === 0 ? 'idag ut' : `${s.daysLeft} dagar till`}`}
                  {s.runsOut && s.left > 0 && ` (${prettyDay(s.runsOut)})`}
                </span>
                <span className="row">
                  <button className="chip" onClick={() => adjust(m)}>Justera</button>
                  <button className="chip on" onClick={() => newBottle(m)}>{m.unit === 'st' ? 'Ny ask' : m.unit === 'doser' ? 'Ny förpackning' : 'Ny flaska'}</button>
                </span>
              </div>
            </li>
          )
        })}
      </ul>
      {theirs.length > 0 && (
        <ul className="list med-theirs">
          {theirs.map((m) => {
            const s = status(m)
            const mine = list.some((x) => x.name.trim().toLowerCase() === m.name.trim().toLowerCase())
            return (
              <li key={m.id} className="row between">
                <span className="grow"><span className="muted small">Hos {otherHome(m)}:</span> <strong>{m.name}</strong>
                  <div className="muted small">{s.left <= 0 ? 'Slut' : `Kvar ${m.unit === 'ml' ? 'ca ' : ''}${fmtN(s.left)} ${unitText(m.unit, s.left)} · räcker ${s.daysLeft === 0 ? 'idag ut' : Number.isFinite(s.daysLeft) ? `${s.daysLeft} dagar till` : 'länge'}`}{m.spare > 0 ? ` · ${m.spare} oöppnade` : ''}</div></span>
                {!mine && <button className="chip" onClick={() => copy(m)}>Lägg till hos oss</button>}
              </li>
            )
          })}
        </ul>
      )}
          </div>
        )
      })}
      <p className="muted small mt">Tryck + när ni hämtat ut fler flaskor. Ni får bara en notis när det inte finns någon mer hemma och det är så många dagar kvar som ni valt. Med delad vårdnad har varje hem sin egen medicin: den räknas bara ner de dagar barnet är hos er, och ni ser hur mycket andra hushållet har kvar.</p>
      <Fab onClick={() => setEdit(blank(members.find((m) => m.role === 'child')?.id || members[0]?.id))} label="Ny medicin" />
      {edit && (
        <Sheet title={edit.id ? edit.name : 'Ny medicin'} onClose={() => setEdit(null)}>
          <form className="stack" onSubmit={save}>
            <input placeholder="Namn (t.ex. Concerta, Desloratadin, Nasonex)" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus={!edit.id} />
            <label className="field"><span className="muted small">Till</span>
              <select value={edit.member_id} onChange={(e) => setEdit({ ...edit, member_id: e.target.value })}>
                {kidsFirst.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select></label>
            <span className="muted small">Typ</span>
            <div className="row wrap">
              {UNITS.map((u) => (
                <button key={u.v} type="button" className={`chip ${edit.unit === u.v ? 'on' : ''}`} onClick={() => setEdit({ ...edit, unit: u.v })}>
                  {u.label} <span className="small">{u.hint}</span>
                </button>
              ))}
            </div>
            <label className="field"><span className="muted small">{edit.unit === 'doser' ? 'Antal doser i en förpackning (står på förpackningen)' : edit.unit === 'st' ? 'Antal tabletter i en ask' : 'Flaskans storlek (ml)'}</span>
              <input inputMode="decimal" value={edit.full_size} onChange={(e) => setEdit({ ...edit, full_size: e.target.value })} /></label>
            {edit.unit === 'doser' && <p className="muted small">En spray eller ett puff är en dos. Nässpray i båda näsborrarna = 2 doser.</p>}
            <span className="muted small">När och hur mycket</span>
            {(edit.times || []).map((x, i) => (
              <div key={i} className="row med-time">
                <input inputMode="decimal" value={x.amount} aria-label="Mängd" onChange={(e) => setTime(i, { amount: e.target.value })} />
                <span className="muted">{edit.unit === 'doser' ? (Number(String(x.amount).replace(',', '.')) === 1 ? 'dos' : 'doser') : edit.unit} kl</span>
                <input type="time" value={x.time} aria-label="Tid" onChange={(e) => setTime(i, { time: e.target.value })} />
                {edit.times.length > 1 && <button type="button" className="icon-btn" onClick={() => setEdit({ ...edit, times: edit.times.filter((_, j) => j !== i) })} aria-label="Ta bort tiden">✕</button>}
              </div>
            ))}
            <button type="button" className="link small" onClick={() => setEdit({ ...edit, times: [...(edit.times || []), { amount: edit.times?.[0]?.amount || 1, time: '20:00' }] })}>+ Lägg till en tid</button>
            <label className="row"><input type="checkbox" checked={edit.showToday !== false} onChange={(e) => setEdit({ ...edit, showToday: e.target.checked })} /> Visa på Idag och bocka av där</label>
            {edit.showToday !== false && <p className="muted small">Varje tid syns på Idag. Den som bockar av syns för alla och resten av familjen får en notis.</p>}
            {!edit.id && <label className="field"><span className="muted small">Oöppnade hemma</span><input inputMode="numeric" value={edit.spare} onChange={(e) => setEdit({ ...edit, spare: e.target.value })} /></label>}
            {!edit.id && <label className="field"><span className="muted small">{edit.unit === 'st' ? 'Asken' : edit.unit === 'doser' ? 'Förpackningen' : 'Flaskan'} öppnades</span><input type="date" value={edit.opened_on} max={today()} onChange={(e) => setEdit({ ...edit, opened_on: e.target.value })} /></label>}
            <label className="field"><span className="muted small">Påminn</span>
              <select value={edit.remind_days} onChange={(e) => setEdit({ ...edit, remind_days: e.target.value })}>
                {[2, 3, 5, 7, 10, 14].map((d) => <option key={d} value={d}>{d} dagar innan den tar slut</option>)}
              </select></label>
            <input placeholder="Anteckning (t.ex. tas med frukost, recept hos BVC)" value={edit.note || ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
            <button className="primary">Spara</button>
            {edit.id && <button type="button" className="danger" onClick={() => { if (confirm(`Ta bort ${edit.name}?`)) { meds.remove(edit.id); setEdit(null) } }}>Ta bort</button>}
          </form>
        </Sheet>
      )}
    </section>
  )
}

const fmtN = (n) => String(Math.round(Number(n) * 10) / 10).replace('.', ',')

// Medicin som snart tar slut, för "Snart" på Idag och köksskärmen
export function lowMedicines(rows, t = today()) {
  return rows.map((m) => ({ m, s: medicineStatus(m, t) })).filter(({ m, s }) => !(m.spare > 0) && s.daysLeft <= m.remind_days)
}

// Flaska för ml, sprayflaska för doser, ask för tabletter
function Pack({ unit }) {
  if (unit === 'doser') return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M11 2h2v5h-2zM9 7h6v3H9zM7 10h10v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" /></svg>
  return unit === 'st'
    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M3 11h18M8 7V5h8v2" /><circle cx="8" cy="15" r="1" fill="currentColor" /><circle cx="12" cy="15" r="1" fill="currentColor" /><circle cx="16" cy="15" r="1" fill="currentColor" /></svg>
    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M9 2h6v3H9zM8 5h8l1 3v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8z" /><path d="M7 12h10" /></svg>
}
