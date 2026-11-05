import { useState } from 'react'
import { supabase } from '../supabase'
import { useTable } from '../useTable'
import { today } from '../lib/dates'
import { withUs } from '../lib/custody'
import { MemberTag } from './MemberPicker'
import { Check } from './Swipe'
import { forFocus } from './FamilyStrip'

const fmtN = (n) => String(Math.round(Number(n) * 10) / 10).replace('.', ',')
const hm = (iso) => new Date(iso).toTimeString().slice(0, 5)

// Idag: mediciner som ska tas morgon och kväll. Bockas av av den som ger/tar den, syns för alla och skickar en notis.
export default function MedicineToday({ householdId, members, people, me, custody, focus }) {
  const meds = useTable('medicines', householdId)
  const t = today()
  const doses = useTable('medicine_takes', householdId, 'taken_at', ['day', t])
  const [sent, setSent] = useState({})
  const byId = Object.fromEntries((people || members).map((m) => [m.id, m]))
  const nowHM = new Date().toTimeString().slice(0, 5)
  const late = (time) => { const [h, m] = time.split(':').map(Number); return nowHM >= `${String(Math.min(23, h + 2)).padStart(2, '0')}:${String(m).padStart(2, '0')}` }
  const here = (memberId) => { const c = (custody || []).find((x) => x.child_id === memberId); return !c || withUs(c, me.household_id, t, nowHM) }

  const rows = meds.rows
    .filter((m) => byId[m.member_id] && here(m.member_id) && forFocus(focus, m.member_id))
    .flatMap((m) => (m.times || []).filter((x) => x.time && Number(x.amount) > 0).map((x) => ({
      m, slot: x.time, label: `kl ${x.time}`, amount: x.amount, late: late(x.time),
      dose: doses.rows.find((d) => d.medicine_id === m.id && d.at_time === x.time)
    })))
    .sort((a, b) => a.slot.localeCompare(b.slot))
  if (!rows.length) return null

  const who = (m) => byId[m.member_id]
  const what = (r) => `${r.m.name} ${fmtN(r.amount)} ${r.m.unit === 'st' ? 'st' : r.m.unit} ${r.label}`
  const take = async (r) => {
    if (r.dose) return doses.remove(r.dose.id)
    const res = await doses.insert({ household_id: me.household_id, medicine_id: r.m.id, day: t, at_time: r.slot, taken_by: me.id })
    if (res) {
      const p = who(r.m)
      supabase.rpc('notify_household', { msg: p.id === me.id ? `har tagit ${what(r)} 💊` : `har gett ${p.name} ${what(r)} 💊`, link: '/?tab=today' })
    }
  }
  const remind = async (r) => {
    const p = who(r.m)
    const { error } = await supabase.rpc('notify_household', { msg: `påminner: ${p.id === me.id ? `${me.name} ska ta` : `glöm inte ge ${p.name}`} ${what(r)} 💊`, link: '/?tab=today' })
    if (error) alert(error.message); else setSent({ ...sent, [r.m.id + r.slot]: true })
  }

  return (
    <div className="card compact med-today">
      <div className="card-head"><strong>💊 Medicin idag</strong><span className="muted small">{rows.filter((r) => r.dose).length} av {rows.length}</span></div>
      <ul className="list plain">
        {rows.map((r) => (
          <li key={r.m.id + r.slot} className={`row med-dose ${r.dose ? 'taken' : r.late ? 'late' : ''}`}>
            <Check checked={!!r.dose} onChange={() => take(r)} label={`${r.dose ? 'Ångra' : 'Bocka av'} ${r.m.name} ${r.label}`} />
            <MemberTag member={who(r.m)} size={24} />
            <span className="grow">
              <strong>{r.m.name}</strong> <span className="muted small">{fmtN(r.amount)} {r.m.unit}</span>
              <div className="small muted">{r.label.replace('kl', 'Kl')}{r.dose ? ` · ✓ ${byId[r.dose.taken_by]?.name || 'Någon'} ${hm(r.dose.taken_at)}` : r.late ? ' · inte tagen än' : ''}</div>
            </span>
            {!r.dose && <button className="chip" disabled={sent[r.m.id + r.slot]} onClick={() => remind(r)}>{sent[r.m.id + r.slot] ? 'Påmint' : 'Påminn'}</button>}
          </li>
        ))}
      </ul>
    </div>
  )
}
