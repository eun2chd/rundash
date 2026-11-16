import { useState } from 'react'
import Modal from 'react-modal'
import { LuX, LuShield } from 'react-icons/lu'
import { num } from '../lib/format'

const date = value => value ? new Date(value).toLocaleString('ko-KR') : '없음'

// Delete any chat message, optionally suspending its author: header / body / footer.
export default function AdminChatMessageModal({ message, busy, onClose, onDelete }) {
  const [reason, setReason] = useState('')
  const [suspend, setSuspend] = useState(false)
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const locked = busy || working
  const canSuspend = !message.author_admin && !message.author_suspended
  const submit = async event => {
    event.preventDefault()
    if (locked || reason.trim().length < 2) return
    setWorking(true); setError('')
    try { await onDelete(reason.trim(), canSuspend && suspend) }
    catch (err) { setError(err.message || '삭제하지 못했어요. 다시 시도해 주세요.') }
    finally { setWorking(false) }
  }
  return <Modal isOpen onRequestClose={locked ? undefined : onClose}
    appElement={document.getElementById('root')} shouldCloseOnOverlayClick={false} shouldCloseOnEsc={!locked}
    className="admin-member-modal" overlayClassName="admin-modal-overlay" bodyOpenClassName="admin-modal-open"
    aria={{ labelledby: 'chat-message-modal-title' }}>
    <header className="admin-modal-header"><h2 id="chat-message-modal-title">채팅 메시지 삭제</h2><button type="button" className="icon-btn" aria-label="닫기" disabled={locked} onClick={onClose}><LuX /></button></header>
    <form className="admin-modal-form" onSubmit={submit}>
      <div className="admin-modal-body">
        <p className="admin-quote-label">{message.nickname}님의 메시지</p>
        <blockquote className="admin-quote">{message.message}</blockquote>
        <dl className="admin-member-facts">
          <div><dt>작성</dt><dd>{date(message.created_at)}</dd></div>
          <div><dt>계정</dt><dd>{message.author_admin ? '관리자' : message.is_test ? '테스트 계정' : message.is_anonymous ? '익명 러너' : '회원'}</dd></div>
          <div><dt>처리 대기 신고</dt><dd>{num(message.open_reports)}건</dd></div>
          <div><dt>작성자 상태</dt><dd>{message.author_suspended ? '이용 정지 중' : '정상'}</dd></div>
        </dl>
        <label className="field admin-modal-field"><span>처리 사유 (필수)</span><textarea rows={3} minLength={2} maxLength={500} value={reason} disabled={locked} onChange={e => setReason(e.target.value)} placeholder="사유를 2자 이상 입력하세요" /></label>
        <label className={`admin-check${canSuspend ? '' : ' disabled'}`}><input type="checkbox" checked={canSuspend && suspend} disabled={locked || !canSuspend} onChange={e => setSuspend(e.target.checked)} /><span>작성자도 이용 정지하기{message.author_admin ? ' (관리자 계정은 정지할 수 없어요)' : message.author_suspended ? ' (이미 정지된 계정이에요)' : ''}</span></label>
        <p className="admin-modal-note"><LuShield aria-hidden="true" /> 삭제하면 모든 러너의 채팅방에서 바로 사라지고, 이 메시지의 처리 대기 신고는 '삭제함'으로 정리돼요. 정지 사유는 처리 사유와 같아요.</p>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      <footer className="admin-modal-footer"><button type="button" className="btn ghost" disabled={locked} onClick={onClose}>취소</button><button className="btn danger" disabled={locked || reason.trim().length < 2}>{working ? '삭제 중…' : canSuspend && suspend ? '삭제하고 정지' : '메시지 삭제'}</button></footer>
    </form>
  </Modal>
}
