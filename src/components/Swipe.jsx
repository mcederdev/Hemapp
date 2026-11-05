import { useRef, useState } from 'react'
import Icon from './Icon'

// Rad som går att svepa: höger = bocka av, vänster = ta bort
export default function SwipeRow({ onCheck, onDelete, checkLabel = 'Klar', className = '', children, ...rest }) {
  const start = useRef(null)
  const [dx, setDxState] = useState(0)
  const dxRef = useRef(0)
  const setDx = (v) => { dxRef.current = v; setDxState(v) }
  const [leaving, setLeaving] = useState(null)
  const T = 90

  const down = (e) => { const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY, lock: null } }
  const move = (e) => {
    if (!start.current) return
    const t = e.touches[0]
    const x = t.clientX - start.current.x, y = t.clientY - start.current.y
    if (start.current.lock === null && (Math.abs(x) > 8 || Math.abs(y) > 8)) start.current.lock = Math.abs(x) > Math.abs(y) ? 'x' : 'y'
    if (start.current.lock !== 'x') return
    if ((x > 0 && !onCheck) || (x < 0 && !onDelete)) return setDx(0)
    setDx(Math.max(-160, Math.min(160, x)))
  }
  const up = () => {
    if (!start.current) return
    start.current = null
    const dx = dxRef.current
    if (dx > T && onCheck) { buzz(); setLeaving('right'); setTimeout(() => { setLeaving(null); setDx(0); onCheck() }, 220) }
    else if (dx < -T && onDelete) { buzz(); setLeaving('left'); setTimeout(() => { setLeaving(null); setDx(0); onDelete() }, 220) }
    else setDx(0)
  }
  const offset = leaving === 'right' ? '100%' : leaving === 'left' ? '-100%' : `${dx}px`

  return (
    <li className={`swipe ${className}`} {...rest}>
      <div className="swipe-bg">
        <span className={`swipe-check ${dx > T ? 'armed' : ''}`} style={{ opacity: dx > 0 ? 1 : 0 }}><Icon name="check" size={20} /> {checkLabel}</span>
        <span className={`swipe-del ${dx < -T ? 'armed' : ''}`} style={{ opacity: dx < 0 ? 1 : 0 }}>Ta bort <Icon name="trash" size={20} /></span>
      </div>
      <div className="swipe-fg" style={{ transform: `translateX(${offset})`, transition: start.current ? 'none' : 'transform .22s ease' }}
        onTouchStart={down} onTouchMove={move} onTouchEnd={up} onTouchCancel={up}>
        {children}
      </div>
    </li>
  )
}

export function buzz() { try { navigator.vibrate?.(12) } catch { /* inte stöd */ } }

// Kryssruta som animerar en bock innan åtgärden körs
export function Check({ checked, onChange, label }) {
  const [anim, setAnim] = useState(false)
  const click = () => {
    if (anim) return
    buzz()
    setAnim(true)
    setTimeout(() => { setAnim(false); onChange() }, 320)
  }
  const on = checked !== anim
  return (
    <button type="button" className={`cbox ${on ? 'on' : ''} ${anim ? 'pop' : ''}`} onClick={click} aria-pressed={checked} aria-label={label}>
      {on && <Icon name="check" size={16} strokeWidth={3} />}
    </button>
  )
}
