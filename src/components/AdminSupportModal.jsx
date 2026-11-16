import { useState } from 'react'
import Modal from 'react-modal'
import { LuX } from 'react-icons/lu'
import { SUPPORT_STATUS, SUPPORT_TYPES } from '../screens/Support'

const date = value => value ? new Date(value).toLocaleString('ko-KR') : '없음'

// Support ticket reply: header / body (inquiry, status, reply) / footer (cancel, save).
export default function AdminSupportModal({ ticket, busy, onClose, onSave }) {
  const [status, setStatus] = useState(ticket.status)
  const [reply, setReply] = useState(ticket.reply || '')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const locked = busy || working
  const valid = status !== 'resolved' || reply.trim().length > 0
  const submit = async event => {
    event.preventDefault()
    if (locked || !valid) return
    setWorking(true); setError('')
    try { await onSave(status, reply) }
    catch (err) { setError(err.message || '저장하지 못했어요. 다시 시도해 주세요.') }
    finally { setWorking(false) }
  }
  return <Modal isOpen onRequestClose={locked ? undefined : onClose}
    appElement={document.getElementById('root')} shouldCloseOnOverlayClick={false} shouldCloseOnEsc={!locked}
    className="admin-member-modal" overlayClassName="admin-modal-overlay" bodyOpenClassName="admin-modal-open"
    aria={{ labelledby: 'support-modal-title' }}>
    <header className="admin-modal-header"><h2 id="support-modal-title">문의 답변</h2><button type="button" className="icon-btn" aria-label="닫기" disabled={locked} onClick={onClose}><LuX /></button></header>
    <form className="admin-modal-form" onSubmit={submit}>
      <div className="admin-modal-body">
        <dl className="admin-member-facts">
          <div><dt>유형</dt><dd>{SUPPORT_TYPES[ticket.category]}</dd></div>
          <div><dt>작성자</dt><dd>{ticket.nickname || ticket.email || '익명 러너'}</dd></div>
          <div><dt>접수일</dt><dd>{date(ticket.created_at)}</dd></div>
          <div><dt>현재 상태</dt><dd>{SUPPORT_STATUS[ticket.status]}</dd></div>
        </dl>
        <p className="admin-quote-label">{ticket.title}</p>
        <blockquote className="admin-quote">{ticket.body}</blockquote>
        <label className="field admin-modal-field"><span>처리 상태</span><select value={status} disabled={locked} onChange={e => setStatus(e.target.value)}>{Object.entries(SUPPORT_STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="field admin-modal-field"><span>답변{status === 'resolved' ? ' (필수)' : ''}</span><textarea rows={6} maxLength={4000} value={reply} disabled={locked} onChange={e => setReply(e.target.value)} placeholder="문의한 회원에게 보일 답변을 입력하세요" /><small>{reply.length} / 4000</small></label>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      <footer className="admin-modal-footer"><button type="button" className="btn ghost" disabled={locked} onClick={onClose}>취소</button><button className="btn primary" disabled={locked || !valid}>{working ? '저장 중…' : '답변과 상태 저장'}</button></footer>
    </form>
  </Modal>
}
