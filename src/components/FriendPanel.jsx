import { useRef, useState } from 'react'
import { LuUsers, LuSearch, LuMapPin } from 'react-icons/lu'
import { api } from '../lib/api'
import { socialErrorMessage } from '../lib/socialErrors'

export default function FriendPanel({ social, onLocate, confirmAction }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)
  const [blocks, setBlocks] = useState([])
  const [blocksLoaded, setBlocksLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const busyRef = useRef(false)
  const action = async (fn, success = '') => {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true); setMessage('')
    try { await fn(); setMessage(success); await social.refresh() }
    catch (err) { setMessage(socialErrorMessage(err)) }
    finally { busyRef.current = false; setBusy(false) }
  }
  const block = (runner) => action(async () => {
    if (!await confirmAction({ title: `${runner.nickname}님을 차단할까요?`, description: '서로 위치가 보이지 않고, 초대와 동행이 종료됩니다.' })) return
    await api.blockFriend(runner.id, true)
    setResults(rows => rows.filter(row => row.id !== runner.id))
    setBlocks(await api.listBlocks())
  })
  const groupMembers = social.pair?.members || []
  const groupSize = social.pair?.memberCount || groupMembers.length
  const groupFull = groupSize >= 4
  return <div className="friends-widget">
    <button type="button" className={`icon-btn friend-toggle ${open ? 'on' : ''}`} title="친구 찾기" aria-label="친구 찾기" aria-expanded={open} onClick={() => setOpen(value => !value)}><LuUsers />{social.pair && <span className="friend-group-count">{groupSize}/4</span>}{social.invites.some(i => i.incoming) && <span className="friend-invite-dot" aria-label="새 초대" />}</button>
    {open && <section className="friends-panel" aria-label="친구 찾기와 동행">
      <header className="friend-panel-heading"><h2>친구와 같이 달리자</h2><p>닉네임으로 친구를 찾아 함께 달려요.</p></header>
      {!social.enabled ? <p>정식 계정으로 러닝 중일 때 사용할 수 있어요.</p> : <>
        <div className="friend-preferences"><label><input type="checkbox" checked={social.publicLocation} onChange={e => social.setPublicLocation(e.target.checked)} /> 내 코스 위치 공개</label>
        <label><input type="checkbox" checked={social.allowInvites} onChange={e => social.setAllowInvites(e.target.checked)} /> 동행 초대 받기</label></div>
        <p className="note">위치를 공개하면 다른 러너가 맵에서 나를 찾을 수 있어요. 비공개로 바꿔도 수락한 동행 상대에게는 공유돼요.</p>
        {social.error && <p className="friend-notice" role="status">{social.error}</p>}
        <form className="friend-search" onSubmit={e => { e.preventDefault(); action(async () => { setResults(await api.searchFriends(query)); setSearched(true) }) }}>
          <label className="sr-only" htmlFor="friend-nickname">친구 닉네임</label>
          <input id="friend-nickname" placeholder="친구 닉네임 2~10자" minLength={2} maxLength={10} required value={query} onChange={e => setQuery(e.target.value)} />
          <button className="btn primary friend-search-button" disabled={busy}><LuSearch /><span>검색</span></button>
        </form>
        {searched && !results.length && <p role="status">해당 닉네임의 러너가 없어요.</p>}
        {results.map(runner => {
          const peer = social.peers.find(p => p.id === runner.id)
          return <article className="friend-row" key={runner.id}>
            <strong>{runner.nickname}</strong><small>{runner.online ? '러닝 화면 접속 중' : '오프라인'} · {runner.location_public ? '위치 공개' : '위치 비공개'}</small>
            <div className="friend-actions">
              {(peer || (runner.location_public && runner.online)) && <button className="btn ghost" onClick={() => onLocate(runner.id)}><LuMapPin /> 위치 보기</button>}
              <button className="btn primary" disabled={busy || !runner.online || !runner.allow_invites || groupFull || !social.connected} onClick={() => action(() => api.inviteFriend(runner.id), '동행 초대를 보냈어요. 상대의 수락을 기다려 주세요.')}>같이 달리기</button>
              <button className="link" disabled={busy} onClick={() => block(runner)}>차단</button>
            </div>
          </article>
        })}
        {social.invites.map(invite => <article className="friend-row" key={invite.id}>
          <strong>{invite.nickname}님{invite.incoming ? '의 동행 초대' : '에게 보낸 초대'}</strong>
          <small>나를 포함해 최대 4명, 앞 2명·뒤 2명으로 달려요. 60초 안에 수락해 주세요. 거리·체력·경험치는 각자 유지해요.</small>
          <div className="friend-actions">{invite.incoming ? <>
            <button className="btn primary" disabled={busy} onClick={() => action(() => api.respondInvite(invite.id, 'accept'), '동행을 시작했어요.')}>수락</button>
            <button className="btn ghost" disabled={busy} onClick={() => action(() => api.respondInvite(invite.id, 'decline'))}>거절</button>
          </> : <button className="btn ghost" disabled={busy} onClick={() => action(() => api.respondInvite(invite.id, 'cancel'))}>초대 취소</button>}</div>
        </article>)}
        {social.pair && <article className="friend-row"><strong>함께 달리는 중 {groupSize}/4</strong><p>앞 2명·뒤 2명으로 달려요. 러닝 기록은 각자 계산해요.</p><ul className="friend-group-members">{groupMembers.map(member => <li key={member.id}><span>{member.nickname}</span>{social.peers.some(peer => peer.id === member.id) && <button className="link" disabled={busy} onClick={() => block(member)}>차단</button>}</li>)}</ul><div className="friend-actions"><button className="btn ghost" disabled={busy} onClick={() => action(() => api.endPair(), '동행을 종료했어요.')}>혼자 달리기</button></div></article>}
        <button className="link friend-blocks-toggle" disabled={busy} onClick={() => action(async () => { setBlocks(await api.listBlocks()); setBlocksLoaded(true) })}>차단 목록 보기</button>
        {blocksLoaded && !blocks.length && <p role="status">차단한 러너가 없어요.</p>}
        {blocks.map(runner => <div className="friend-row" key={runner.id}>{runner.nickname}<button className="link" disabled={busy} onClick={() => action(async () => { await api.blockFriend(runner.id, false); setBlocks(await api.listBlocks()) })}>차단 해제</button></div>)}
        {message && <p className="friend-notice" role="status">{message}</p>}
      </>}
    </section>}
  </div>
}
