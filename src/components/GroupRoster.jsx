export default function GroupRoster({ group, userId }) {
  if (!group) return null
  const members = [...(group.members || [])].sort((a,b) => a.slot - b.slot)
  return <section className="group-roster" aria-label="함께 달리는 러너">
    <div className="group-roster-heading"><strong>함께 달리는 중</strong><span>{group.memberCount || members.length}/4</span></div>
    <ul>{members.map(member => <li key={member.id}><small>{member.slot < 2 ? '앞' : '뒤'}</small><span>{member.nickname}{member.id === userId && ' (나)'}</span></li>)}</ul>
  </section>
}
