import { isValidPassword, PASSWORD_RULE } from '../lib/password'
import { useState } from 'react'
import { api } from '../lib/api'
import Logo from '../components/Logo'

export default function ResetPassword({ validSession, onDone, onRequestNew, confirmAction }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    if (loading) return
    if (!updated && !isValidPassword(password)) return setError('비밀번호는 8자 이상, 특수문자를 1개 이상 포함해 주세요.')
    if (!updated && password !== confirm) return setError('비밀번호가 서로 달라요. 다시 확인해 주세요.')
    setLoading(true); setError('')
    let passwordUpdated = updated
    try {
      if (!await confirmAction({ title: updated ? '로그인 화면으로 이동할까요?' : '비밀번호를 변경하고 로그인으로 이동할까요?', description: updated ? '새 비밀번호로 다시 로그인해 주세요.' : '변경 후 로그아웃되며 새 비밀번호로 다시 로그인해야 해요.', confirmLabel: updated ? '로그인으로 이동' : '변경하고 이동', cancelLabel: '취소' })) return
      if (!updated) { await api.updatePassword(password); passwordUpdated = true; setUpdated(true); setPassword(''); setConfirm('') }
      await api.signOut()
      onDone()
    } catch (err) {
      setError(passwordUpdated ? '비밀번호는 변경됐어요. 로그인 화면으로 이동을 다시 눌러주세요.' : err.message === 'New password should be different from the old password.' ? '기존과 다른 비밀번호를 입력해 주세요.' : '변경하지 못했어요. 링크가 만료됐다면 재설정 메일을 다시 요청해 주세요.')
    } finally { setLoading(false) }
  }
  return <div className="login-screen">
    <div className="login-hero"><Logo /><h1>새 비밀번호로<br />다시 시작해요</h1><p>다른 곳에서 사용하지 않는 비밀번호로 정해 주세요.</p></div>
    <section className="card login-card"><div className="eyebrow">RESET PASSWORD</div><h2>새 비밀번호 설정</h2>
      {!validSession ? <><p className="auth-notice" role="alert">재설정 링크가 만료됐거나 유효하지 않아요. 새 링크를 요청해 주세요.</p><button type="button" className="btn primary block" onClick={onRequestNew}>재설정 메일 다시 받기</button></> : <form onSubmit={submit}>
        {!updated && <>
          <label className="field"><span>새 비밀번호</span><input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상 · 특수문자 포함" autoComplete="new-password" disabled={loading} /><small>{PASSWORD_RULE}</small></label>
          <label className="field"><span>새 비밀번호 확인</span><input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="한 번 더 입력해 주세요" autoComplete="new-password" disabled={loading} /><small>{PASSWORD_RULE}</small></label>
        </>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary block" disabled={loading || (!updated && (!isValidPassword(password) || password !== confirm))}>{loading ? '처리 중…' : updated ? '로그인 화면으로 이동' : '비밀번호 변경하기'}</button>
      </form>}
    </section>
  </div>
}
