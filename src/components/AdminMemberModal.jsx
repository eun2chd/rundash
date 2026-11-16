import { useState } from 'react'
import Modal from 'react-modal'
import { LuX, LuShield, LuKeyRound } from 'react-icons/lu'

export const TEMP_PASSWORD = 'rundash123!'
const TITLES = { details: '회원 상세 정보', xp: '경험치 조정', suspend: '이용 정지', restore: '이용 복원', delete: '계정 삭제', 'grant-admin': '관리자로 지정', 'revoke-admin': '관리자 해제', 'reset-password': '비밀번호 초기화' }
const DESCRIPTIONS = {
  details: '계정 상태와 최근 러닝 기록이에요.',
  xp: '추가할 경험치가 아니라 변경 후 총 경험치를 입력하세요. 표시 레벨과 해금 기능도 다시 계산됩니다.',
  'grant-admin': '관리자 페이지에 접근해 회원, 문의, 신고, 설정을 관리할 수 있게 됩니다. 랭킹에서도 제외돼요.',
  'revoke-admin': '관리자 페이지 접근 권한을 해제합니다. 계정과 기록은 그대로 유지돼요.',
  delete: '계정과 모든 기록을 영구 삭제합니다. 되돌릴 수 없어요.',
  suspend: '이용 정지 후 러닝 시작, 보상 저장, 프로필 변경과 채팅 전송이 제한됩니다. 문의 접수는 가능합니다.',
  restore: '이용 제한을 해제합니다. 기존 기록과 경험치는 유지됩니다.',
  'reset-password': `비밀번호를 임시 비밀번호 ${TEMP_PASSWORD} 로 초기화합니다.`,
}
const date = value => value ? new Date(value).toLocaleString('ko-KR') : '접속 기록 없음'

function blockReason(action, member) {
  if (action === 'xp') return !member.nickname ? '러너 생성 후 경험치를 변경할 수 있어요.' : member.active_run_id ? '진행 중인 러닝이 끝난 후 변경할 수 있어요.' : ''
  if (action === 'grant-admin') return member.is_anonymous || !member.email ? '이메일로 가입한 회원만 관리자로 지정할 수 있어요.' : member.suspended ? '이용 정지된 계정은 관리자로 지정할 수 없어요.' : ''
  if (action === 'reset-password') return member.is_anonymous || !member.email ? '이메일로 가입한 계정만 비밀번호를 초기화할 수 있어요.' : member.admin ? '관리자 계정의 비밀번호는 초기화할 수 없어요.' : ''
  if (action === 'revoke-admin') return ''
  if (member.admin) return action === 'delete' ? '관리자 계정은 삭제할 수 없어요. 먼저 관리자 권한을 해제해 주세요.' : '관리자 계정은 이용 정지·복원 대상이 아닙니다.'
  return ''
}

// Admin member dialog. Layout: header (title, close) / scrolling body / footer (actions).
export default function AdminMemberModal({ member, action, runs, runsError, busy, onClose, onApply }) {
  const [reason, setReason] = useState('')
  const [xp, setXp] = useState(String(member.xp || 0))
  const [error, setError] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const working = busy || submitting
  const validXp = xp !== '' && Number.isInteger(Number(xp)) && Number(xp) >= 0 && Number(xp) <= 1000000000
  const blocked = blockReason(action, member)
  const confirmed = action !== 'delete' || confirmText.trim() === '삭제'
  const ready = !working && !blocked && confirmed && reason.trim().length >= 2 && (action !== 'xp' || validXp)
  const submit = async event => {
    event.preventDefault()
    if (!ready) return
    setSubmitting(true); setError('')
    try { await onApply(action, action === 'delete' ? confirmText.trim() : Number(xp), reason.trim()) }
    catch (err) { setError(err.message || '변경하지 못했어요. 다시 시도해 주세요.') }
    finally { setSubmitting(false) }
  }
  const identity = <div className="admin-member-identity"><span className="admin-avatar">{member.is_anonymous ? '익' : (member.nickname || '회원').slice(0, 1)}</span><div><strong>{member.nickname || (member.is_anonymous ? '익명 러너' : '러너 생성 전')}</strong><p>{member.email || '이메일 미등록'}</p></div></div>
  const description = <p id="member-modal-description" className="admin-modal-description">{DESCRIPTIONS[action]}</p>
  return <Modal isOpen onRequestClose={working ? undefined : onClose}
    appElement={document.getElementById('root')} shouldCloseOnOverlayClick={false} shouldCloseOnEsc={!working}
    className="admin-member-modal" overlayClassName="admin-modal-overlay" bodyOpenClassName="admin-modal-open"
    aria={{ labelledby: 'member-modal-title', describedby: 'member-modal-description' }}>
    <header className="admin-modal-header"><h2 id="member-modal-title">{TITLES[action]}</h2><button type="button" className="icon-btn" aria-label="닫기" disabled={working} onClick={onClose}><LuX /></button></header>
    {action === 'details' ? <>
      <div className="admin-modal-body">
        {identity}{description}
        <dl className="admin-member-facts"><div><dt>가입 유형</dt><dd>{member.is_test ? '테스트' : member.is_anonymous ? '익명' : '회원'}</dd></div><div><dt>계정 상태</dt><dd>{member.suspended ? '이용 정지' : '정상'}</dd></div><div><dt>총 경험치</dt><dd>{Number(member.xp).toLocaleString()} XP</dd></div><div><dt>누적 거리</dt><dd>{Number(member.total_distance_km).toFixed(2)} km</dd></div><div><dt>가입일</dt><dd>{date(member.created_at)}</dd></div><div><dt>최근 접속</dt><dd>{date(member.last_sign_in_at)}</dd></div></dl>
        {member.suspended && <p className="admin-action-warning">정지 사유: {member.reason || '기록 없음'}</p>}
        <section className="admin-modal-runs"><h3>최근 러닝 기록</h3>{runsError ? <p role="alert">{runsError}</p> : !runs ? <p role="status">러닝 기록을 불러오고 있어요…</p> : <><p>전체 {runs.total}건 중 최근 10건</p>{runs.items.map(run => <article className="member-run" key={run.id}><strong>{Number(run.details.distanceKm || 0).toFixed(2)}km · {run.details.completed ? '완주' : '중간 종료'}</strong><p>{date(run.created_at)} · {run.details.practice ? '개발 체험' : `+${run.details.growth?.xpEarned || 0} XP`}</p></article>)}{!runs.items.length && <p className="account-empty">저장된 러닝 기록이 없어요.</p>}</>}</section>
      </div>
      <footer className="admin-modal-footer"><button type="button" className="btn primary" onClick={onClose}>닫기</button></footer>
    </> : <form className="admin-modal-form" onSubmit={submit}>
      <div className="admin-modal-body">
        {identity}{description}
        {blocked && <p role="alert" className="admin-action-warning">{blocked}</p>}
        {action === 'reset-password' && !blocked && <div className="admin-reset-password"><LuKeyRound aria-hidden="true" /><div><strong>초기화 후 비밀번호</strong><code>{TEMP_PASSWORD}</code><p>회원에게 이 비밀번호로 로그인한 뒤 마이페이지에서 바로 새 비밀번호로 변경하도록 안내해 주세요. 로그인 중인 기기는 모두 로그아웃돼요.</p></div></div>}
        {action === 'delete' && !blocked && <div className="admin-delete-scope"><strong>함께 삭제되는 정보</strong><ul><li>로그인 계정과 러너 프로필</li><li>러닝 기록, 경험치, 출석 기록</li><li>채팅 메시지, 친구와 차단 목록, 문의 내역</li></ul><p>운영 기록에는 삭제 사실과 사유가 1년간 남아요.</p></div>}
        {action === 'xp' && <label className="field"><span>변경 후 총 경험치</span><input type="number" required min={0} max={1000000000} step={1} disabled={working || !!blocked} value={xp} onChange={e => setXp(e.target.value)} /><small>현재 {Number(member.xp).toLocaleString()} XP</small></label>}
        {action === 'delete' && <label className="field"><span>확인을 위해 <b>삭제</b>를 입력하세요</span><input value={confirmText} autoComplete="off" disabled={working || !!blocked} onChange={e => setConfirmText(e.target.value)} placeholder="삭제" /></label>}
        <label className="field"><span>{action === 'delete' ? '삭제 사유' : action === 'reset-password' ? '초기화 사유' : '변경 사유'} (필수)</span><textarea rows={3} required minLength={2} maxLength={500} disabled={working || !!blocked} value={reason} onChange={e => setReason(e.target.value)} placeholder="사유를 2자 이상 입력하세요" /></label>
        <p className="admin-modal-note"><LuShield aria-hidden="true" /> 사유는 운영 이력에 기록됩니다.</p>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      <footer className="admin-modal-footer"><button type="button" className="btn ghost" disabled={working} onClick={onClose}>취소</button><button className={`btn ${['suspend', 'delete'].includes(action) ? 'danger' : 'primary'}`} disabled={!ready}>{working ? '처리 중…' : action === 'delete' ? '영구 삭제' : action === 'reset-password' ? `${TEMP_PASSWORD} 로 초기화` : `${TITLES[action]} 적용`}</button></footer>
    </form>}
  </Modal>
}
