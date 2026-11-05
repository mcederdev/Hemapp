export default function MemberPicker({ members, value, onChange, emptyLabel = 'Alla' }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{emptyLabel}</option>
      {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
  )
}

export function MemberTag({ member, size = 26 }) {
  if (!member) return null
  return (
    <span className={`avatar ${member.avatar_url ? 'pic' : ''}`} style={{ background: member.color, width: size, height: size }} title={member.name} aria-label={member.name}>
      {member.avatar_url ? <img src={member.avatar_url} alt="" /> : member.short || member.name.slice(0, 1).toUpperCase()}
    </span>
  )
}

// Första bokstaven i namnet i cirkeln (färgen skiljer personerna åt)
export function withInitials(members) {
  return members.map((m) => ({ ...m, short: m.name.trim().charAt(0).toUpperCase() }))
}
