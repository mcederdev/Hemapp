import { useState } from 'react'
import { supabase } from '../supabase'
import { SECTIONS } from '../lib/sections'
import { useWakeLock } from '../lib/useNow'
import { buzz } from './Swipe'
import { checkOff } from '../lib/refill'
import { useTable } from '../useTable'
import { today } from '../lib/dates'

const lastStore = (rows) => [...rows].reverse().find((r) => r.store)?.store || ''

// "Jag handlar nu": stora rader per avdelning, mätare, skärmen hålls tänd
export default function ShopMode({ list, items, lists = [], onClose, householdId, me }) {
  useWakeLock(true)
  const [sent, setSent] = useState(false)
  const [cost, setCost] = useState(null)
  const spend = useTable('grocery_spend', householdId, 'day')
  const rows = items.rows.filter((i) => i.list_id === list.id)
  const left = rows.filter((i) => !i.done)
  const taken = rows.filter((i) => i.done)
  const total = rows.length
  const sec = (i) => (SECTIONS.includes(i.section) ? i.section : 'Övrigt')
  const groups = SECTIONS.map((s) => [s, left.filter((i) => sec(i) === s)]).filter(([, v]) => v.length)

  const toggle = (i) => { buzz(); if (i.done) items.update(i.id, { done: false }); else checkOff(items, i, lists) }
  const finish = async () => {
    if (!sent && taken.length > 0) {
      const { error } = await supabase.rpc('notify_household', { msg: `har handlat${list.is_default ? '' : ` (${list.name})`} 🛒`, link: '/?tab=shopping' })
      if (!error) setSent(true)
    }
    for (const i of taken) items.remove(i.id)
    if (taken.length > 0 && householdId) setCost({ amount: '', store: lastStore(spend.rows) })
    else onClose()
  }
  const saveCost = async (e) => {
    e.preventDefault()
    const n = Number(String(cost.amount).replace(/\s/g, '').replace(',', '.'))
    if (n > 0) await spend.insert({ amount: n, store: cost.store.trim() || null, list_id: list.id, member_id: me?.id || null, day: today() })
    onClose()
  }

  if (cost) {
    return (
      <div className="shopmode" role="dialog" aria-label="Vad kostade det">
        <form className="sm-cost stack" onSubmit={saveCost}>
          <h2>Bra jobbat! 🛒</h2>
          <p className="muted">Vad kostade handlingen? Då ser ni matkostnaden per månad under Statistik.</p>
          <input inputMode="decimal" placeholder="Belopp i kr" value={cost.amount} onChange={(e) => setCost({ ...cost, amount: e.target.value })} autoFocus className="big-input" />
          <input placeholder="Butik (valfritt)" value={cost.store} onChange={(e) => setCost({ ...cost, store: e.target.value })} list="stores" />
          <datalist id="stores">{[...new Set(spend.rows.map((r) => r.store).filter(Boolean))].map((x) => <option key={x} value={x} />)}</datalist>
          <button className="primary big">Spara</button>
          <button type="button" className="link" onClick={onClose}>Hoppa över</button>
        </form>
      </div>
    )
  }

  return (
    <div className="shopmode" role="dialog" aria-label="Handlar nu">
      <header className="sm-head">
        <div className="row between">
          <strong>Handlar nu · {list.name}</strong>
          <button className="close-btn" onClick={onClose} aria-label="Stäng">✕</button>
        </div>
        <div className="sm-meter"><i style={{ width: `${total ? (taken.length / total) * 100 : 0}%` }} /></div>
        <p className="muted small">{left.length === 0 ? 'Allt är i korgen!' : `${left.length} av ${total} kvar`}</p>
      </header>
      <div className="sm-body">
        {groups.map(([section, list]) => (
          <div key={section}>
            <h4 className="day">{section}</h4>
            {list.map((i) => (
              <button key={i.id} className="sm-row" onClick={() => toggle(i)}>
                <span className="sm-box" /> {i.name}
              </button>
            ))}
          </div>
        ))}
        {taken.length > 0 && (
          <>
            <h4 className="day">I korgen</h4>
            {taken.map((i) => (
              <button key={i.id} className="sm-row done" onClick={() => toggle(i)}>
                <span className="sm-box on">✓</span> {i.name}
              </button>
            ))}
          </>
        )}
        {total === 0 && <p className="muted">Listan är tom.</p>}
      </div>
      <footer className="sm-foot">
        <button className="primary big w100" onClick={finish}>Klar med handlingen</button>
        <p className="muted small center-text">Det som ligger i korgen rensas och resten av familjen får en notis.</p>
      </footer>
    </div>
  )
}
