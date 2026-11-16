import { useState } from 'react'
import Modal from 'react-modal'
import { LuX, LuShield } from 'react-icons/lu'
import { REPORT_REASONS } from '../lib/chat'

const STATUS = { open: '처리 대기', removed: '삭제함', dismissed: '기각함' }
const date = value => value ? new Date(value).toLocaleString('ko-KR') : '없음'

// Chat report review: header / body (message, report facts, reason) / footer (dismiss, remove).
export default function AdminReportModal({ report, busy, onClose, onResolve }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const open = report.status === 'open'
  const locked = busy || working
  const resolve = async (action) => {
    if (locked || reason.trim().length < 2) return
    setWorking(true); setError('')
    try { await onResolve(action, reason.trim()) }
    catch (err) { setError(err.message || '처리하지 못했어요. 다시 시도해 주세요.') }
    finally { setWorking(false) }
  }
  return <Modal isOpen onRequestClose={locked ? undefined : onClose}
    appElement={document.getElementById('root')} shouldCloseOnOverlayClick={false} shouldCloseOnEsc={!locked}
    className="admin-member-modal" overlayClassName="admin-modal-overlay" bodyOpenClassName="admin-modal-open"
    aria={{ labelledby: 'report-modal-title' }}>
    <header className="admin-modal-header"><h2 id="report-modal-title">{open ? '채팅 신고 처리' : '채팅 신고 내역'}</h2><button type="button" className="icon-btn" aria-label="닫기" disabled={locked} onClick={onClose}><LuX /></button></header>
    <form className="admin-modal-form" onSubmit={event => event.preventDefault()}>
      <div className="admin-modal-body">
        <p className="admin-quote-label">{report.author_nickname}님의 메시지</p>
        <blockquote className="admin-quote">{report.message}</blockquote>
        <dl className="admin-member-facts">
          <div><dt>처리 상태</dt><dd>{STATUS[report.status]}</dd></div>
          <div><dt>신고 수</dt><dd>{report.report_count}건</dd></div>
          <div><dt>신고 사유</dt><dd>{report.reasons.map(r => REPORT_REASONS[r] || r).join(', ')}</dd></div>
          <div><dt>채팅방 표시</dt><dd>{report.message_exists ? '표시 중' : '삭제됨'}</dd></div>
          <div><dt>작성</dt><dd>{date(report.message_created_at)}</dd></div>
          <div><dt>{report.resolved_at ? '처리' : '최근 신고'}</dt><dd>{date(report.resolved_at || report.last_reported_at)}</dd></div>
        </dl>
        {report.author_suspended && <p className="admin-action-warning">작성자는 현재 이용 정지 상태예요.</p>}
        {open ? <>
          <label className="field admin-modal-field"><span>처리 사유 (필수)</span><textarea rows={3} minLength={2} maxLength={500} value={reason} disabled={locked} onChange={e => setReason(e.target.value)} placeholder="사유를 2자 이상 입력하세요" /></label>
          <p className="admin-modal-note"><LuShield aria-hidden="true" /> 메시지를 삭제하면 모든 러너의 채팅방에서 사라져요. 작성자 이용 정지는 회원 관리에서 처리해 주세요.</p>
        </> : <p className="admin-modal-note">이미 처리된 신고예요.</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      <footer className="admin-modal-footer">
        {open ? <>
          <button type="button" className="btn ghost" disabled={locked || reason.trim().length < 2} onClick={() => resolve('dismiss')}>신고 기각</button>
          <button type="button" className="btn danger" disabled={locked || reason.trim().length < 2} onClick={() => resolve('remove')}>{working ? '처리 중…' : '메시지 삭제'}</button>
        </> : <button type="button" className="btn primary" onClick={onClose}>닫기</button>}
      </footer>
    </form>
  </Modal>
}
