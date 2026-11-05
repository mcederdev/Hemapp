import { useState } from 'react'
import { useTable } from '../useTable'

export default function Shopping({ householdId }) {
  const items = useTable('shopping_items', householdId)
  const [text, setText] = useState('')
  const todo = items.rows.filter((i) => !i.done)
  const done = items.rows.filter((i) => i.done)

  const add = (e) => {
    e.preventDefault()
    const name = text.trim()
    if (!name) return
    items.insert({ name })
    setText('')
  }
  const clearDone = () => done.forEach((i) => items.remove(i.id))

  return (
    <section>
      <h2>Inköpslista</h2>
      <form className="row" onSubmit={add}>
        <input placeholder="Lägg till vara…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="primary">Lägg till</button>
      </form>
      <ul className="list">
        {todo.map((i) => (
          <li key={i.id}>
            <label className="check">
              <input type="checkbox" checked={false} onChange={() => items.update(i.id, { done: true })} />
              <span>{i.name}</span>
            </label>
            <button className="icon-btn" onClick={() => items.remove(i.id)} aria-label="Ta bort">✕</button>
          </li>
        ))}
        {!items.loading && todo.length === 0 && <li className="muted">Listan är tom.</li>}
      </ul>
      {done.length > 0 && (
        <>
          <div className="row between"><h3>I korgen</h3><button className="link" onClick={clearDone}>Rensa</button></div>
          <ul className="list done">
            {done.map((i) => (
              <li key={i.id}>
                <label className="check">
                  <input type="checkbox" checked onChange={() => items.update(i.id, { done: false })} />
                  <span>{i.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
