import { useState } from 'react'
import { supabase } from '../supabase'
import { useTable } from '../useTable'
import { today, prettyDay } from '../lib/dates'
import { CAR_REMINDERS } from '../lib/yearly'
import { swishUrl } from '../lib/swish'
import { carBalance, CAR_KINDS, kindOf, carPlan, taxMonths, inspectionDue } from '../lib/car'
import { custodyStatus } from './Custody'
import { YearlyList } from './Reminders'
import Sheet, { Fab } from './Sheet'
import Icon from './Icon'
import CarTodo from './CarTodo'

const kr = (n) => `${Math.round(n).toLocaleString('sv-SE')} kr`

// Bilen: kostnader, vem som betalat, delning mellan hushållen och bilens påminnelser
export default function Car({ householdId, me, members, people, linked, custody }) {
  const cars = useTable('cars', householdId)
  const chores = useTable('chores', householdId)
  const [carId, setCarId] = useState(null)
  const [settings, setSettings] = useState(null)
  const car = cars.rows.find((c) => c.id === carId) || cars.rows[0]

  const saveCar = async (e) => {
    e.preventDefault()
    const v = { name: settings.name || 'Bilen', reg_nr: settings.reg_nr || null, owner_share: Number(settings.owner_share) || 0,
      other_label: settings.other_label || 'andra hushållet', follows_child: settings.follows_child || null,
      model: settings.model || null, model_year: Number(settings.model_year) || null, fuel: settings.fuel || null,
      tax_per_year: Number(String(settings.tax_per_year || '').replace(/\s/g, '')) || null, in_traffic: settings.in_traffic || null, last_inspection: settings.last_inspection || null }
    let saved = null
    // Kopplades hushållen ihop efter att bilen lades in: dela bilen nu
    if (settings.id && !settings.link_id && linked.households[0]) v.link_id = linked.households[0].link_id
    if (settings.id) { await cars.update(settings.id, v); saved = { ...settings, ...v } }
    else {
      const link = linked.households[0]?.link_id || null
      const [created] = (await cars.insert({ ...v, link_id: link })) || []
      saved = created
      // Flytta bilpåminnelser som redan ligger bland årliga saker hit
      if (created) {
        const titles = CAR_REMINDERS.map((r) => r.title)
        await supabase.from('reminders').update({ car_id: created.id }).eq('household_id', householdId).is('car_id', null).in('title', titles)
        setCarId(created.id)
      }
    }
    // Planera automatiskt: lägg in besiktning, skatt och däckbyten som saknas under Att göra
    if (saved) { const add = carPlan(saved, chores.rows, today()); if (add.length) await chores.insert(add) }
    setSettings(null)
  }
  const newCar = () => setSettings({ name: 'Bilen', reg_nr: '', owner_share: 50, other_label: 'andra hushållet', follows_child: members.find((m) => m.role === 'child')?.id || '' })

  return (
    <section>
      <div className="row between">
        <h2>{car ? car.name : 'Bilen'}</h2>
        {car && <button className="sq" onClick={() => setSettings({ ...car, follows_child: car.follows_child || '' })} aria-label="Inställningar för bilen">⚙︎</button>}
      </div>
      {cars.rows.length > 1 && (
        <div className="seg mb">{cars.rows.map((c) => <button key={c.id} className={c.id === car.id ? 'active' : ''} onClick={() => setCarId(c.id)}>{c.name}</button>)}</div>
      )}
      {!car && !cars.loading && (
        <div className="card stack">
          <p>Här samlar ni bilens kostnader och vem som har betalat. Försäkring, skatt, parkering och service delas mellan hushållen, bensin betalar var och en själv.</p>
          <p className="muted small">Har ni delad vårdnad och har kopplat ihop hushållen (Familj → Delad vårdnad) ser ni båda samma bil.</p>
          <button className="primary" onClick={newCar}>Lägg till bilen</button>
        </div>
      )}
      {car && <CarBody key={car.id} cars={cars} car={car} me={me} members={members} people={people} linked={linked} custody={custody} householdId={householdId} />}
      {settings && (
        <Sheet title={settings.id ? 'Bilen' : 'Lägg till bil'} onClose={() => setSettings(null)}>
          <form className="stack" onSubmit={saveCar}>
            <div className="row">
              <input placeholder="Namn (t.ex. Volvon)" value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} />
              <input placeholder="Reg.nr" value={settings.reg_nr || ''} onChange={(e) => setSettings({ ...settings, reg_nr: e.target.value.toUpperCase() })} style={{ maxWidth: 110 }} />
            </div>
            {settings.reg_nr && <a className="button" href={`https://biluppgifter.se/fordon/${settings.reg_nr.replace(/\s/g, '')}`} target="_blank" rel="noreferrer">🔎 Slå upp {settings.reg_nr} på biluppgifter.se</a>}
            <p className="muted small">Fyll i från biluppgifter (eller registreringsbeviset). Då planerar appen besiktning, skatt och däckbyten under Att göra.</p>
            <div className="row">
              <input placeholder="Modell (t.ex. Volvo V60)" value={settings.model || ''} onChange={(e) => setSettings({ ...settings, model: e.target.value })} />
              <input placeholder="Årsmodell" inputMode="numeric" value={settings.model_year || ''} onChange={(e) => setSettings({ ...settings, model_year: e.target.value.replace(/\D/g, '').slice(0, 4) })} style={{ maxWidth: 100 }} />
            </div>
            <div className="row">
              <select value={settings.fuel || ''} onChange={(e) => setSettings({ ...settings, fuel: e.target.value })}>
                <option value="">Drivmedel</option>
                {['Bensin', 'Diesel', 'El', 'Laddhybrid', 'Elhybrid', 'Etanol', 'Gas'].map((f) => <option key={f}>{f}</option>)}
              </select>
              <input placeholder="Skatt kr/år" inputMode="numeric" value={settings.tax_per_year || ''} onChange={(e) => setSettings({ ...settings, tax_per_year: e.target.value.replace(/[^\d]/g, '') })} style={{ maxWidth: 120 }} />
            </div>
            <div className="row">
              <label className="field"><span className="muted small">I trafik första gången</span><input type="date" value={settings.in_traffic || ''} onChange={(e) => setSettings({ ...settings, in_traffic: e.target.value })} /></label>
              <label className="field"><span className="muted small">Senast besiktigad</span><input type="date" value={settings.last_inspection || ''} onChange={(e) => setSettings({ ...settings, last_inspection: e.target.value })} /></label>
            </div>
            <label className="field"><span className="muted small">{settings.id && settings.household_id !== householdId ? 'Ägarhushållet' : 'Ni'} betalar {settings.owner_share} % av delade kostnader</span>
              <input type="range" min={0} max={100} step={5} value={settings.owner_share} onChange={(e) => setSettings({ ...settings, owner_share: e.target.value })} /></label>
            <label className="field"><span className="muted small">Bilen följer med</span>
              <select value={settings.follows_child} onChange={(e) => setSettings({ ...settings, follows_child: e.target.value })}>
                <option value="">Ingen (står alltid hos ägaren)</option>
                {members.filter((m) => m.role === 'child').map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select></label>
            {!linked.households.length && <input placeholder="Andra hushållet heter (t.ex. Mamma)" value={settings.other_label} onChange={(e) => setSettings({ ...settings, other_label: e.target.value })} />}
            <button className="primary">Spara</button>
            {settings.id && <button type="button" className="danger" onClick={() => { if (confirm(`Ta bort ${settings.name} och alla kostnader?`)) { cars.remove(settings.id); setSettings(null) } }}>Ta bort bilen</button>}
          </form>
        </Sheet>
      )}
    </section>
  )
}

function CarBody({ cars, car, me, members, people, linked, custody, householdId }) {
  const costs = useTable('car_costs', householdId, 'day', ['car_id', car.id])
  const settlements = useTable('car_settlements', householdId, 'day', ['car_id', car.id])
  const [form, setForm] = useState(null)
  const [view, setView] = useState('costs')
  const [showAll, setShowAll] = useState(false)
  const t = today()
  const year = t.slice(0, 4)

  const isOwner = car.household_id === householdId
  const otherId = isOwner ? linked.households.find((h) => h.link_id === car.link_id)?.household_id || null : car.household_id
  const otherName = isOwner ? linked.households.find((h) => h.link_id === car.link_id)?.name || car.other_label : linked.households.find((h) => h.household_id === car.household_id)?.name || 'andra hushållet'
  const otherPhone = linked.people.find((p) => p.household_id === otherId && p.phone)?.phone
  const mineShare = isOwner ? Number(car.owner_share) : 100 - Number(car.owner_share)
  const paidByUs = (c) => (c.paid_by_household ? c.paid_by_household === householdId : !isOwner)
  // Positivt: det andra hushållet är skyldigt oss
  const balance = carBalance(car, costs.rows, settlements.rows) * (isOwner ? 1 : -1)

  const kid = members.find((m) => m.id === car.follows_child)
  const chores = useTable('chores', householdId)
  const inspectDue = inspectionDue(car)
  const taxM = taxMonths(car.reg_nr, car.tax_per_year)
  // Besiktningen är gjord: spara datumet och lägg in nästa
  const inspected = async (done) => {
    const next = { ...car, last_inspection: t }
    await cars.update(car.id, { last_inspection: t })
    const add = carPlan(next, chores.rows.filter((c) => c.id !== done.id), t).filter((x) => /^besiktiga/i.test(x.title))
    if (add.length) await chores.insert(add)
  }
  const where = (() => {
    const c = kid && (custody || []).find((x) => x.child_id === kid.id)
    if (!c) return isOwner ? 'Står hos er' : `Står hos ${otherName}`
    const s = custodyStatus(c, me, linked)
    return `${s.here ? 'Hos er' : `Hos ${s.other}`} med ${kid.name} · ${s.nextHere ? 'kommer' : 'åker'} ${prettyDay(s.next.date)} kl ${s.next.time}`
  })()

  const startCost = (kind = 'bransle') => setForm({ day: t, amount: '', kind, shared: kindOf(kind).shared, paid: 'us', note: '', odometer: '' })
  const saveCost = async (e) => {
    e.preventDefault()
    const amount = Number(String(form.amount).replace(',', '.').replace(/\s/g, ''))
    if (!amount) return
    const v = { day: form.day, amount, kind: form.kind, shared: form.shared, note: form.note || null, odometer: form.odometer ? Number(form.odometer) : null,
      paid_by_household: form.paid === 'us' ? householdId : otherId, paid_by_name: form.paid === 'us' ? me.name : null }
    if (form.id) await costs.update(form.id, v)
    else await costs.insert(v)
    setForm(null)
  }
  const settle = async () => {
    if (!confirm(balance > 0 ? `Har ${otherName} betalat ${kr(balance)} till er?` : `Har ni betalat ${kr(-balance)} till ${otherName}?`)) return
    await settlements.insert({ day: t, amount: Math.abs(balance), from_household: balance > 0 ? otherId : householdId, note: 'Reglerat' })
  }

  const list = [...costs.rows].sort((a, b) => b.day.localeCompare(a.day) || b.created_at.localeCompare(a.created_at))
  const shown = showAll ? list : list.slice(0, 15)
  const thisYear = costs.rows.filter((c) => c.day.startsWith(year))
  const byKind = CAR_KINDS.map((k) => ({ k, sum: thisYear.filter((c) => c.kind === k.id).reduce((s, c) => s + Number(c.amount), 0) })).filter((x) => x.sum > 0)
  const total = byKind.reduce((s, x) => s + x.sum, 0)
  const lastOdo = list.find((c) => c.odometer)

  return (
    <>
      <p className="muted">{car.reg_nr && <strong className="reg">{car.reg_nr}</strong>} {where}</p>
      {(car.model || car.model_year || car.fuel || inspectDue || taxM.length > 0) && (
        <p className="small car-facts">
          {[car.model, car.model_year, car.fuel].filter(Boolean).join(' · ')}
          {inspectDue && <span className={inspectDue < t ? 'error' : ''}>✅ Besiktning senast {prettyDay(inspectDue)} {inspectDue.slice(0, 4)}</span>}
          {taxM.length > 0 && <span>🏛️ Skatt i {taxM.map((m) => new Date(2000, m - 1, 1).toLocaleDateString('sv-SE', { month: 'long' })).join(', ')}{car.tax_per_year ? ` · ${kr(car.tax_per_year)}/år` : ''}</span>}
        </p>
      )}

      <div className={`card stack balance ${Math.abs(balance) < 1 ? '' : balance > 0 ? 'plus' : 'minus'}`}>
        {Math.abs(balance) < 1
          ? <p className="big">Ni är kvitt med {otherName} ✨</p>
          : <p className="big">{balance > 0 ? `${otherName} är skyldig er ${kr(balance)}` : `Ni är skyldiga ${otherName} ${kr(-balance)}`}</p>}
        <p className="muted small">Delade kostnader: ni står för {mineShare} %, {otherName} för {100 - mineShare} %. Bensin och tvätt delas inte.</p>
        {Math.abs(balance) >= 1 && (
          <div className="row wrap">
            {balance < 0 && otherPhone && <a className="button primary" href={swishUrl(otherPhone, -balance, `${car.name} delade kostnader`)}>Swisha {kr(-balance)}</a>}
            <button onClick={settle}>Markera som reglerat</button>
          </div>
        )}
      </div>

      {(view === 'costs' || view === 'year') && <div className="chips mb">
        {CAR_KINDS.filter((k) => k.quick).map((k) => <button key={k.id} className="chip" onClick={() => startCost(k.id)}>{k.emoji} {k.label}</button>)}
      </div>}

      <div className="seg mb">
        <button className={view === 'costs' ? 'active' : ''} onClick={() => setView('costs')}>Kostnader</button>
        <button className={view === 'todo' ? 'active' : ''} onClick={() => setView('todo')}>Att göra</button>
        <button className={view === 'year' ? 'active' : ''} onClick={() => setView('year')}>I år</button>
        <button className={view === 'reminders' ? 'active' : ''} onClick={() => setView('reminders')}>Datum</button>
      </div>

      {view === 'costs' && (
        <>
          {list.length === 0 && <p className="muted">Inga kostnader än. Tryck på + eller en knapp ovan.</p>}
          <ul className="list">
            {shown.map((c) => {
              const k = kindOf(c.kind)
              return (
                <li key={c.id} className="tap" onClick={() => setForm({ ...c, amount: String(c.amount), paid: paidByUs(c) ? 'us' : 'them', note: c.note || '', odometer: c.odometer || '' })}>
                  <span className="row grow">
                    <span className="big-emoji">{k.emoji}</span>
                    <span>{k.label}{c.note && <span className="muted"> · {c.note}</span>}
                      <div className="muted small">{prettyDay(c.day)} · {paidByUs(c) ? `ni betalade${c.paid_by_name ? ` (${c.paid_by_name})` : ''}` : `${otherName} betalade`}{c.shared ? ' · delas' : ''}</div></span>
                  </span>
                  <strong>{kr(c.amount)}</strong>
                </li>
              )
            })}
            {settlements.rows.map((s) => (
              <li key={s.id} className="muted small"><span>🤝 {prettyDay(s.day)}: {(s.from_household ? s.from_household === householdId : !isOwner) ? 'ni betalade' : `${otherName} betalade`} {kr(s.amount)}</span>
                <button className="icon-btn" onClick={() => confirm('Ta bort regleringen?') && settlements.remove(s.id)} aria-label="Ta bort">✕</button></li>
            ))}
          </ul>
          {list.length > 15 && !showAll && <button className="link" onClick={() => setShowAll(true)}>Visa alla {list.length}</button>}
        </>
      )}

      {view === 'year' && (
        <div className="card stack">
          <h3>{year}: {kr(total)}</h3>
          <ul className="list flush">
            {byKind.map(({ k, sum }) => <li key={k.id}><span>{k.emoji} {k.label}</span><span>{kr(sum)}</span></li>)}
          </ul>
          <p className="muted small">Ni har betalat {kr(thisYear.filter(paidByUs).reduce((s, c) => s + Number(c.amount), 0))}, {otherName} {kr(thisYear.filter((c) => !paidByUs(c)).reduce((s, c) => s + Number(c.amount), 0))}.</p>
          {lastOdo && <p className="muted small">Senaste mätarställning: {lastOdo.odometer.toLocaleString('sv-SE')} km ({prettyDay(lastOdo.day)})</p>}
        </div>
      )}

      {view === 'todo' && <CarTodo onInspected={inspected} car={car} householdId={householdId} me={me} people={people} otherName={otherName} />}
      {view === 'reminders' && <YearlyList householdId={householdId} carId={car.id} suggestionList={CAR_REMINDERS} placeholder="T.ex. Bilbesiktning" />}

      {(view === 'costs' || view === 'year') && <Fab onClick={() => startCost('bransle')} label="Ny kostnad" />}
      {form && (
        <Sheet title={form.id ? 'Ändra kostnad' : 'Ny kostnad'} onClose={() => setForm(null)}>
          <form className="stack" onSubmit={saveCost}>
            <div className="chips">
              {CAR_KINDS.map((k) => <button type="button" key={k.id} className={`chip ${form.kind === k.id ? 'on' : ''}`} onClick={() => setForm({ ...form, kind: k.id, shared: form.id ? form.shared : k.shared })}>{k.emoji} {k.label}</button>)}
            </div>
            <div className="row">
              <label className="field"><span className="muted small">Belopp (kr)</span><input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus={!form.id} required /></label>
              <label className="field"><span className="muted small">Datum</span><input type="date" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} required /></label>
            </div>
            <div className="seg">
              <button type="button" className={form.paid === 'us' ? 'active' : ''} onClick={() => setForm({ ...form, paid: 'us' })}>Vi betalade</button>
              <button type="button" className={form.paid === 'them' ? 'active' : ''} onClick={() => setForm({ ...form, paid: 'them' })}>{otherName} betalade</button>
            </div>
            <label className="row small"><input type="checkbox" checked={form.shared} onChange={(e) => setForm({ ...form, shared: e.target.checked })} /> Delas mellan hushållen ({mineShare} / {100 - mineShare})</label>
            <div className="row">
              <input placeholder="Anteckning (valfritt)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              <input placeholder="Mätare km" inputMode="numeric" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value.replace(/\D/g, '') })} style={{ maxWidth: 110 }} />
            </div>
            <button className="primary">Spara</button>
            {form.id && <button type="button" className="danger" onClick={() => { costs.remove(form.id); setForm(null) }}>Ta bort</button>}
          </form>
        </Sheet>
      )}
    </>
  )
}
