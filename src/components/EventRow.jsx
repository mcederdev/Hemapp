import { timeLabel } from '../lib/events'
import { parseRrule } from '../lib/rrule'
import { MemberTag } from './MemberPicker'
import SwipeRow from './Swipe'
import Icon from './Icon'

// Tidslinjerad: tid till vänster, färgad stapel per person, titel och detaljer
export default function EventRow({ occ, day, byId, onRemove, className = '' }) {
  const l = timeLabel(occ, day)
  const [main, sub] = splitTime(l.time)
  const member = byId[occ.member_id]
  const details = [l.note, occ.location].filter(Boolean)
  const body = (
    <>
      <div className="tl-time">
        <strong>{main}</strong>
        {sub && <span className="muted small">{sub}</span>}
      </div>
      <div className="tl-bar" style={{ background: member?.color || 'var(--accent)' }} />
      <div className="tl-body">
        <div className="tl-title">{occ.title}</div>
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
  if (r.FREQ === 'WEEKLY' && r.BYDAY && (!r.INTERVAL || r.INTERVAL === '1')) {
    const d = r.BYDAY.split(',').map((x) => x.slice(-2)).sort().join(',')
    if (d === 'FR,MO,TH,TU,WE') return 'vardagar'
    if (d === 'SA,SU') return 'helger'
  }
  const n = Number(r.INTERVAL || 1)
  const base = { DAILY: 'dag', WEEKLY: 'vecka', MONTHLY: 'månad', YEARLY: 'år' }[r.FREQ] || ''
  if (n === 1) return `varje ${base}`
  if (n === 2) return base === 'år' ? 'vartannat år' : `varannan ${base}`
  return `var ${n}:e ${base}`
}
