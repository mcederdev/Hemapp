import { useState } from 'react'
import { useTable } from '../useTable'
import { today, prettyDay } from '../lib/dates'
import { daysUntil } from '../lib/yearly'
import Sheet, { Fab } from './Sheet'

const PLACES = [['skafferi', '🥫 Skafferi'], ['kyl', '🧊 Kyl'], ['frys', '❄️ Frys']]
const blank = () => ({ name: '', place: 'kyl', qty: '', best_before: '' })

export const bestBeforeText = (d, t = today()) => {
  const n = daysUntil(t, d)
  return n < 0 ? `gick ut ${prettyDay(d)}` : n === 0 ? 'går ut idag' : n === 1 ? 'går ut imorgon' : n <= 7 ? `går ut om ${n} dagar` : `bäst före ${prettyDay(d)}`
}

// Skafferi, kyl och frys: vad som finns hemma och när det går ut. "Slut" lägger varan på Komplettera.
export default function Pantry({ householdId, onOut }) {
  const pantry = useTable('pantry_items', householdId, 'best_before')
  const [edit, setEdit] = useState(null)
  const [place, setPlace] = useState('alla')
  const t = today()
  const rows = pantry.rows.filter((x) => place === 'alla' || x.place === place)
    .sort((a, b) => (a.best_before || '9999').localeCompare(b.best_before || '9999') || a.name.localeCompare(b.name))

  const save = async (e) => {
    e.preventDefault()
    if (!edit.name.trim()) return
    const v = { name: edit.name.trim(), place: edit.place, qty: edit.qty || null, best_before: edit.best_before || null }
    if (edit.id) await pantry.update(edit.id, v); else await pantry.insert(v)
    setEdit(edit.id ? null : { ...blank(), place: edit.place })
  }
  const out = (x) => { pantry.remove(x.id); if (confirm(`Lägga ${x.name} på Komplettera-listan?`)) onOut(x.name) }

  return (
    <div className="mt">
      <div className="chips">
        <button className={`chip ${place === 'alla' ? 'on' : ''}`} onClick={() => setPlace('alla')}>Allt</button>
        {PLACES.map(([v, l]) => <button key={v} className={`chip ${place === v ? 'on' : ''}`} onClick={() => setPlace(v)}>{l}</button>)}
      </div>
      {pantry.rows.length === 0 && <p className="muted">Det ni bockar av på inköpslistan hamnar här av sig självt (mat som sparas, inte frukt, dryck eller hygien). Lägg till mer med +. Då föreslår Mat-sidan middagar som använder det som snart går ut.</p>}
      {pantry.rows.length > 0 && <p className="muted small mt">Avbockade varor läggs till här. Bäst före är en gissning för färskvaror, tryck på varan för att ändra.</p>}
      <ul className="list mt">
        {rows.map((x) => {
          const n = x.best_before ? daysUntil(t, x.best_before) : null
          return (
            <li key={x.id}>
              <span className="tap grow" onClick={() => setEdit({ ...x, qty: x.qty || '', best_before: x.best_before || '' })}>
                <strong>{x.name}</strong>{x.qty ? <span className="muted"> · {x.qty}</span> : ''}
                <div className={`small ${n !== null && n <= 2 ? 'error' : 'muted'}`}>{PLACES.find((p) => p[0] === x.place)?.[1]}{x.best_before ? ` · ${bestBeforeText(x.best_before, t)}` : ''}</div>
              </span>
              <button className="chip" onClick={() => out(x)}>Slut</button>
            </li>
          )
        })}
      </ul>
      <Fab onClick={() => setEdit({ ...blank(), place: place === 'alla' ? 'kyl' : place })} label="Lägg till" />
      {edit && (
        <Sheet title={edit.id ? edit.name : 'Finns hemma'} onClose={() => setEdit(null)}>
          <form className="stack" onSubmit={save}>
            <input placeholder="Vad? (t.ex. Mjölk, Kycklingfilé)" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus />
            <div className="seg">{PLACES.map(([v, l]) => <button type="button" key={v} className={edit.place === v ? 'active' : ''} onClick={() => setEdit({ ...edit, place: v })}>{l}</button>)}</div>
            <div className="row">
              <label className="field"><span className="muted small">Hur mycket (valfritt)</span><input placeholder="t.ex. 2 st, 1 liter" value={edit.qty} onChange={(e) => setEdit({ ...edit, qty: e.target.value })} /></label>
              <label className="field"><span className="muted small">Bäst före</span><input type="date" value={edit.best_before} onChange={(e) => setEdit({ ...edit, best_before: e.target.value })} /></label>
            </div>
            <button className="primary">{edit.id ? 'Spara' : 'Lägg till'}</button>
            {!edit.id && <p className="muted small">Formuläret är kvar så att du kan lägga in flera saker i rad.</p>}
            {edit.id && <button type="button" className="danger" onClick={() => { pantry.remove(edit.id); setEdit(null) }}>Ta bort</button>}
          </form>
        </Sheet>
      )}
    </div>
  )
}
