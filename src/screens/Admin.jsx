import { lazy, Suspense, useEffect, useState } from 'react'
import AdminMemberModal from '../components/AdminMemberModal'
import AdminActionMenu from '../components/AdminActionMenu'
import AdminTestAccountModal from '../components/AdminTestAccountModal'
import AdminReportModal from '../components/AdminReportModal'
import AdminChatMessageModal from '../components/AdminChatMessageModal'
import AdminSupportModal from '../components/AdminSupportModal'
import AdminRunModal, { INTENSITY_LABELS } from '../components/AdminRunModal'
import { fmtPace, fmtTime } from '../lib/pace'
import Pagination from '../components/Pagination'
import NumberInput from '../components/NumberInput'
import { num } from '../lib/format'
import { rowNumber } from '../lib/pagination'
import { levelXpTable } from '../lib/progression'
import { FREE_PACE_LEVEL } from '../lib/pacePlans'
import { notify } from '../lib/notify'
import './admin.css'
// Charts load only when the dashboard is opened.
const AdminDashboard = lazy(() => import('../components/AdminDashboard'))
import { LuUsers, LuSettings, LuMessageCircle, LuHistory, LuShield, LuFlag, LuLayoutDashboard, LuFootprints } from 'react-icons/lu'
import { REPORT_REASONS } from '../lib/chat'
import { api } from '../lib/api'
import { configureSettings, normalizeSettings, DEFAULT_SETTINGS, SETTING_FIELDS } from '../lib/settings'
import { SUPPORT_TYPES, SUPPORT_STATUS } from './Support'

const TABS = [['dashboard', '대시보드', LuLayoutDashboard], ['members', '회원 관리', LuUsers], ['runs', '러닝 기록', LuFootprints], ['support', '문의 관리', LuMessageCircle], ['reports', '채팅 관리', LuFlag], ['settings', '러닝과 경험치 설정', LuSettings], ['audit', '변경 이력', LuHistory]]
const date = value => value ? new Date(value).toLocaleString('ko-KR') : '없음'
const CHAT_FILTERS = [['', '전체 메시지'], ['reported', '신고된 메시지'], ['anonymous', '익명 러너'], ['suspended', '정지된 작성자']]
const SAVED_RUN_TYPES = [['', '전체 기록'], ['normal', '정상 기록'], ['completed', '완주'], ['partial', '중간 종료'], ['practice', '체험 처리'], ['auto', 'AUTO 사용']]
const ACTIVE_RUN_TYPES = [['', '진행 중 전체'], ['stale', '24시간 초과']]
const ACTIONS = { run_closed: '러닝 강제 종료', xp: '경험치 조정', suspend: '계정 이용 정지', restore: '계정 이용 복원', settings: '러닝 설정 변경', support_reply: '문의 답변', chat_remove: '채팅 삭제', chat_dismiss: '신고 기각', account_deleted: '계정 삭제·탈퇴', test_account_created: '테스트 계정 생성', admin_grant: '관리자 지정', admin_revoke: '관리자 해제', password_reset: '비밀번호 초기화' }
const REPORT_STATUS = { open: '처리 대기', removed: '삭제함', dismissed: '기각함' }

export default function Admin({ confirmAction, currentUserId }) {
  const [creatingTest, setCreatingTest] = useState(false)
  const [tab, setTab] = useState('dashboard')
  const [data, setData] = useState(null)
  const [settings, setSettings] = useState(null)
  const [draft, setDraft] = useState(null)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [reportFilter, setReportFilter] = useState('open')
  const [page, setPage] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const [selected, setSelected] = useState(null)
  const [memberRuns, setMemberRuns] = useState(null)
  const [memberType, setMemberType] = useState('')
  const [memberStatus, setMemberStatus] = useState('')
  const [memberAction, setMemberAction] = useState('details')
  const [runQuery, setRunQuery] = useState('')
  const [runSearch, setRunSearch] = useState('')
  const [runType, setRunType] = useState('')
  const [runView, setRunView] = useState('saved')
  const [chatView, setChatView] = useState('reports')
  const [chatQuery, setChatQuery] = useState('')
  const [chatSearch, setChatSearch] = useState('')
  const [chatFilter, setChatFilter] = useState('')
  const [runsError, setRunsError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const dirty = settings && draft && JSON.stringify(draft) !== JSON.stringify(settings.value)
  useEffect(() => {
    let live = true
    setLoading(true); setError(''); setSelected(null)
    if (tab === 'dashboard') { setLoading(false); return () => { live = false } }
    const load = tab === 'members' ? api.adminMembers(search, page, memberType, memberStatus) : tab === 'runs' ? api.adminRunRecords(runSearch, page, runType, runView) : tab === 'support' ? api.adminSupport(filter, page) : tab === 'reports' ? (chatView === 'messages' ? api.adminChatMessages(chatSearch, page, chatFilter) : api.adminChatReports(reportFilter, page)) : tab === 'audit' ? api.adminAudit(page) : api.getSettings()
    load.then(value => {
      if (!live) return
      if (tab === 'settings') { setSettings(value); setDraft(normalizeSettings(value.value)) }
      else setData(value)
    }).catch(err => { if (live) setError(err.message || '불러오지 못했어요.') }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [tab, search, filter, reportFilter, page, refresh, memberType, memberStatus, runSearch, runType, runView, chatView, chatSearch, chatFilter])
  const changeTab = async (next) => {
    if (busy || next === tab) return
    if (dirty && !await confirmAction({ title: '관리 메뉴를 이동할까요?', description: '저장하지 않은 변경사항은 사라져요.' })) return
    setData(null); setTab(next); setPage(0); setSelected(null)
  }
  const applyMemberAction = async (action, value, actionReason) => {
    setBusy(true)
    try {
      if (action === 'delete') await api.adminDeleteMember(selected.id, value, actionReason)
      else if (action === 'reset-password') await api.adminResetPassword(selected.id, actionReason)
      else if (action === 'grant-admin' || action === 'revoke-admin') await api.adminSetAdmin(selected.id, action === 'grant-admin', actionReason)
      else await api.adminMemberAction(selected.id, action, action === 'xp' ? value : null, actionReason)
      setSelected(null); notify.success(action === 'delete' ? '계정을 삭제했어요.' : action === 'grant-admin' ? '관리자로 지정했어요.' : action === 'revoke-admin' ? '관리자 권한을 해제했어요.' : action === 'reset-password' ? '비밀번호를 rundash123! 로 초기화했어요. 회원에게 로그인 후 변경하도록 안내해 주세요.' : '회원 정보를 변경했어요.'); setRefresh(v => v + 1)
    } finally { setBusy(false) }
  }
  const saveSettings = async (event) => {
    event.preventDefault()
    if (busy || !dirty) return
    if (!await confirmAction({ title: '러닝 설정을 적용할까요?', description: '다음에 시작하는 러닝부터 새 설정을 사용합니다. 경험치 곡선을 바꾸면 기존 회원의 표시 레벨도 달라질 수 있어요.', confirmLabel: '설정 적용' })) return
    setBusy(true); setError('')
    try { const version = await api.adminSaveSettings(draft, settings.version); configureSettings(draft); setSettings({ ...settings, value: structuredClone(draft), version }); notify.success(`설정 버전 ${version}을 적용했어요.`) } catch (err) { notify.error(err.message || '처리하지 못했어요. 다시 시도해 주세요.') } finally { setBusy(false) }
  }
  // Called from the modals; a thrown error stays in the modal so the admin can retry.
  const saveReply = async (nextStatus, nextReply) => {
    setBusy(true)
    try { await api.adminReply(selected.id, nextStatus, nextReply); setSelected(null); notify.success('문의 답변을 저장했어요.'); setRefresh(v => v + 1) }
    finally { setBusy(false) }
  }
  const closeRun = async (closeReason) => {
    setBusy(true)
    try { await api.adminCloseRun(selected.id, closeReason); setSelected(null); notify.success('러닝을 종료했어요. 경험치 없이 체험 기록으로 처리됐어요.'); setRefresh(v => v + 1) }
    finally { setBusy(false) }
  }
  const deleteMessage = async (deleteReason, suspendAuthor) => {
    setBusy(true)
    try { const result = await api.adminDeleteChatMessage(selected.id, deleteReason, suspendAuthor); setSelected(null); notify.success(result?.suspended ? '메시지를 삭제하고 작성자를 이용 정지했어요.' : '메시지를 삭제했어요.'); setRefresh(v => v + 1) }
    finally { setBusy(false) }
  }
  const resolveReport = async (action, decisionReason) => {
    setBusy(true)
    try { await api.adminResolveChatReport(selected.message_id, action, decisionReason); setSelected(null); notify.success(action === 'remove' ? '메시지를 삭제했어요.' : '신고를 기각했어요.'); setRefresh(v => v + 1) }
    finally { setBusy(false) }
  }
  const editLevel = (index, key, value) => setDraft(old => ({ ...old, levels: old.levels.map((row, i) => i === index ? { ...row, [key]: value } : row) }))
  useEffect(() => {
    let live = true
    setMemberRuns(null); setRunsError('')
    if (tab === 'members' && selected && memberAction === 'details') api.adminMemberRuns(selected.id).then(value => { if (live) setMemberRuns(value) }).catch(() => { if (live) setRunsError('회원의 러닝 기록을 불러오지 못했어요.') })
    return () => { live = false }
  }, [tab, selected?.id, memberAction])
  return <div className="admin-screen"><div className="mypage-layout admin-layout">
    <aside className="card mypage-sidebar admin-sidebar"><h1 className="admin-sidebar-heading"><LuShield /> 관리자 페이지</h1><nav aria-label="관리자 메뉴">{TABS.map(([id, label, Icon]) => <button type="button" key={id} disabled={busy} className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => changeTab(id)}><Icon />{label}</button>)}</nav></aside>
    <section className="admin-content">
      <header className="admin-content-header"><h2>{(() => { const [, label, Icon] = TABS.find(([id]) => id === tab); return <><Icon aria-hidden="true" />{label}</> })()}</h2></header>
      <div className="admin-content-body">
      {error && <p className="error" role="alert">{error}</p>}
      {tab === 'dashboard' && <Suspense fallback={<p role="status">대시보드를 불러오고 있어요…</p>}><AdminDashboard onNavigate={changeTab} /></Suspense>}
      {tab === 'members' && <>
        <div className="admin-kpis" aria-label="전체 계정 요약">{[['total','전체 계정'],['members','회원 계정'],['anonymous','익명 러너'],['suspended','이용 정지'],['test','테스트 계정']].map(([key,label]) => <section key={key}><span>{label}</span><strong>{data?.summary ? num(data.summary[key]) : '…'}<small>명</small></strong></section>)}</div>
        <form className="admin-toolbar" onSubmit={e => { e.preventDefault(); setSearch(query.trim()); setPage(0); setRefresh(v => v + 1) }}>
          <label className="sr-only" htmlFor="member-search">이메일 또는 닉네임 검색</label>
          <input id="member-search" className="admin-toolbar-search" value={query} disabled={busy} onChange={e => setQuery(e.target.value)} maxLength={100} placeholder="이메일 또는 닉네임 검색" />
          <label className="sr-only" htmlFor="member-type">가입 유형</label>
          <select id="member-type" value={memberType} disabled={busy} onChange={e => { setMemberType(e.target.value); setPage(0) }}><option value="">가입 유형 전체</option><option value="member">회원</option><option value="test">테스트</option><option value="anonymous">익명</option></select>
          <label className="sr-only" htmlFor="member-status">계정 상태</label>
          <select id="member-status" value={memberStatus} disabled={busy} onChange={e => { setMemberStatus(e.target.value); setPage(0) }}><option value="">계정 상태 전체</option><option value="active">정상</option><option value="suspended">이용 정지</option></select>
          <button className="btn primary" disabled={busy || loading}>검색</button>
          <button type="button" className="btn ghost admin-toolbar-create" disabled={busy} onClick={() => { setCreatingTest(true) }}>테스트 계정 만들기</button>
        </form></>}
      {tab === 'support' && <div className="admin-toolbar"><label className="sr-only" htmlFor="support-status">문의 상태</label><select id="support-status" value={filter} disabled={busy} onChange={e => { setFilter(e.target.value); setPage(0) }}><option value="">문의 상태 전체</option>{Object.entries(SUPPORT_STATUS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></div>}
      {tab === 'runs' && <form className="admin-toolbar" onSubmit={e => { e.preventDefault(); setRunSearch(runQuery.trim()); setPage(0); setRefresh(v => v + 1) }}>
        <label className="sr-only" htmlFor="run-view">기록 종류</label>
        <select id="run-view" value={runView} disabled={busy} onChange={e => { setData(null); setRunView(e.target.value); setRunType(''); setPage(0) }}><option value="saved">저장된 러닝</option><option value="active">진행 중인 러닝</option></select>
        <label className="sr-only" htmlFor="run-type">기록 필터</label>
        <select id="run-type" value={runType} disabled={busy} onChange={e => { setRunType(e.target.value); setPage(0) }}>{(runView === 'saved' ? SAVED_RUN_TYPES : ACTIVE_RUN_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <label className="sr-only" htmlFor="run-search">닉네임 검색</label>
        <input id="run-search" className="admin-toolbar-search" value={runQuery} disabled={busy} onChange={e => setRunQuery(e.target.value)} maxLength={100} placeholder="닉네임 검색" />
        <button className="btn primary" disabled={busy || loading}>검색</button>
      </form>}
      {tab === 'reports' && <form className="admin-toolbar" onSubmit={e => { e.preventDefault(); setChatSearch(chatQuery.trim()); setPage(0); setRefresh(v => v + 1) }}>
        <label className="sr-only" htmlFor="chat-view">채팅 보기</label>
        <select id="chat-view" value={chatView} disabled={busy} onChange={e => { setData(null); setChatView(e.target.value); setPage(0) }}><option value="reports">신고 내역</option><option value="messages">전체 메시지</option></select>
        {chatView === 'reports' ? <><label className="sr-only" htmlFor="report-status">처리 상태</label><select id="report-status" value={reportFilter} disabled={busy} onChange={e => { setReportFilter(e.target.value); setPage(0) }}><option value="">처리 상태 전체</option>{Object.entries(REPORT_STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></>
          : <><label className="sr-only" htmlFor="chat-filter">메시지 필터</label><select id="chat-filter" value={chatFilter} disabled={busy} onChange={e => { setChatFilter(e.target.value); setPage(0) }}>{CHAT_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <label className="sr-only" htmlFor="chat-search">메시지 또는 닉네임 검색</label><input id="chat-search" className="admin-toolbar-search" value={chatQuery} disabled={busy} onChange={e => setChatQuery(e.target.value)} maxLength={100} placeholder="메시지 또는 닉네임 검색" />
          <button className="btn primary" disabled={busy || loading}>검색</button></>}
      </form>}
      {loading && !data && tab !== 'settings' ? <p role="status">불러오고 있어요…</p> : loading && tab === 'settings' ? <p role="status">불러오고 있어요…</p> : <div className={`admin-results${loading ? ' loading' : ''}`} aria-busy={loading}>
      {tab === 'reports' && chatView === 'messages' && data?.summary?.all !== undefined && <><div className="admin-kpis" aria-label="채팅 요약">{[['all','전체 메시지','개'],['today','오늘 메시지','개'],['reported','처리 대기 신고','건'],['authors','최근 7일 작성자','명']].map(([key,label,unit]) => <section key={key}><span>{label}</span><strong>{num(data.summary[key])}<small>{unit}</small></strong></section>)}</div>
        <p className="admin-count">검색 결과 {num(data.total)}개</p><div className="admin-table-wrap" role="region" aria-label="전체 채팅 메시지" tabIndex={0}><table className="admin-table chat-table"><thead><tr><th scope="col">작성 일시</th><th scope="col">작성자</th><th scope="col">메시지</th><th scope="col">신고</th><th scope="col">관리</th></tr></thead>
        <tbody>{data.items.map(item => <tr key={item.id} className={[item.open_reports > 0 && 'reported-row', selected?.id === item.id && 'selected'].filter(Boolean).join(' ')}>
          <td>{date(item.created_at)}</td><td>{item.nickname}{item.author_admin ? <span className="admin-badge accent">관리자</span> : item.is_test ? <span className="admin-badge test">테스트</span> : item.is_anonymous ? <span className="admin-badge neutral">익명</span> : null}{item.author_suspended && <span className="admin-badge negative">정지</span>}</td>
          <td className="report-message">{item.message}</td><td className="numeric-cell">{item.open_reports ? `${num(item.open_reports)}건` : '-'}</td>
          <td><button className="btn ghost" disabled={busy} onClick={() => setSelected(item)}>삭제</button></td></tr>)}
        {!data.items.length && <tr><td colSpan={5} className="empty-cell">해당하는 메시지가 없어요.</td></tr>}</tbody></table></div>
        {selected && <AdminChatMessageModal key={selected.id} message={selected} busy={busy} onClose={() => setSelected(null)} onDelete={deleteMessage} />}</>}
      {tab === 'reports' && chatView === 'reports' && data && <><p className="admin-count">전체 {num(data.total)}건</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">상태</th><th scope="col">작성자</th><th scope="col">메시지</th><th scope="col">사유</th><th scope="col">신고 수</th><th scope="col">최근 신고</th><th scope="col">관리</th></tr></thead><tbody>{data.items.map(item => <tr key={item.message_id} className={selected?.message_id === item.message_id ? 'selected' : ''}>
<td>{REPORT_STATUS[item.status]}</td><td>{item.author_nickname}{item.author_suspended && ' (정지됨)'}</td><td className="report-message">{item.message}</td><td>{item.reasons.map(r => REPORT_REASONS[r] || r).join(', ')}</td><td className="numeric-cell">{num(item.report_count)}건</td><td>{date(item.last_reported_at)}</td>
<td><button className="btn ghost" disabled={busy} onClick={() => setSelected(item)}>{item.status === 'open' ? '처리하기' : '보기'}</button></td></tr>)}</tbody></table></div>{!data.items.length && <p className="account-empty">해당하는 신고가 없어요.</p>}
      {selected && <AdminReportModal key={selected.message_id} report={selected} busy={busy} onClose={() => setSelected(null)} onResolve={resolveReport} />}</>}
      {tab === 'runs' && data && runView === 'saved' && data.summary?.all !== undefined && <><div className="admin-kpis" aria-label="러닝 기록 요약">{[['all','전체 기록','회'],['completed','완주','회'],['practice','체험 처리','회'],['auto','AUTO 사용','회']].map(([key,label,unit]) => <section key={key}><span>{label}</span><strong>{num(data.summary[key])}<small>{unit}</small></strong></section>)}</div>
        <p className="admin-count">검색 결과 {num(data.total)}건</p><div className="admin-table-wrap" role="region" aria-label="러닝 기록" tabIndex={0}><table className="admin-table run-table"><thead><tr><th scope="col">저장 일시</th><th scope="col">러너</th><th scope="col">거리</th><th scope="col">시간</th><th scope="col">페이스</th><th scope="col">강도</th><th scope="col">점수</th><th scope="col">경험치</th><th scope="col">결과</th><th scope="col">관리</th></tr></thead>
        <tbody>{data.items.map(run => { const d = run.details || {}; return <tr key={run.id} className={[d.practice && 'practice-row', selected?.id === run.id && 'selected'].filter(Boolean).join(' ')}>
          <td>{date(run.created_at)}</td><td>{run.nickname}{run.is_test && <span className="admin-badge test">테스트</span>}</td>
          <td className="numeric-cell">{num(d.distanceKm || 0, 2)} km</td><td className="numeric-cell">{fmtTime(d.elapsedSec || 0)}</td><td className="numeric-cell">{d.paceSec ? fmtPace(d.paceSec) : '-'}</td>
          <td>{INTENSITY_LABELS[d.intensity] || d.intensity || '-'}</td><td className="numeric-cell">{num(d.score || 0)}</td><td className="numeric-cell">{num(d.growth?.xpEarned || 0)} XP</td>
          <td className="status-cell"><span className={`admin-badge ${d.practice ? 'negative' : d.completed ? 'accent' : 'neutral'}`}>{d.practice ? '체험 처리' : d.completed ? '완주' : '중간 종료'}</span>{d.autoUsed && <span className="admin-badge neutral">AUTO</span>}</td>
          <td><button className="btn ghost" disabled={busy} onClick={() => setSelected(run)}>상세 보기</button></td></tr> })}
        {!data.items.length && <tr><td colSpan={10} className="empty-cell">해당하는 러닝 기록이 없어요.</td></tr>}</tbody></table></div>
        {selected && <AdminRunModal key={selected.id} run={selected} mode="detail" busy={busy} onClose={() => setSelected(null)} />}</>}
      {tab === 'runs' && data && runView === 'active' && data.summary?.open !== undefined && <><div className="admin-kpis" aria-label="진행 중인 러닝 요약">{[['open','진행 중','건'],['stale','24시간 초과','건']].map(([key,label,unit]) => <section key={key}><span>{label}</span><strong>{num(data.summary[key])}<small>{unit}</small></strong></section>)}</div>
        <p className="admin-count">검색 결과 {num(data.total)}건</p><div className="admin-table-wrap" role="region" aria-label="진행 중인 러닝" tabIndex={0}><table className="admin-table run-table"><thead><tr><th scope="col">시작 일시</th><th scope="col">러너</th><th scope="col">목표</th><th scope="col">경과</th><th scope="col">현재 거리</th><th scope="col">강도</th><th scope="col">상태</th><th scope="col">관리</th></tr></thead>
        <tbody>{data.items.map(run => { const live = run.location_at && Date.now() - Date.parse(run.location_at) < 120000; return <tr key={run.id} className={[run.stale && 'practice-row', selected?.id === run.id && 'selected'].filter(Boolean).join(' ')}>
          <td>{date(run.started_at)}</td><td>{run.nickname}{run.is_test && <span className="admin-badge test">테스트</span>}</td>
          <td className="numeric-cell">{num(run.target_km)} km</td><td className="numeric-cell">{fmtTime((Date.now() - Date.parse(run.started_at)) / 1000)}</td>
          <td className="numeric-cell">{run.distance_m === null ? '-' : `${num(run.distance_m / 1000, 2)} km`}</td><td>{INTENSITY_LABELS[run.intensity] || run.intensity}</td>
          <td className="status-cell"><span className={`admin-badge ${run.stale ? 'negative' : live ? 'accent' : 'neutral'}`}>{run.stale ? '24시간 초과' : live ? (run.paused ? '일시정지' : '달리는 중') : '연결 없음'}</span></td>
          <td><button className="btn ghost" disabled={busy} onClick={() => setSelected(run)}>러닝 종료</button></td></tr> })}
        {!data.items.length && <tr><td colSpan={8} className="empty-cell">진행 중인 러닝이 없어요.</td></tr>}</tbody></table></div>
        {selected && <AdminRunModal key={selected.id} run={selected} mode="close" busy={busy} onClose={() => setSelected(null)} onCloseRun={closeRun} />}</>}
      {tab === 'members' && data && <><p className="admin-count">전체 {num(data.total)}명</p><div className="admin-table-wrap member-table-wrap" role="region" aria-label="회원 목록" tabIndex={0}>
        <table className="admin-table member-table">
          <caption className="sr-only">회원 기본정보와 러닝 현황</caption>
          <thead><tr>{['No', '닉네임', '이메일', '가입 유형', '권한', '계정 상태', '경험치', '누적 거리', '러닝 횟수', '가입일', '최근 접속', '관리'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{data.items.map((member,index) => <tr key={member.id} className={[member.admin && 'admin-row', selected?.id === member.id && 'selected'].filter(Boolean).join(' ')}>
            <td className="numeric-cell">{rowNumber(page, index)}</td>
            <td>{member.nickname || (member.is_anonymous ? '익명 러너' : '러너 생성 전')}</td>
            <td>{member.email || '이메일 미등록'}</td>
            <td className="status-cell"><span className={`admin-badge ${member.is_test ? 'test' : member.is_anonymous ? 'neutral' : 'positive'}`}>{member.is_test ? '테스트' : member.is_anonymous ? '익명' : '회원'}</span></td>
            <td className="status-cell"><span className={`admin-badge ${member.admin ? 'accent' : 'neutral'}`}>{member.admin ? '관리자' : '일반'}</span></td>
            <td className="status-cell"><span className={`admin-badge ${member.suspended ? 'negative' : 'positive'}`}>{member.suspended ? '이용 정지' : '정상'}</span></td>
            <td className="numeric-cell">{num(member.xp)} XP</td>
            <td className="numeric-cell">{num(member.total_distance_km, 2)} km</td>
            <td className="numeric-cell">{num(member.run_count)}회</td>
            <td><time dateTime={member.created_at}>{date(member.created_at)}</time></td>
            <td>{member.last_sign_in_at ? <time dateTime={member.last_sign_in_at}>{date(member.last_sign_in_at)}</time> : '접속 기록 없음'}</td>
            <td className="status-cell"><AdminActionMenu member={member} isSelf={member.id === currentUserId} disabled={busy} onSelect={action => { setMemberAction(action); setSelected(member) }} /></td>
          </tr>)}{!data.items.length && <tr><td colSpan={12} className="empty-cell">검색 결과가 없어요.</td></tr>}</tbody>
        </table>
      </div>
      {selected && <AdminMemberModal key={selected.id + memberAction} member={selected} action={memberAction} runs={memberRuns} runsError={runsError} busy={busy} onClose={() => setSelected(null)} onApply={applyMemberAction} />}
      {creatingTest && <AdminTestAccountModal onClose={() => setCreatingTest(false)} onCreated={(nickname) => { setCreatingTest(false); notify.success(`테스트 계정 ${nickname}을(를) 만들었어요. 이메일 인증 없이 바로 로그인할 수 있어요.`); setMemberType(''); setPage(0); setRefresh(v => v + 1) }} />}</>}
      {tab === 'support' && data && <><p className="admin-count">전체 {num(data.total)}건</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">상태</th><th scope="col">유형</th><th scope="col">제목</th><th scope="col">작성자</th><th scope="col">접수일</th><th scope="col">관리</th></tr></thead><tbody>{data.items.map(ticket => <tr key={ticket.id}>
<td>{SUPPORT_STATUS[ticket.status]}</td><td>{SUPPORT_TYPES[ticket.category]}</td><td>{ticket.title}</td><td>{ticket.nickname || ticket.email || '익명 러너'}</td><td>{date(ticket.created_at)}</td>
<td><button className="btn ghost" disabled={busy} onClick={() => setSelected(ticket)}>문의 열기</button></td></tr>)}</tbody></table></div>{!data.items.length && <p className="account-empty">접수된 문의가 없어요.</p>}{selected && <AdminSupportModal key={selected.id} ticket={selected} busy={busy} onClose={() => setSelected(null)} onSave={saveReply} />}</>}
      {tab === 'audit' && data && <><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">변경 일시</th><th scope="col">작업</th><th scope="col">관리자</th><th scope="col">대상</th><th scope="col">상세</th></tr></thead><tbody>{data.items.map(item => <tr key={item.id}><td>{date(item.created_at)}</td><td>{ACTIONS[item.action] || item.action}</td><td>{item.actor}</td><td>{item.target}</td><td><details><summary>변경 내용</summary><pre className="audit-details">{JSON.stringify(item.details, null, 2)}</pre></details></td></tr>)}</tbody></table></div>{!data.items.length && <p>아직 변경 이력이 없어요.</p>}</>}
      {tab === 'settings' && draft && <form onSubmit={saveSettings}><p className="admin-settings-note">현재 버전 {settings.version}. 새 설정은 다음 러닝부터 적용됩니다. 진행 중인 러닝은 시작 시 설정을 유지해요.</p><fieldset disabled={busy}>
        {Array.from(new Set(SETTING_FIELDS.map(([group]) => group))).map(group => <section className="settings-group" key={group}><h3>{group}</h3><div className="admin-table-wrap"><table className="admin-table settings-table"><colgroup><col className="settings-col-label" /><col className="settings-col-range" /><col className="settings-col-value" /></colgroup><thead><tr><th scope="col">설정 항목</th><th scope="col">허용 범위</th><th scope="col">설정값</th></tr></thead><tbody>{SETTING_FIELDS.filter(([g]) => g === group).map(([,key,label,min,max,step]) => <tr key={key}><th scope="row">{label}</th><td className="numeric-cell">{num(min)} ~ {num(max)}</td><td><NumberInput aria-label={label} required min={min} max={max} step={step} value={draft[key]} onChange={value => setDraft({ ...draft, [key]: value })} /></td></tr>)}</tbody></table></div></section>)}
        <section className="settings-group"><h3>레벨별 필요 경험치</h3><p>거리는 1km당 평균 경험치와 완주 보너스 기준이며 점수 보너스는 포함하지 않아요. 누적 경험치는 아래 레벨별 능력치 표에서 수정해요.</p><div className="admin-table-wrap level-table"><table className="admin-table xp-level-table"><thead><tr><th scope="col">레벨</th><th scope="col">누적 필요 경험치</th><th scope="col">이전 레벨에서 필요한 경험치</th><th scope="col">완주 기준 누적 거리 (약)</th><th scope="col">해금</th></tr></thead><tbody>{levelXpTable(draft).map(row => { const boost = draft.levels[row.level - 1]?.boost, before = draft.levels[row.level - 2]?.boost || 0; const unlocks = [boost > before && (before ? `부스터 ${boost}초` : `부스터 해금 ${boost}초`), row.level === FREE_PACE_LEVEL && '자유 페이스 설정', row.level === Number(draft.autoLevel) && 'AUTO 러닝'].filter(Boolean); return <tr key={row.level}><th scope="row">Lv.{row.level}</th><td className="numeric-cell">{num(row.xp)} XP</td><td className="numeric-cell">{row.level === 1 ? '시작' : `+${num(row.gap)} XP`}</td><td className="numeric-cell">{row.km === null ? '계산 불가' : `${num(row.km, undefined, 1)} km`}</td><td>{unlocks.join(' · ') || ''}</td></tr> })}</tbody></table></div></section>
        <section className="settings-group"><h3>러닝 강도 3가지</h3><p>기본 페이스에 추가할 시간과 체력 소모 배율이에요.</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">강도</th><th scope="col">이름</th><th scope="col">설명</th><th scope="col">추가 페이스 초/km</th><th scope="col">체력 소모 배율</th></tr></thead><tbody>{draft.intensities.map((effort,index) => <tr key={effort.id}><th scope="row">{effort.id}</th>{[['label','이름','text'],['description','설명','text'],['extraPace','추가 페이스 초/km','number'],['drain','체력 소모 배율','number']].map(([key,label,type]) => <td key={key}>{type === 'number' ? <NumberInput aria-label={effort.id + " " + label} required min={key === 'drain' ? .1 : 0} max={key === 'drain' ? 5 : 600} step={key === 'drain' ? .05 : 1} value={effort[key]} onChange={value => setDraft({ ...draft, intensities: draft.intensities.map((row,i) => i === index ? { ...row, [key]: value } : row) })} /> : <input aria-label={effort.id + " " + label} type={type} required maxLength={key === 'label' ? 20 : 100} min={key === 'drain' ? .1 : 0} max={key === 'drain' ? 5 : 600} step={key === 'drain' ? .05 : 1} value={effort[key]} onChange={e => setDraft({ ...draft, intensities: draft.intensities.map((row,i) => i === index ? { ...row, [key]: type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value } : row) })} />} </td>)}</tr>)}</tbody></table></div></section>
        <section className="settings-group"><h3>레벨별 능력치</h3><p>페이스는 초/km 단위예요. 부스터 지속 시간을 0으로 설정하면 해당 레벨에서는 사용할 수 없어요.</p><div className="admin-table-wrap level-table"><table className="admin-table"><thead><tr><th>레벨</th><th>누적 경험치</th><th>최대 페이스</th><th>최대 체력</th><th>회복 시간 초</th><th>부스터 초</th></tr></thead><tbody>{draft.levels.map((row,index) => <tr key={row.level}><th>Lv.{row.level}</th>{[['xp',0,1000000000000],['pace',180,1800],['stamina',10,1000],['recovery',5,300],['boost',0,60]].map(([key,min,max]) => <td key={key}><NumberInput aria-label={`레벨 ${row.level} ${key}`} min={min} max={max} step={1} required readOnly={key === 'xp' && index === 0} value={row[key]} onChange={value => editLevel(index,key,value)} /></td>)}</tr>)}</tbody></table></div></section>
      </fieldset><div className="settings-save"><button type="button" className="btn ghost" disabled={busy} onClick={async () => { if (await confirmAction({ title: '기본값으로 되돌릴까요?', description: '입력값만 초기화됩니다. 적용하려면 설정 저장을 눌러주세요.' })) setDraft(normalizeSettings(DEFAULT_SETTINGS)) }}>기본값 불러오기</button><button className="btn primary" disabled={busy || !dirty}>{busy ? '저장 중…' : '설정 저장'}</button></div></form>}
      {tab !== 'settings' && tab !== 'dashboard' && data && <Pagination page={page} total={data.total} disabled={busy || loading} onChange={setPage} label={`${TABS.find(([id]) => id === tab)[1]} 페이지`} />}

      </div>}
      </div>
    </section></div></div>
}
