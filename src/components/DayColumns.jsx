import { useState } from 'react'
import { timeOf } from '../lib/events'
import { MemberTag } from './MemberPicker'
import EventRow from './EventRow'
import Sheet from './Sheet'
import { useNow } from '../lib/useNow'

const PX = 46 // pixlar per timme

// Dagvy med en kolumn per person, händelser som block i rätt höjd
export default function DayColumns({ occ, day, members, onRemove, onVab, onSick, me, badgeFor }) {
  const [open, setOpen] = useState(null)
  const now = useNow()
  const d0 = new Date(day); d0.setHours(0, 0, 0, 0)
  const d1 = new Date(d0); d1.setDate(d1.getDate() + 1)
  const isTimed = (o) => !o.all_day && !(o.start < d0 && o.end && o.end >= d1)
  const timed = occ.filter(isTimed)
  const allDay = occ.filter((o) => !isTimed(o))
  const hasFamily = occ.some((o) => !o.member_id || !members.some((m) => m.id === o.member_id))
  const cols = [...members.map((m) => ({ id: m.id, m })), ...(hasFamily ? [{ id: null, label: 'Alla' }] : [])]
  const colOf = (o) => (members.some((m) => m.id === o.member_id) ? o.member_id : null)
  const byId = Object.fromEntries(members.map((m) => [m.id, m]))

  const hourOf = (d) => (d - d0) / 3600000
  // Pass som började igår klipps vid dagens första timme i stället för att visa hela natten
  const starts = timed.filter((o) => o.start >= d0).map((o) => hourOf(o.start))
  const ends = timed.map((o) => Math.min(24, hourOf(o.end || new Date(o.start.getTime() + 3600000))))
  const from = Math.floor(Math.min(7, ...starts)), to = Math.max(from + 1, Math.ceil(Math.max(21, ...ends)))
  const hours = Array.from({ length: to - from }, (_, i) => from + i)
  const isToday = now >= d0 && now < d1

  // Lägg överlappande händelser bredvid varandra i samma kolumn
  const layout = (list) => {
    const lanes = []
    return list.map((o) => {
      const s = Math.max(from, hourOf(o.start)), e = Math.max(s + 0.5, Math.min(24, hourOf(o.end || new Date(o.start.getTime() + 3600000))))
      let lane = lanes.findIndex((end) => end <= s)
      if (lane === -1) { lane = lanes.length; lanes.push(e) } else lanes[lane] = e
      return { o, s, e, lane }
    }).map((x, _, all) => ({ ...x, lanes: Math.max(1, ...all.filter((y) => y.s < x.e && y.e > x.s).map((y) => y.lane + 1)) }))
  }

  return (
    <div className="daycols">
      <div className="dc-head" style={{ gridTemplateColumns: `36px repeat(${cols.length}, 1fr)` }}>
        <span />
        {cols.map((c) => <span key={c.id || 'all'} className="dc-name">{c.m ? <MemberTag member={c.m} size={28} /> : <span className="avatar fs-all" style={{ width: 28, height: 28 }}>Alla</span>}</span>)}
      </div>
      {allDay.length > 0 && (
        <div className="dc-allday" style={{ gridTemplateColumns: `36px repeat(${cols.length}, 1fr)` }}>
          <span className="muted small">Heldag</span>
          {cols.map((c) => (
            <span key={c.id || 'all'} className="dc-chips">
              {allDay.filter((o) => colOf(o) === c.id).map((o) => (
                <button key={o.key} className="dc-chip" style={{ '--c': byId[o.member_id]?.color || 'var(--accent)' }} onClick={() => setOpen(o)}>
                  {o.start < d0 && !o.all_day ? 'Hela dagen · ' : ''}{o.title}
                </button>
              ))}
            </span>
          ))}
        </div>
      )}
      <div className="dc-body" style={{ gridTemplateColumns: `36px repeat(${cols.length}, 1fr)`, height: hours.length * PX }}>
        <div className="dc-hours">
          {hours.map((h) => <span key={h} style={{ top: (h - from) * PX }}>{String(h).padStart(2, '0')}</span>)}
        </div>
        {cols.map((c) => (
          <div key={c.id || 'all'} className="dc-col">
            {hours.map((h) => <i key={h} className="dc-line" style={{ top: (h - from) * PX }} />)}
            {layout(timed.filter((o) => colOf(o) === c.id)).map(({ o, s, e, lane, lanes }) => {
              const color = byId[o.member_id]?.color || 'var(--accent)'
              const label = o.start < d0 ? `→${timeOf(o.end)}` : timeOf(o.start)
              return (
                <button key={o.key} className={`dc-ev ${o.end && o.end < now ? 'past' : ''}`} onClick={() => setOpen(o)}
                  style={{ top: (s - from) * PX + 1, height: Math.max(22, (e - s) * PX - 2), left: `${(lane / lanes) * 100}%`, width: `calc(${100 / lanes}% - 3px)`, '--c': color }}>
                  <strong>{o.title}</strong>
                  {badgeFor?.(o, day) && <em className="dc-vab">{badgeFor(o, day).startsWith('Sjuk') ? 'Sjuk' : 'VAB'}</em>}
                  <span>{label}</span>
                </button>
              )
            })}
          </div>
        ))}
        {isToday && hourOf(now) >= from && hourOf(now) <= to && (
          <div className="dc-now" style={{ top: (hourOf(now) - from) * PX }}><span>{timeOf(now)}</span></div>
        )}
      </div>
      {timed.length === 0 && allDay.length === 0 && <p className="muted small mt">Inget denna dag. Alla är lediga!</p>}
      {open && (
        <Sheet title={open.title} onClose={() => setOpen(null)}>
          <ul className="list"><EventRow occ={open} day={day} byId={byId} badge={badgeFor?.(open, day)} /></ul>
          <div className="stack">
            {onVab && byId[open.member_id]?.role === 'child' && <button className="primary" onClick={() => { const o = open; setOpen(null); onVab(o) }}>🤒 {byId[open.member_id].name} är sjuk – VAB</button>}
            {onSick && byId[open.member_id] && byId[open.member_id].role !== 'child' && !open.all_day && <button onClick={() => { const o = open; setOpen(null); onSick(o) }}>🤒 {open.member_id === me?.id ? 'Jag är sjuk' : `${byId[open.member_id].name} är sjuk`}</button>}
            {onRemove && <button className="danger w100" onClick={() => { onRemove(open); setOpen(null) }}>Ta bort händelsen</button>}
          </div>
        </Sheet>
      )}
    </div>
  )
}
