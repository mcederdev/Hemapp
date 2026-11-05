import { useState } from 'react'
import { useTable } from '../useTable'
import { COMMON_DISHES } from '../lib/defaults'

export default function Meals({ householdId }) {
  const dishes = useTable('dishes', householdId)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [only, setOnly] = useState('alla')
  const [tips, setTips] = useState([])

  const own = dishes.rows.map((d) => ({ ...d, own: true }))
  const all = [...own, ...COMMON_DISHES.filter((c) => !own.some((o) => o.name.toLowerCase() === c.name.toLowerCase()))]
  const pool = only === 'egna' ? own : all
  const categories = [...new Set(all.map((d) => d.category).filter(Boolean))]

  const suggest = () => {
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    setTips(shuffled.slice(0, 3))
  }
  const add = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    dishes.insert({ name: name.trim(), category: category.trim() || null })
    setName(''); setCategory('')
  }

  return (
    <section>
      <h2>Vad ska vi äta?</h2>
      <div className="card stack">
        <div className="seg">
          <button className={only === 'alla' ? 'active' : ''} onClick={() => setOnly('alla')}>Alla rätter</button>
          <button className={only === 'egna' ? 'active' : ''} onClick={() => setOnly('egna')}>Bara våra egna</button>
        </div>
        <button className="primary big" onClick={suggest} disabled={pool.length === 0}>🎲 Ge mig tips</button>
        {tips.length > 0 && (
          <ul className="tips">
            {tips.map((t) => <li key={t.name}><strong>{t.name}</strong>{t.category && <span className="muted small"> · {t.category}</span>}</li>)}
          </ul>
        )}
      </div>

      <h3>Lägg till egen rätt</h3>
      <form className="row" onSubmit={add}>
        <input placeholder="Rätt, t.ex. Mormors köttbullar" value={name} onChange={(e) => setName(e.target.value)} />
        <input list="cats" placeholder="Kategori" value={category} onChange={(e) => setCategory(e.target.value)} style={{ maxWidth: 120 }} />
        <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        <button className="primary">+</button>
      </form>

      <h3>Alla rätter ({all.length})</h3>
      <ul className="list">
        {all.map((d) => (
          <li key={d.id || d.name}>
            <span>{d.name} {d.own && <span className="tag own">Egen</span>}</span>
            <span className="meta">
              {d.category && <span className="muted small">{d.category}</span>}
              {d.own && <button className="icon-btn" onClick={() => dishes.remove(d.id)} aria-label="Ta bort">✕</button>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
