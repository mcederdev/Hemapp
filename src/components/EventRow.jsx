import { timeLabel } from '../lib/events'
import { parseRrule } from '../lib/rrule'
import { MemberTag } from './MemberPicker'
import SwipeRow from './Swipe'
import Icon from './Icon'
import { catById } from '../lib/categories'

// Tidslinjerad: tid till vänster, färgad stapel per person, titel och detaljer
export default function EventRow({ occ, day, byId, onRemove, onOpen, badge, className = '' }) {
  const l = timeLabel(occ, day)
  const [main, sub] = splitTime(l.time)
  const member = byId[occ.member_id]
  const cat = catById[occ.category]
  const details = [l.note, cat && `${cat.emoji} ${cat.label}`, occ.location].filter(Boolean)
  const body = (
    <>
      <div className="tl-time">
        <strong>{main}</strong>
        {sub && <span className="muted small">{sub}</span>}
      </div>
      <div className="tl-bar" style={{ background: member?.color || 'var(--accent)' }} />
      <div className={`tl-body ${onOpen ? 'tap' : ''}`} onClick={onOpen ? () => onOpen(occ) : undefined}>
        <div className="tl-title">{occ.title}{badge && <span className="vab-badge">{badge}</span>}</div>
        {(details.length > 0 || occ.rrule) && (
          <div className="muted small row-icons">
            {details.join(' · ')}
            {occ.rrule && <span><Icon name="repeat" size={12} /> {describe(occ.rrule)}</span>}
          </div>
        )}
      </div>
      <MemberTag member={member} size={24} />
      {onRemove && <button className="icon-btn del" onClick={() => onRemove(occ)} aria-label="Ta bort">✕</button>}
    </>
  )
  return onRemove
    ? <SwipeRow className={`tl ${className}`} onDelete={() => onRemove(occ)}>{body}</SwipeRow>
    : <li className={`tl ${className}`}>{body}</li>
}

function splitTime(t) {
  const m = t.match(/^(\d\d:\d\d)–(\d\d:\d\d)$/)
  if (m) return [m[1], m[2]]
  return [t, null]
}

export function describe(rrule) {
  const r = parseRrule(rrule)
  if (!r) return ''
  const n = Number(r.INTERVAL || 1)
  let text
  const d = r.FREQ === 'WEEKLY' && r.BYDAY ? r.BYDAY.split(',').map((x) => x.slice(-2)).sort().join(',') : ''
  if (d === 'FR,MO,TH,TU,WE') text = n === 1 ? 'vardagar' : n === 2 ? 'vardagar varannan vecka' : `vardagar var ${n}:e vecka`
  else if (d === 'SA,SU') text = n === 1 ? 'helger' : n === 2 ? 'helger varannan vecka' : `helger var ${n}:e vecka`
  else {
    const base = { DAILY: 'dag', WEEKLY: 'vecka', MONTHLY: 'månad', YEARLY: 'år' }[r.FREQ] || ''
    text = n === 1 ? `varje ${base}` : n === 2 ? (base === 'år' ? 'vartannat år' : `varannan ${base}`) : `var ${n}:e ${base}`
  }
  const u = r.UNTIL?.match(/^(\d{4})(\d{2})(\d{2})/)
  if (u) text += ` till ${new Date(+u[1], +u[2] - 1, +u[3]).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}`
  return text
}
