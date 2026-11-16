import { useEffect, useRef, useState } from 'react'
import { LuUsers, LuSearch, LuMapPin } from 'react-icons/lu'
import { api } from '../lib/api'
import { fmtPace, fmtKm } from '../lib/pace'
import { socialErrorMessage } from '../lib/socialErrors'
import { notify } from '../lib/notify'

export default function FriendPanel({ social, onLocate, confirmAction, openRequest = 0, onAcceptInvite }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('friends')
  const [friends, setFriends] = useState([])
  const [friendsLoaded, setFriendsLoaded] = useState(false)
  const [friendsError, setFriendsError] = useState('')
  useEffect(() => {
    if (!open || !social.enabled) return
    let alive = true
    const refresh = async () => {
      try {
        const rows = await api.listFriends()
        if (alive) { setFriends(rows); setFriendsLoaded(true); setFriendsError('') }
      } catch { if (alive) setFriendsError('친구 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') }
    }
    refresh()
    const timer = setInterval(refresh, 15000)
    return () => { alive = false; clearInterval(timer) }
  }, [open, social.enabled])
  useEffect(() => { if (openRequest) setOpen(true) }, [openRequest])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)
  const [blocks, setBlocks] = useState([])
  const [blocksLoaded, setBlocksLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const action = async (fn, success = '') => {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true)
    try { await fn(); if (success) notify.success(success); await social.refresh() }
    catch (err) { notify.error(socialErrorMessage(err)) }
    finally { busyRef.current = false; setBusy(false) }
  }
  const block = (runner) => action(async () => {
    if (!await confirmAction({ title: `${runner.nickname}님을 차단할까요?`, description: '서로 위치가 보이지 않고, 초대와 동행이 종료됩니다.' })) return
    await api.blockFriend(runner.id, true)
    setFriends(rows => rows.filter(row => row.id !== runner.id))
    setResults(rows => rows.filter(row => row.id !== runner.id))
    setBlocks(await api.listBlocks())
  })
  const groupMembers = social.pair?.members || []
  const groupSize = social.pair?.memberCount || groupMembers.length
  const groupFull = groupSize >= 4
  const saved = new Set(friends.map(friend => friend.id))
  const saveFriend = runner => action(async () => {
    await api.saveFriend(runner.id)
    setFriends(await api.listFriends()); setFriendsLoaded(true)
  }, `${runner.nickname}님을 친구 목록에 추가했어요.`)
  const removeFriend = runner => action(async () => {
    if (!await confirmAction({ title: `${runner.nickname}님을 친구 목록에서 삭제할까요?`, description: '목록에서만 삭제하며 진행 중인 동행은 유지돼요.' })) return
    await api.saveFriend(runner.id, false)
    setFriends(rows => rows.filter(row => row.id !== runner.id))
  })
  const renderRunner = (runner, isSaved = false) => {
    const peer = social.peers.find(p => p.id === runner.id)
    return <article className="friend-row" key={runner.id}>
      <strong>{runner.nickname}</strong><small>{runner.online ? '러닝 화면 접속 중' : '오프라인'} · {runner.location_public ? '위치 공개' : '위치 비공개'}</small>
      <div className="friend-actions">
        {(peer || (runner.location_public && runner.online)) && <button className="btn ghost" onClick={() => onLocate(runner.id)}><LuMapPin /> 위치 보기</button>}
        <button className="btn primary" disabled={busy || !runner.online || !runner.allow_invites || groupFull || !social.connected} onClick={() => action(() => api.inviteFriend(runner.id), '동행 초대를 보냈어요. 상대의 수락을 기다려 주세요.')}>같이 달리기</button>
        {isSaved ? <button className="link" disabled={busy} onClick={() => removeFriend(runner)}>친구 삭제</button> : <button className="btn ghost" disabled={busy || saved.has(runner.id)} onClick={() => saveFriend(runner)}>{saved.has(runner.id) ? '추가됨' : '친구 추가'}</button>}
        <button className="link" disabled={busy} onClick={() => block(runner)}>차단</button>
      </div>
    </article>
  }
  return <div className="friends-widget">
    <button type="button" className={`icon-btn friend-toggle ${open ? 'on' : ''}`} title="친구 관리" aria-label="친구 관리" aria-expanded={open} onClick={() => setOpen(value => !value)}><LuUsers />{social.pair && <span className="friend-group-count">{groupSize}/4</span>}{social.invites.some(i => i.incoming) && <span className="friend-invite-dot" aria-label="새 초대" />}</button>
    {open && <section className="friends-panel" aria-label="친구 찾기와 동행">
      <header className="friend-panel-heading"><h2>친구 관리</h2><p>한 번 추가한 친구는 닉네임을 다시 찾지 않아도 돼요.</p></header>
      {!social.enabled ? <p>정식 계정으로 러닝 중일 때 사용할 수 있어요.</p> : <>
        <div className="friend-preferences"><label><input type="checkbox" checked={social.publicLocation} onChange={e => social.setPublicLocation(e.target.checked)} /> 내 코스 위치 공개</label>
        <label><input type="checkbox" checked={social.allowInvites} onChange={e => social.setAllowInvites(e.target.checked)} /> 동행 초대 받기</label><label><input type="checkbox" checked={social.shareActivity} onChange={e => social.setShareActivity(e.target.checked)} /> 내 활동 구름 공개</label></div>
        <p className="note">위치를 공개하면 다른 러너가 맵에서 나를 찾을 수 있어요. 비공개로 바꿔도 수락한 동행 상대에게는 공유돼요.</p>
        {social.error && <p className="friend-notice" role="status">{social.error}</p>}
        <div className="friend-tabs" role="group" aria-label="친구 목록과 검색"><button type="button" aria-pressed={tab === 'friends'} onClick={() => setTab('friends')}>내 친구 {friends.length}</button><button type="button" aria-pressed={tab === 'search'} onClick={() => setTab('search')}>친구 찾기</button></div>
        {tab === 'friends' ? <>
          {friendsError && <p className="friend-notice" role="status">{friendsError}</p>}
          {!friendsLoaded && !friendsError && <p role="status">친구 목록을 불러오는 중이에요.</p>}
          {friendsLoaded && !friends.length && <p className="note">아직 추가한 친구가 없어요. <button type="button" className="link" onClick={() => setTab('search')}>친구 찾기</button>에서 닉네임을 검색해 추가하세요.</p>}
          {friends.map(runner => renderRunner(runner, true))}
        </> : <>
        <p className="note">친구 추가는 내 목록에 저장하는 기능이에요. 상대의 위치 공개 설정과 동행 수락은 그대로 유지됩니다.</p>
        <form className="friend-search" onSubmit={e => { e.preventDefault(); action(async () => { setResults(await api.searchFriends(query)); setSearched(true) }) }}>
          <label className="sr-only" htmlFor="friend-nickname">친구 닉네임</label>
          <input id="friend-nickname" placeholder="친구 닉네임 2~10자" minLength={2} maxLength={10} required value={query} onChange={e => setQuery(e.target.value)} />
          <button className="btn primary friend-search-button" disabled={busy}><LuSearch /><span>검색</span></button>
        </form>
        {searched && !results.length && <p role="status">해당 닉네임의 러너가 없어요.</p>}
        {results.map(runner => renderRunner(runner))}
        </>}
        {social.invites.map(invite => <article className="friend-row" key={invite.id}>
          <strong>{invite.nickname}님{invite.incoming ? '의 동행 초대' : '에게 보낸 초대'}</strong>
          {invite.offered_pace && <div className="invite-conditions"><span>기준 페이스 <b>{fmtPace(invite.offered_pace)}/km</b></span><span>목표 거리 <b>{fmtKm(Number(invite.offered_distance))}km</b></span></div>}
          {!invite.offered_pace ? <small role="status">초대 조건을 확인할 수 없어요. 다시 초대해 주세요.</small> : <small>수락하면 현재 기록을 저장하고 위 조건으로 새 러닝을 시작해요.</small>}
          <small>나를 포함해 최대 4명, 앞 2명·뒤 2명으로 달려요. 60초 안에 수락해 주세요. 거리·체력·경험치는 각자 유지해요.</small>
          <div className="friend-actions">{invite.incoming ? <>
            <button className="btn primary" disabled={busy || !invite.offered_pace} onClick={() => action(() => onAcceptInvite(invite.id), '동행을 시작했어요.')}>수락</button>
            <button className="btn ghost" disabled={busy} onClick={() => action(() => api.respondInvite(invite.id, 'decline'))}>거절</button>
          </> : <button className="btn ghost" disabled={busy} onClick={() => action(() => api.respondInvite(invite.id, 'cancel'))}>초대 취소</button>}</div>
        </article>)}
        {social.pair && <article className="friend-row"><strong>함께 달리는 중 {groupSize}/4</strong><p>앞 2명·뒤 2명으로 달려요. 러닝 기록은 각자 계산해요.</p><ul className="friend-group-members">{groupMembers.map(member => <li key={member.id}><span>{member.nickname}</span>{social.peers.some(peer => peer.id === member.id) && <button className="link" disabled={busy} onClick={() => block(member)}>차단</button>}</li>)}</ul><div className="friend-actions"><button className="btn ghost" disabled={busy} onClick={() => action(() => api.endPair(), '동행을 종료했어요.')}>혼자 달리기</button></div></article>}
        <button className="link friend-blocks-toggle" disabled={busy} onClick={() => action(async () => { setBlocks(await api.listBlocks()); setBlocksLoaded(true) })}>차단 목록 보기</button>
        {blocksLoaded && !blocks.length && <p role="status">차단한 러너가 없어요.</p>}
        {blocks.map(runner => <div className="friend-row" key={runner.id}>{runner.nickname}<button className="link" disabled={busy} onClick={() => action(async () => { await api.blockFriend(runner.id, false); setBlocks(await api.listBlocks()) })}>차단 해제</button></div>)}
      </>}
    </section>}
  </div>
}
