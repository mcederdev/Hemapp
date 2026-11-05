import { MemberTag } from './MemberPicker'

// Familjeremsa: tryck på en person för att bara se den personens saker.
// counts = { [memberId]: antal försenade } visas som en röd siffra.
export default function FamilyStrip({ members, focus, setFocus, counts = {} }) {
  if (members.length === 0) return null
  return (
    <div className="family-strip" role="tablist" aria-label="Visa för">
      <button className={`fs-item ${!focus ? 'on' : ''}`} onClick={() => setFocus(null)} role="tab" aria-selected={!focus}>
        <span className="avatar fs-all" style={{ width: 44, height: 44 }}>Alla</span>
        <span className="fs-name">Alla</span>
      </button>
      {members.map((m) => (
        <button key={m.id} className={`fs-item ${focus === m.id ? 'on' : ''}`} style={{ '--ring': m.color }}
          onClick={() => setFocus(focus === m.id ? null : m.id)} role="tab" aria-selected={focus === m.id}>
          <span className="fs-av">
            <MemberTag member={m} size={44} />
            {counts[m.id] > 0 && <span className="fs-badge">{counts[m.id]}</span>}
          </span>
          <span className="fs-name">{m.name}</span>
        </button>
      ))}
    </div>
  )
}

// Hjälp för filtrering: saker som gäller vald person eller hela familjen
export const forFocus = (focus, memberId) => !focus || !memberId || memberId === focus
