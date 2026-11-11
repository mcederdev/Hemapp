import { useState } from 'react'
import { useTable } from '../useTable'
import { today, prettyDay } from '../lib/dates'
import { daysUntil } from '../lib/yearly'
import Sheet, { Fab } from './Sheet'
import Scanner from './Scanner'
import { useBarcodes } from '../useBarcodes'

const PLACES = [['skafferi', '🥫 Skafferi'], ['kyl', '🧊 Kyl'], ['frys', '❄️ Frys'], ['kryddor', '🌶️ Kryddor']]
const blank = () => ({ name: '', place: 'kyl', qty: '', best_before: '' })

export const bestBeforeText = (d, t = today()) => {
  const n = daysUntil(t, d)
  return n < 0 ? `gick ut ${prettyDay(d)}` : n === 0 ? 'går ut idag' : n === 1 ? 'går ut imorgon' : n <= 7 ? `går ut om ${n} dagar` : `bäst före ${prettyDay(d)}`
}

const SOURCE = {
  known: () => 'Känd vara, ni har skannat den förut.',
  off: (p) => `Hittad i Open Food Facts${p.brand ? ` (${p.brand})` : ''}. Ändra namnet om du vill, appen kommer ihåg det.`,
  unknown: () => 'Okänd streckkod. Skriv vad det är, så känns den igen nästa gång.'
}

// Skafferi, kyl och frys: vad som finns hemma och när det går ut. "Slut" lägger varan på Komplettera.
// Varor kan skannas in med streckkoden. Koderna sparas i barcodes så att de känns igen nästa gång.
export default function Pantry({ householdId, onOut }) {
  const pantry = useTable('pantry_items', householdId, 'best_before')
  const { lookup, remember } = useBarcodes(householdId)
  const [edit, setEdit] = useState(null)
  const [place, setPlace] = useState('alla')
  const [scan, setScan] = useState(false)
  const [looking, setLooking] = useState(false)
  const [note, setNote] = useState('')
  const t = today()
  const rows = pantry.rows.filter((x) => place === 'alla' || x.place === place)
    .sort((a, b) => (a.best_before || '9999').localeCompare(b.best_before || '9999') || a.name.localeCompare(b.name))

  const scanned = async (code) => {
    setScan(false)
    setNote('')
    setLooking(true)
    const p = await lookup(code, place === 'alla' ? 'kyl' : place)
    setLooking(false)
    setEdit({ ...blank(), name: p.name, place: p.place, qty: p.qty, code, from: p.from, brand: p.brand })
  }

  const save = async (e, next = false) => {
    e?.preventDefault()
    if (!edit.name.trim()) return
    const v = { name: edit.name.trim(), place: edit.place, qty: edit.qty || null, best_before: edit.best_before || null }
    if (edit.id) await pantry.update(edit.id, v); else await pantry.insert(v)
    if (edit.code) remember(edit.code, v)
    if (next) { setEdit(null); setNote(`${v.name} är tillagd.`); setScan(true); return }
    setEdit(edit.id || edit.code ? null : { ...blank(), place: edit.place })
  }
  const out = (x) => { pantry.remove(x.id); if (confirm(`Lägga ${x.name} på Komplettera-listan?`)) onOut(x.name) }

  return (
    <div className="mt">
      <div className="chips">
        <button className={`chip ${place === 'alla' ? 'on' : ''}`} onClick={() => setPlace('alla')}>Allt</button>
        {PLACES.map(([v, l]) => <button key={v} className={`chip ${place === v ? 'on' : ''}`} onClick={() => setPlace(v)}>{l}</button>)}
      </div>
      <div className="scan-btns mt">
        <button onClick={() => { setNote(''); setScan(true) }}>📷 Skanna in vara</button>
      </div>
      {looking && <p className="muted small mt">Letar upp varan…</p>}
      {note && !looking && <p className="muted small mt">{note}</p>}
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
      {scan && <Scanner title="Skanna in vara" onCode={scanned} onClose={() => setScan(false)} />}
      {edit && (
        <Sheet title={edit.id ? edit.name : 'Finns hemma'} onClose={() => setEdit(null)}>
          <form className="stack" onSubmit={save}>
            {edit.from && <p className={`small ${edit.from === 'unknown' ? 'error' : 'muted'}`}>{SOURCE[edit.from](edit)}</p>}
            <input placeholder="Vad? (t.ex. Mjölk, Kycklingfilé)" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus={!edit.code || !edit.name} />
            <div className="seg compact">{PLACES.map(([v, l]) => <button type="button" key={v} className={edit.place === v ? 'active' : ''} onClick={() => setEdit({ ...edit, place: v })}>{l}</button>)}</div>
            <div className="row">
              <label className="field"><span className="muted small">Hur mycket (valfritt)</span><input placeholder="t.ex. 2 st, 1 liter" value={edit.qty} onChange={(e) => setEdit({ ...edit, qty: e.target.value })} /></label>
              <label className="field"><span className="muted small">Bäst före</span><input type="date" value={edit.best_before} onChange={(e) => setEdit({ ...edit, best_before: e.target.value })} /></label>
            </div>
            <button className="primary">{edit.id ? 'Spara' : 'Lägg till'}</button>
            {edit.code && !edit.id && <button type="button" onClick={(e) => save(e, true)}>Lägg till och skanna nästa</button>}
            {!edit.id && !edit.code && <p className="muted small">Formuläret är kvar så att du kan lägga in flera saker i rad.</p>}
            {edit.id && <button type="button" className="danger" onClick={() => { pantry.remove(edit.id); setEdit(null) }}>Ta bort</button>}
          </form>
        </Sheet>
      )}
    </div>
  )
}
