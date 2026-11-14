import { useEffect, useState } from 'react'
import { LuUsers, LuSettings, LuMessageCircle, LuHistory, LuShield } from 'react-icons/lu'
import { api } from '../lib/api'
import { configureSettings, DEFAULT_SETTINGS, SETTING_FIELDS } from '../lib/settings'
import { SUPPORT_TYPES, SUPPORT_STATUS } from './Support'

const TABS = [['members', '회원 관리', LuUsers], ['support', '문의 관리', LuMessageCircle], ['settings', '러닝과 경험치 설정', LuSettings], ['audit', '변경 이력', LuHistory]]
const date = value => value ? new Date(value).toLocaleString('ko-KR') : '없음'
const ACTIONS = { xp: '경험치 조정', suspend: '계정 이용 정지', restore: '계정 이용 복원', settings: '러닝 설정 변경', support_reply: '문의 답변' }

export default function Admin({ confirmAction }) {
  const [tab, setTab] = useState('members')
  const [data, setData] = useState(null)
  const [settings, setSettings] = useState(null)
  const [draft, setDraft] = useState(null)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const [selected, setSelected] = useState(null)
  const [memberRuns, setMemberRuns] = useState(null)
  const [xp, setXp] = useState(0)
  const [reason, setReason] = useState('')
  const [reply, setReply] = useState('')
  const [status, setStatus] = useState('reviewing')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const dirty = settings && draft && JSON.stringify(draft) !== JSON.stringify(settings.value)
  useEffect(() => {
    let live = true
    setLoading(true); setError(''); setData(null); setSelected(null)
    const load = tab === 'members' ? api.adminMembers(search, page) : tab === 'support' ? api.adminSupport(filter, page) : tab === 'audit' ? api.adminAudit(page) : api.getSettings()
    load.then(value => {
      if (!live) return
      if (tab === 'settings') { setSettings(value); setDraft(structuredClone(value.value)) }
      else setData(value)
    }).catch(err => { if (live) setError(err.message || '불러오지 못했어요.') }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [tab, search, filter, page, refresh])
  const changeTab = async (next) => {
    if (busy || next === tab) return
    if ((dirty || reason || reply) && !await confirmAction({ title: '관리 메뉴를 이동할까요?', description: '저장하지 않은 변경사항은 사라져요.' })) return
    setTab(next); setPage(0); setSelected(null); setReason(''); setReply(''); setNotice('')
  }
  const act = async (action) => {
    if (busy) return
    if (!await confirmAction({ title: `${ACTIONS[action]}을 진행할까요?`, description: `${selected.nickname || selected.email || selected.id} 계정에 적용합니다. 사유: ${reason}`, confirmLabel: '변경 적용' })) return
    setBusy(true); setError(''); setNotice('')
    try { await api.adminMemberAction(selected.id, action, action === 'xp' ? Number(xp) : null, reason); setSelected(null); setReason(''); setNotice('회원 정보를 변경했어요.'); setRefresh(v => v + 1) } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const saveSettings = async (event) => {
    event.preventDefault()
    if (busy || !dirty) return
    if (!await confirmAction({ title: '러닝 설정을 적용할까요?', description: '다음에 시작하는 러닝부터 새 설정을 사용합니다. 경험치 곡선을 바꾸면 기존 회원의 표시 레벨도 달라질 수 있어요.', confirmLabel: '설정 적용' })) return
    setBusy(true); setError(''); setNotice('')
    try { const version = await api.adminSaveSettings(draft, settings.version); configureSettings(draft); setSettings({ ...settings, value: structuredClone(draft), version }); setNotice(`설정 버전 ${version}을 적용했어요.`) } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const saveReply = async (event) => {
    event.preventDefault()
    if (!await confirmAction({ title: '문의 답변과 상태를 저장할까요?', description: '작성한 답변이 문의한 사용자에게 표시됩니다.', confirmLabel: '답변 저장' })) return
    setBusy(true); setError(''); setNotice('')
    try { await api.adminReply(selected.id, status, reply); setSelected(null); setReply(''); setNotice('문의 답변을 저장했어요.'); setRefresh(v => v + 1) } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const editLevel = (index, key, value) => setDraft(old => ({ ...old, levels: old.levels.map((row, i) => i === index ? { ...row, [key]: value } : row) }))
  useEffect(() => {
    let live = true
    setMemberRuns(null)
    if (tab === 'members' && selected) api.adminMemberRuns(selected.id).then(value => { if (live) setMemberRuns(value) }).catch(() => { if (live) setError('회원의 러닝 기록을 불러오지 못했어요.') })
    return () => { live = false }
  }, [tab, selected?.id])
  return <div className="admin-screen"><div className="admin-banner"><div><span className="eyebrow">RUN DASH ADMIN</span><h1><LuShield /> 관리자 페이지</h1></div><span className="badge">관리자 전용</span></div><div className="mypage-layout admin-layout">
    <aside className="card mypage-sidebar"><nav aria-label="관리자 메뉴">{TABS.map(([id, label, Icon]) => <button type="button" key={id} disabled={busy} className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => changeTab(id)}><Icon />{label}</button>)}</nav></aside>
    <section className="card admin-content"><div className="section-heading"><h2>{TABS.find(([id]) => id === tab)[1]}</h2><button className="btn ghost" disabled={loading || busy} onClick={async () => { if (dirty && !await confirmAction({ title: '설정을 다시 불러올까요?', description: '저장하지 않은 설정 변경은 사라져요.' })) return; setRefresh(v => v + 1) }}>새로고침</button></div>
      {error && <p className="error" role="alert">{error}</p>}{notice && <p className="account-notice" role="status">{notice}</p>}
      {tab === 'members' && <form className="admin-filters" onSubmit={e => { e.preventDefault(); setSearch(query); setPage(0); setRefresh(v => v + 1) }}><label className="sr-only" htmlFor="member-search">이메일 또는 닉네임 검색</label><input id="member-search" value={query} onChange={e => setQuery(e.target.value)} maxLength={100} placeholder="이메일 또는 닉네임 검색" /><button className="btn ghost" disabled={busy}>검색</button></form>}
      {tab === 'support' && <label className="field"><span>문의 상태</span><select value={filter} disabled={busy} onChange={e => { setFilter(e.target.value); setPage(0) }}><option value="">전체</option>{Object.entries(SUPPORT_STATUS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
      {loading ? <p role="status">불러오고 있어요…</p> : <>
      {tab === 'members' && data && <><p className="admin-count">전체 {data.total}명</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>회원</th><th>상태</th><th>경험치</th><th>거리와 횟수</th><th>관리</th></tr></thead><tbody>{data.items.map(member => <tr key={member.id}><td><strong>{member.nickname || (member.is_anonymous ? '익명 러너' : '러너 생성 전')}</strong><small>{member.email || member.id}</small><small>가입 {date(member.created_at)}</small></td><td>{member.admin ? '관리자' : member.suspended ? '이용 정지' : '정상'}</td><td>{Number(member.xp).toLocaleString()} XP</td><td>{Number(member.total_distance_km).toFixed(2)}km<small>{member.run_count}회</small></td><td><button className="btn ghost" disabled={busy} onClick={() => { setSelected(member); setXp(Number(member.xp)); setReason(''); setNotice('') }}>관리</button></td></tr>)}</tbody></table>{!data.items.length && <p className="account-empty">검색 결과가 없어요.</p>}</div>
      {selected && <div className="admin-editor"><h3>{selected.nickname || selected.email || '익명 러너'} 관리</h3><p>최근 접속 {date(selected.last_sign_in_at)}</p>{selected.suspended && <p>정지 사유: {selected.reason}</p>}<label className="field"><span>변경 사유</span><input value={reason} minLength={2} maxLength={500} onChange={e => setReason(e.target.value)} disabled={busy} placeholder="운영 이력에 남길 사유" /></label><label className="field"><span>설정할 총 경험치</span><input type="number" min={0} max={1000000000} step={1} value={xp} onChange={e => setXp(e.target.value)} disabled={busy} /></label><div className="row"><button className="btn primary" disabled={busy || reason.trim().length < 2 || !selected.nickname || !!selected.active_run_id || xp === '' || !Number.isInteger(Number(xp)) || Number(xp) < 0 || Number(xp) > 1000000000} onClick={() => act('xp')}>경험치 적용</button><button className="btn ghost" disabled={busy || reason.trim().length < 2 || selected.admin} onClick={() => act(selected.suspended ? 'restore' : 'suspend')}>{selected.suspended ? '이용 복원' : '이용 정지'}</button></div>{selected.active_run_id && <p>러닝이 종료된 후 경험치를 변경할 수 있어요.</p>}</div>}</>}
      {tab === 'support' && data && <><p className="admin-count">전체 {data.total}건</p><div className="admin-ticket-list">{data.items.map(ticket => <button className={`admin-ticket ${selected?.id === ticket.id ? 'active' : ''}`} key={ticket.id} disabled={busy} onClick={() => { setSelected(ticket); setStatus(ticket.status); setReply(ticket.reply); setNotice('') }}><span className={`status-badge status-${ticket.status}`}>{SUPPORT_STATUS[ticket.status]}</span><strong>{ticket.title}</strong><small>{SUPPORT_TYPES[ticket.category]} · {ticket.nickname || ticket.email || '익명 러너'} · {date(ticket.created_at)}</small></button>)}</div>{!data.items.length && <p className="account-empty">접수된 문의가 없어요.</p>}{selected && <form className="admin-editor" onSubmit={saveReply}><h3>{selected.title}</h3><p className="ticket-body">{selected.body}</p><label className="field"><span>처리 상태</span><select value={status} disabled={busy} onChange={e => setStatus(e.target.value)}>{Object.entries(SUPPORT_STATUS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="field"><span>답변</span><textarea rows={6} maxLength={4000} value={reply} disabled={busy} onChange={e => setReply(e.target.value)} /></label><button className="btn primary" disabled={busy || (status === 'resolved' && reply.trim().length < 1)}>답변과 상태 저장</button></form>}</>}
      {tab === 'audit' && data && <div className="audit-list">{data.items.map(item => <details key={item.id}><summary><strong>{ACTIONS[item.action] || item.action}</strong><span>{date(item.created_at)}</span><small>{item.actor} · {item.target}</small></summary><pre>{JSON.stringify(item.details, null, 2)}</pre></details>)}{!data.items.length && <p className="account-empty">아직 변경 이력이 없어요.</p>}</div>}
      {tab === 'settings' && draft && <form onSubmit={saveSettings}><p className="admin-settings-note">현재 버전 {settings.version}. 새 설정은 다음 러닝부터 적용됩니다. 진행 중인 러닝은 시작 시 설정을 유지해요.</p><fieldset disabled={busy}>
        {Array.from(new Set(SETTING_FIELDS.map(([group]) => group))).map(group => <section className="settings-group" key={group}><h3>{group}</h3><div className="settings-grid">{SETTING_FIELDS.filter(([g]) => g === group).map(([,key,label,min,max,step]) => <label className="field" key={key}><span>{label}</span><input type="number" required min={min} max={max} step={step} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value === '' ? '' : Number(e.target.value) })} /></label>)}</div></section>)}
        <section className="settings-group"><h3>러닝 강도 3가지</h3><p>기본 페이스에 추가할 시간과 체력 소모 배율이에요.</p><div className="settings-grid">{draft.intensities.map((effort,index) => <div key={effort.id} className="intensity-editor"><strong>{effort.id}</strong>{[['label','이름','text'],['description','설명','text'],['extraPace','추가 페이스 초/km','number'],['drain','체력 소모 배율','number']].map(([key,label,type]) => <label className="field" key={key}><span>{label}</span><input type={type} required maxLength={key === 'label' ? 20 : 100} min={key === 'drain' ? .1 : 0} max={key === 'drain' ? 5 : 600} step={key === 'drain' ? .05 : 1} value={effort[key]} onChange={e => setDraft({ ...draft, intensities: draft.intensities.map((row,i) => i === index ? { ...row, [key]: type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value } : row) })} /></label>)}</div>)}</div></section>
        <section className="settings-group"><h3>레벨별 능력치</h3><p>페이스는 초/km 단위예요. 부스터 지속 시간을 0으로 설정하면 해당 레벨에서는 사용할 수 없어요.</p><div className="admin-table-wrap level-table"><table className="admin-table"><thead><tr><th>레벨</th><th>최대 페이스</th><th>최대 체력</th><th>회복 시간 초</th><th>부스터 초</th></tr></thead><tbody>{draft.levels.map((row,index) => <tr key={row.level}><th>Lv.{row.level}</th>{[['pace',180,1800],['stamina',10,1000],['recovery',5,300],['boost',0,60]].map(([key,min,max]) => <td key={key}><input aria-label={`레벨 ${row.level} ${key}`} type="number" min={min} max={max} step={1} required value={row[key]} onChange={e => editLevel(index,key,e.target.value === '' ? '' : Number(e.target.value))} /></td>)}</tr>)}</tbody></table></div></section>
      </fieldset><div className="settings-save"><button type="button" className="btn ghost" disabled={busy} onClick={async () => { if (await confirmAction({ title: '기본값으로 되돌릴까요?', description: '입력값만 초기화됩니다. 적용하려면 설정 저장을 눌러주세요.' })) setDraft(structuredClone(DEFAULT_SETTINGS)) }}>기본값 불러오기</button><button className="btn primary" disabled={busy || !dirty}>{busy ? '저장 중…' : '설정 저장'}</button></div></form>}
      {tab !== 'settings' && data && <div className="admin-pagination"><button className="btn ghost" disabled={busy || page === 0} onClick={() => setPage(n => n - 1)}>이전</button><span>{page + 1} / {Math.max(1, Math.ceil(data.total / 25))}</span><button className="btn ghost" disabled={busy || (page + 1) * 25 >= data.total} onClick={() => setPage(n => n + 1)}>다음</button></div>}
      {tab === 'members' && selected && memberRuns && <section className="admin-editor"><h3>회원 러닝 기록</h3><p>전체 {memberRuns.total}건 중 최근 10건</p>{memberRuns.items.map(run => <article className="member-run" key={run.id}><strong>{Number(run.details.distanceKm || 0).toFixed(2)}km · {run.details.completed ? '완주' : '중간 종료'}</strong><p>{date(run.created_at)} · {run.details.practice ? '개발 체험' : `+${run.details.growth?.xpEarned || 0} XP`}</p></article>)}{!memberRuns.items.length && <p>저장된 러닝 기록이 없어요.</p>}</section>}
      </>}
    </section></div></div>
}
