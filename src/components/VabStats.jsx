import { useState } from 'react'
import { MemberTag } from './MemberPicker'

// Statistik: hur ofta och av vad barnet varit sjukt, och hur VAB fördelas mellan er
export default function VabStats({ rows, members }) {
  const years = [...new Set(rows.map((r) => r.day.slice(0, 4)))].sort().reverse()
  const nowYear = new Date().getFullYear().toString()
  const [year, setYear] = useState(years.includes(nowYear) ? nowYear : years[0] || nowYear)
  const kids = members.filter((m) => m.role === 'child')
  const adults = members.filter((m) => m.role !== 'child')
  const inYear = rows.filter((r) => r.day.startsWith(year))
  const vab = inYear.filter((r) => (r.kind || 'vab') === 'vab')
  const sick = inYear.filter((r) => r.kind === 'sick')

  if (rows.length === 0) return <p className="muted">Ingen statistik än. Den fylls på när ni registrerar VAB eller sjukdagar.</p>

  return (
    <div>
      {years.length > 1 && (
        <div className="chips mb">{years.map((y) => <button key={y} className={`chip ${y === year ? 'on' : ''}`} onClick={() => setYear(y)}>{y}</button>)}</div>
      )}

      {kids.map((k) => {
        const mine = vab.filter((r) => r.child_id === k.id)
        const days = uniqueDays(mine)
        const periods = toPeriods(days)
        const longest = Math.max(0, ...periods.map((p) => p.length))
        const byIll = count(mine, (r) => r.illness?.trim() || 'Okänt', days)
        const months = Array.from({ length: 12 }, (_, i) => days.filter((d) => +d.slice(5, 7) === i + 1).length)
        const max = Math.max(1, ...months)
        return (
          <div key={k.id} className="card">
            <div className="row"><MemberTag member={k} size={30} /><strong>{k.name} {year}</strong></div>
            <div className="stat-tiles">
              <Tile n={days.length} label={days.length === 1 ? 'sjukdag' : 'sjukdagar'} />
              <Tile n={periods.length} label={periods.length === 1 ? 'gång' : 'gånger'} />
              <Tile n={longest} label="längsta (dagar)" />
            </div>

            <h4 className="day">Per månad</h4>
            <div className="months">
              {months.map((n, i) => (
                <div key={i} className="mcol" title={`${n} dagar`}>
                  <span className="mval">{n || ''}</span>
                  <i style={{ height: `${(n / max) * 100}%`, background: k.color }} />
                  <span className="mlabel">{'JFMAMJJASOND'[i]}</span>
                </div>
              ))}
            </div>

            <h4 className="day">Vad det var</h4>
            {byIll.length === 0 ? <p className="muted small">Inga sjukdagar.</p> : (
              <div className="bars">
                {byIll.map(([name, n]) => (
                  <div key={name} className="bar-row">
                    <span className="bar-label">{name}</span>
                    <span className="bar-track"><i style={{ width: `${(n / byIll[0][1]) * 100}%`, background: k.color }} /></span>
                    <span className="bar-n">{n}</span>
                  </div>
                ))}
              </div>
            )}
            {periods.length > 0 && <p className="muted small">Senast: {fmtDay(periods[periods.length - 1][0])}{periods[periods.length - 1].length > 1 ? `–${fmtDay(periods[periods.length - 1].at(-1))}` : ''}{lastIll(mine)}</p>}
          </div>
        )
      })}

      <div className="card">
        <strong>Vem vabbade {year}</strong>
        <div className="split-bar">
          {adults.map((a) => {
            const n = uniqueDays(vab.filter((r) => r.parent_id === a.id)).length
            const total = adults.reduce((s, x) => s + uniqueDays(vab.filter((r) => r.parent_id === x.id)).length, 0)
            return total ? <i key={a.id} style={{ width: `${(n / total) * 100}%`, background: a.color }} title={`${a.name}: ${n}`} /> : null
          })}
        </div>
        {adults.map((a) => {
          const mine = vab.filter((r) => r.parent_id === a.id)
          return <div key={a.id} className="row between small"><span className="row"><MemberTag member={a} size={22} /> {a.name}</span><span>{uniqueDays(mine).length} dagar · {fmt(sumHours(mine))} tim</span></div>
        })}
      </div>

      {sick.length > 0 && (
        <div className="card">
          <strong>Egen sjukfrånvaro {year}</strong>
          {adults.map((a) => {
            const mine = sick.filter((r) => r.parent_id === a.id)
            if (!mine.length) return null
            const ill = count(mine, (r) => r.illness?.trim() || 'Okänt', uniqueDays(mine))
            return <div key={a.id} className="row between small mt"><span className="row"><MemberTag member={a} size={22} /> {a.name}</span><span>{uniqueDays(mine).length} dagar{ill[0] ? ` · mest ${ill[0][0].toLowerCase()}` : ''}</span></div>
          })}
        </div>
      )}
    </div>
  )
}

function Tile({ n, label }) {
  return <div className="stat-tile"><strong>{n}</strong><span>{label}</span></div>
}

const uniqueDays = (list) => [...new Set(list.map((r) => r.day))].sort()
const sumHours = (list) => list.reduce((s, r) => s + (Number(r.hours) || 0), 0)
const fmt = (n) => String(Math.round(n * 100) / 100).replace('.', ',')
const fmtDay = (d) => new Date(d + 'T00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
const lastIll = (list) => { const r = [...list].sort((a, b) => b.day.localeCompare(a.day))[0]; return r?.illness ? ` (${r.illness.toLowerCase()})` : '' }

// Antal dagar per sjukdom (en dag räknas en gång även om dagen delades)
function count(list, key) {
  const m = new Map()
  const seen = new Set()
  for (const r of list) {
    const k = key(r), id = `${k}|${r.day}`
    if (seen.has(id)) continue
    seen.add(id); m.set(k, (m.get(k) || 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

// Delar upp dagar i sjukperioder. En helg utan VAB bryter inte perioden.
export function toPeriods(days) {
  const out = []
  for (const d of days) {
    const last = out.at(-1)?.at(-1)
    if (last) {
      const gap = Math.round((new Date(d + 'T00:00') - new Date(last + 'T00:00')) / 86400000)
      const between = Array.from({ length: gap - 1 }, (_, i) => { const x = new Date(last + 'T00:00'); x.setDate(x.getDate() + i + 1); return x.getDay() })
      if (gap === 1 || (gap <= 3 && between.every((wd) => wd === 0 || wd === 6))) { out.at(-1).push(d); continue }
    }
    out.push([d])
  }
  return out
}
