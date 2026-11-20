import { useEffect, useRef, useState } from 'react'

// Popup som glider upp nerifrån, stängs med ✕ eller tryck utanför
export default function Sheet({ title, onClose, children, tall = false }) {
  // Stäng bara om både tryck och släpp sker utanför rutan (inte när man markerar text och drar ut musen)
  const downOutside = useRef(false)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('no-scroll') }
  }, [onClose])
  return (
    <div className="sheet-bg" onPointerDown={(e) => { downOutside.current = e.target === e.currentTarget }}
      onClick={(e) => { if (e.target === e.currentTarget && downOutside.current) onClose(); downOutside.current = false }}>
      <div className={`sheet ${tall ? 'tall' : ''}`} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row between sheet-head">
          <h3 className="cap">{title}</h3>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Stäng">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Rund plusknapp nere till höger
export function Fab({ onClick, label = 'Lägg till' }) {
  return <button className="fab" onClick={onClick} aria-label={label}>+</button>
}

// Plusknapp som först frågar hur man vill lägga till: skanna streckkoden eller skriva själv.
// options = [{ icon, label, onClick }]
export function FabMenu({ options, label = 'Lägg till' }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  const pick = (o) => { setOpen(false); o.onClick() }
  return (
    <>
      {open && <div className="fab-bg" onClick={() => setOpen(false)} />}
      {open && (
        <div className="fab-menu" role="menu" aria-label={label}>
          {options.map((o) => (
            <button key={o.label} role="menuitem" onClick={() => pick(o)}><span aria-hidden="true">{o.icon}</span> {o.label}</button>
          ))}
        </div>
      )}
      <button className={`fab ${open ? 'open' : ''}`} onClick={() => setOpen(!open)} aria-label={open ? 'Stäng' : label} aria-expanded={open}>+</button>
    </>
  )
}
