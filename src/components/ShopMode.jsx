import { useState } from 'react'
import { supabase } from '../supabase'
import { SECTIONS } from '../lib/sections'
import { useWakeLock } from '../lib/useNow'
import { buzz } from './Swipe'

// "Jag handlar nu": stora rader per avdelning, mätare, skärmen hålls tänd
export default function ShopMode({ list, items, onClose }) {
  useWakeLock(true)
  const [sent, setSent] = useState(false)
  const rows = items.rows.filter((i) => i.list_id === list.id)
  const left = rows.filter((i) => !i.done)
  const taken = rows.filter((i) => i.done)
  const total = rows.length
  const sec = (i) => (SECTIONS.includes(i.section) ? i.section : 'Övrigt')
  const groups = SECTIONS.map((s) => [s, left.filter((i) => sec(i) === s)]).filter(([, v]) => v.length)

  const toggle = (i) => { buzz(); items.update(i.id, { done: !i.done }) }
  const finish = async () => {
    if (!sent && taken.length > 0) {
      const { error } = await supabase.rpc('notify_household', { msg: `har handlat${list.is_default ? '' : ` (${list.name})`} 🛒`, link: '/?tab=shopping' })
      if (!error) setSent(true)
    }
    for (const i of taken) items.remove(i.id)
    onClose()
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
