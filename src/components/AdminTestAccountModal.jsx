import { useState } from 'react'
import Modal from 'react-modal'
import { LuFlaskConical, LuX } from 'react-icons/lu'
import { api } from '../lib/api'
import { isValidPassword, PASSWORD_RULE } from '../lib/password'

const NICKNAME = /^[가-힣a-zA-Z0-9_]{2,10}$/

// Creates a QA account that can log in immediately (no email verification) and is left out of
// rankings and member statistics.
export default function AdminTestAccountModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ email: '', password: '', repeat: '', nickname: '' })
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const set = key => event => { setForm(previous => ({ ...previous, [key]: event.target.value })); setError('') }
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()) && isValidPassword(form.password) && form.password === form.repeat && NICKNAME.test(form.nickname.trim())
  const submit = async event => {
    event.preventDefault()
    if (working || !valid) return
    setWorking(true); setError('')
    try { await api.adminCreateTestAccount({ email: form.email.trim(), password: form.password, nickname: form.nickname.trim() }); onCreated(form.nickname.trim()) }
    catch (err) { setError(err.message || '테스트 계정을 만들지 못했어요.') }
    finally { setWorking(false) }
  }
  return <Modal isOpen onRequestClose={working ? undefined : onClose}
    appElement={document.getElementById('root')} shouldCloseOnOverlayClick={false} shouldCloseOnEsc={!working}
    className="admin-member-modal" overlayClassName="admin-modal-overlay" bodyOpenClassName="admin-modal-open"
    aria={{ labelledby: 'test-account-title' }}>
    <header className="admin-modal-heading"><div><p className="eyebrow">TEST ACCOUNT</p><h2 id="test-account-title">테스트 계정 만들기</h2></div><button type="button" className="icon-btn" aria-label="닫기" disabled={working} onClick={onClose}><LuX /></button></header>
    <div className="admin-test-scope"><LuFlaskConical aria-hidden="true" /><ul><li>이메일 인증 없이 바로 로그인할 수 있어요.</li><li>주간·월간·누적·레벨 랭킹과 회원 통계에 포함되지 않아요.</li><li>회원 목록에는 ‘테스트’로 표시되고, 다 쓰면 계정 삭제로 정리할 수 있어요.</li></ul></div>
    <form onSubmit={submit}>
      <label className="field"><span>이메일</span><input type="email" autoComplete="off" required value={form.email} disabled={working} onChange={set('email')} placeholder="qa1@example.com" /></label>
      <label className="field"><span>닉네임</span><input autoComplete="off" required minLength={2} maxLength={10} value={form.nickname} disabled={working} onChange={set('nickname')} placeholder="2~10자 · 한글, 영문, 숫자, _" /></label>
      <label className="field"><span>비밀번호</span><input type="password" autoComplete="new-password" required value={form.password} disabled={working} onChange={set('password')} /><small>{PASSWORD_RULE}</small></label>
      <label className="field"><span>비밀번호 확인</span><input type="password" autoComplete="new-password" required value={form.repeat} disabled={working} onChange={set('repeat')} />{form.repeat && form.password !== form.repeat && <small role="status">비밀번호가 서로 달라요.</small>}</label>
      {error && <p className="error" role="alert">{error}</p>}
      <footer className="admin-modal-actions"><button type="button" className="btn ghost" disabled={working} onClick={onClose}>취소</button><button className="btn primary" disabled={working || !valid}>{working ? '만드는 중…' : '테스트 계정 만들기'}</button></footer>
    </form>
  </Modal>
}
