export default function MemberPicker({ members, value, onChange, emptyLabel = 'Alla' }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{emptyLabel}</option>
      {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
  )
}

export function MemberTag({ member }) {
  if (!member) return null
  return <span className="tag" style={{ background: member.color }}>{member.name}</span>
}
