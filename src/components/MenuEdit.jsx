import { PAGES, LOCKED, BAR_SIZE, SUBS, resolveMenu } from '../lib/menu'
import Icon from './Icon'

// Anpassa menyn: dölj sidor man inte använder och flytta dem. De fem första hamnar i bottenmenyn.
export default function MenuEdit({ menu, onChange }) {
  const { order, hidden } = resolveMenu(menu)
  const save = (o, h) => onChange({ order: o, hidden: h })
  const move = (id, dir) => {
    const i = order.indexOf(id), j = i + dir
    if (j < 0 || j >= order.length) return
    const next = [...order]; [next[i], next[j]] = [next[j], next[i]]
    save(next, hidden)
  }
  const toggle = (id) => save(order, hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id])
  let shownN = 0
  return (
    <section>
      <h2>Anpassa menyn</h2>
      <p className="muted small">De {BAR_SIZE} första som visas hamnar i bottenmenyn, resten under Mer. Bocka ur sidor och delar av sidor du inte använder. Gäller bara dig.</p>
      <ul className="list menu-edit">
        {order.map((id, i) => {
          const p = PAGES.find((x) => x.id === id)
          const off = hidden.includes(id)
          const n = off ? null : ++shownN
          return [
            n === BAR_SIZE + 1 && <li key="div" className="menu-div muted small">Under Mer</li>,
            n === 1 && <li key="bar" className="menu-div muted small">Bottenmenyn</li>,
            <li key={id} className={`row ${off ? 'menu-off' : ''}`}>
              <label className="row grow">
                <input type="checkbox" checked={!off} disabled={LOCKED.includes(id)} onChange={() => toggle(id)} />
                <Icon name={p.icon} /> {p.label}
              </label>
              <span className="fold-arrows">
                <button className="icon-btn" onClick={() => move(id, -1)} disabled={i === 0} aria-label={`Flytta upp ${p.label}`}>↑</button>
                <button className="icon-btn" onClick={() => move(id, 1)} disabled={i === order.length - 1} aria-label={`Flytta ner ${p.label}`}>↓</button>
              </span>
            </li>,
            !off && SUBS[id] && (
              <li key={id + '-subs'} className="menu-subs">
                {SUBS[id].map(([sid, label, note]) => {
                  const key = `${id}.${sid}`
                  const subOff = hidden.includes(key)
                  const lastOn = !subOff && SUBS[id].filter(([x]) => !hidden.includes(`${id}.${x}`)).length === 1
                  return (
                    <label key={key} className={`row menu-sub ${subOff ? 'menu-off' : ''}`}>
                      <input type="checkbox" checked={!subOff} disabled={lastOn} onChange={() => toggle(key)} />
                      <span>{label}{note && <span className="muted small"> {note}</span>}</span>
                    </label>
                  )
                })}
              </li>
            )
          ]
        })}
      </ul>
      {hidden.length > 0 && <p className="muted small mt">Dolt för dig: {hidden.map((k) => { const [p, sid] = k.split('.'); const page = PAGES.find((x) => x.id === p); return sid ? `${page?.label} → ${SUBS[p]?.find(([x]) => x === sid)?.[1] || sid}` : page?.label }).filter(Boolean).join(', ')}. Det som hör till dolda delar syns inte heller på Idag, i kalendern eller i notiser.</p>}
      <button className="link small mt" onClick={() => onChange(null)}>Återställ standardmenyn</button>
    </section>
  )
}
