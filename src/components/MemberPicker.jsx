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
    <span className="avatar" style={{ background: member.color, width: size, height: size }} title={member.name} aria-label={member.name}>
      {member.short || member.name.slice(0, 1).toUpperCase()}
    </span>
  )
}

// Ger varje medlem en unik kort förkortning: M, E … eller Mag/Mam om flera börjar likadant
export function withInitials(members) {
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase()
  return members.map((m) => {
    const name = m.name.trim()
    let n = 1
    while (n < Math.min(3, name.length) && members.some((o) => o.id !== m.id && o.name.trim().slice(0, n).toLowerCase() === name.slice(0, n).toLowerCase())) n++
    return { ...m, short: cap(name.slice(0, n)) }
  })
}
