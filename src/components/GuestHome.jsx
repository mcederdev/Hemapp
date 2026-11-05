import { supabase } from '../supabase'
import { useTable } from '../useTable'
import { expandEvents, timeLabel, dayList } from '../lib/events'
import { today, addDays, parseDay, prettyDay } from '../lib/dates'
import { withUs } from '../lib/custody'
import { withInitials, MemberTag } from './MemberPicker'
import Notes from './Notes'
import Messages from './Messages'

// Gäst (t.ex. mormor): ser kalendern, middagar, lappar och meddelanden. Kan skriva lappar och meddelanden.
export default function GuestHome({ guest }) {
  const hid = guest.household_id
  const households = useTable('households', hid)
  const members = useTable('members', hid)
  const events = useTable('events', hid)
  const meals = useTable('meal_plan', hid, 'day')
  const custody = useTable('custody', hid)
  const t = today()
  const own = withInitials(members.rows.filter((m) => m.household_id === hid))
  const byId = Object.fromEntries(own.map((m) => [m.id, m]))
  const from = parseDay(t)
  const to = parseDay(addDays(t, 14))
  const occs = expandEvents(events.rows.filter((e) => e.household_id === hid), from, to)
  const days = Array.from({ length: 14 }, (_, i) => addDays(t, i)).map((d) => ({ d, list: dayList(occs, parseDay(d)) })).filter((x) => x.list.length)
  const nowHM = new Date().toTimeString().slice(0, 5)
  const h = households.rows[0]

  return (
    <div className="app guest">
      <main>
        <section>
          <div className="row between">
            <h2>🏡 {h?.name || 'Familjen'}</h2>
            <button className="link" onClick={() => supabase.auth.signOut()}>Logga ut</button>
          </div>
          <p className="muted">Hej {guest.name}! Här ser du vad som händer hos familjen.</p>
          <div className="row wrap mt">{own.map((m) => <span key={m.id} className="row"><MemberTag member={m} size={28} /> {m.name}</span>)}</div>
          {custody.rows.map((c) => byId[c.child_id] && (
            <p key={c.id} className="muted small mt">{byId[c.child_id].name} är {withUs(c, hid, t, nowHM) ? `hos ${h?.name || 'familjen'}` : 'i sitt andra hem'} just nu.</p>
          ))}
        </section>

        <section>
          <h3>Lappar</h3>
          <Notes householdId={hid} members={own} me={null} guest={guest} />
        </section>

        <section>
          <h3>Kommande två veckor</h3>
          {days.length === 0 && <p className="muted">Inget inplanerat.</p>}
          {days.map(({ d, list }) => (
            <div key={d} className="card compact mb">
              <strong className="small cap">{d === t ? 'Idag' : d === addDays(t, 1) ? 'Imorgon' : prettyDay(d)}</strong>
              <ul className="list plain">
                {list.map((o) => (
                  <li key={o.key} className="row">
                    <span className="muted small" style={{ minWidth: 86 }}>{timeLabel(o, parseDay(d)).time}</span>
                    <span className="grow">{o.title}</span>
                    <MemberTag member={byId[o.member_id]} size={22} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {meals.rows.some((m) => m.day >= t) && (
          <section>
            <h3>Middagar</h3>
            <ul className="list">
              {meals.rows.filter((m) => m.day >= t && m.day <= addDays(t, 6)).map((m) => <li key={m.id}><span className="muted small">{m.day === t ? 'Idag' : prettyDay(m.day)}</span> {m.dish}</li>)}
            </ul>
          </section>
        )}

        <section>
          <h3>Meddelanden</h3>
          <Messages me={null} householdId={hid} people={own} guest={guest} />
        </section>
      </main>
    </div>
  )
}
