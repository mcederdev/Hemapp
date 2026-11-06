import { createContext, useContext, useState } from 'react'
import Icon from './Icon'

// Rutor på Idag som går att fälla ihop och flytta. Ihopfälld visas en kort rad under rubriken.
// Vilka som är ihopfällda och ordningen sparas i telefonen.
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d } catch { return d } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* privat läge */ } }

export const DEFAULT_ORDER = ['med', 'pickups', 'dinner', 'day', 'chores', 'soon', 'shop']
const FoldCtx = createContext({ order: DEFAULT_ORDER, arranging: false, move: () => {} })

export function useFoldOrder() {
  const [order, setOrder] = useState(() => { const o = read('todayOrder', []); return [...o.filter((x) => DEFAULT_ORDER.includes(x)), ...DEFAULT_ORDER.filter((x) => !o.includes(x))] })
  const [arranging, setArranging] = useState(false)
  // Flytta upp/ner bland de rutor som syns just nu
  const move = (id, dir) => {
    const shown = [...document.querySelectorAll('[data-fold]')].map((el) => el.dataset.fold).sort((a, b) => order.indexOf(a) - order.indexOf(b))
    const i = shown.indexOf(id), other = shown[i + dir]
    if (!other) return
    const next = [...order]; const a = next.indexOf(id), b = next.indexOf(other)
    next[a] = other; next[b] = id
    setOrder(next); write('todayOrder', next)
  }
  return { order, arranging, setArranging, move }
}
export const FoldProvider = ({ value, children }) => <FoldCtx.Provider value={value}>{children}</FoldCtx.Provider>

function Arrows({ id }) {
  const { move } = useContext(FoldCtx)
  return (
    <span className="fold-arrows">
      <button className="icon-btn" onClick={() => move(id, -1)} aria-label="Flytta upp">↑</button>
      <button className="icon-btn" onClick={() => move(id, 1)} aria-label="Flytta ner">↓</button>
    </span>
  )
}

// Rutor som inte är en Fold (t.ex. middagen) men ska kunna flyttas
export function Movable({ id, className = '', children }) {
  const { order, arranging } = useContext(FoldCtx)
  return (
    <div data-fold={id} className={`movable ${arranging ? 'arranging' : ''} ${className}`} style={{ order: order.indexOf(id) + 1 }}>
      {arranging && <Arrows id={id} />}
      {children}
    </div>
  )
}

export default function Fold({ id, title, count, summary, onOpen, className = '', children }) {
  const { order, arranging } = useContext(FoldCtx)
  const [closed, setClosed] = useState(() => read('folded', []).includes(id))
  const toggle = () => {
    const next = !closed
    setClosed(next)
    const s = new Set(read('folded', [])); next ? s.add(id) : s.delete(id); write('folded', [...s])
  }
  return (
    <div data-fold={id} style={{ order: order.indexOf(id) + 1 }} className={`card compact fold ${closed ? 'folded' : ''} ${className}`}>
      <div className="fold-head">
        <button className="card-head" onClick={toggle} aria-expanded={!closed}>
          <span className="row">{title}{count > 0 && <span className="count">{count}</span>}</span>
          <Icon name="chevron" size={18} className={`muted fold-caret ${closed ? '' : 'open'}`} />
        </button>
        {arranging ? <Arrows id={id} /> : onOpen && <button className="icon-btn fold-open" onClick={onOpen} aria-label="Öppna sidan"><Icon name="chevron" size={18} /></button>}
      </div>
      {closed ? (summary ? <p className="fold-sum small">{summary}</p> : null) : children}
    </div>
  )
}
