import { useId, useState } from 'react'
import { LuUsers, LuChevronDown, LuChevronUp } from 'react-icons/lu'

export default function RoomPresence({ room }) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const connected = room.connection === 'connected'
  const members = [...(room.members || [])].sort((a,b) => Number(b.id === room.userId) - Number(a.id === room.userId) || a.nickname.localeCompare(b.nickname,'ko'))
  return <div className="room-presence-wrap">
    <button type="button" className="room-presence" disabled={!connected} aria-expanded={connected && open} aria-controls={listId} onClick={() => setOpen(value => !value)}>
      <LuUsers /><span>{connected ? <>접속 <b>{room.online}</b>명 · 달리는 중 <b>{room.running}</b>명</> : '접속 인원 확인 중…'}</span>
      <span className={`connection-dot ${connected ? 'online' : ''}`} />
      {open ? <LuChevronUp /> : <LuChevronDown />}
    </button>
    {connected && open && <section className="room-members" id={listId} aria-label="접속 중인 러너">
      <h2>접속 중인 러너</h2>
      {members.length ? <ul>{members.map(member => <li key={member.id}><span className="room-member-name">{member.nickname}{member.id === room.userId && <small> (나)</small>}</span><span className={`room-member-state ${member.status}`}>{member.status === 'running' ? '달리는 중' : '쉬는 중'}</span></li>)}</ul> : <p>접속자 목록을 확인하고 있어요.</p>}
    </section>}
  </div>
}
