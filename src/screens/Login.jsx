import { useState } from 'react'
import { api } from '../lib/api'
import Logo from '../components/Logo'

export default function Login({ onLogin, onSignUp, onHelp, confirmAction }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const authenticate = async (anonymous = false) => {
    setErr(''); setLoading(true)
    try {
      if (!await confirmAction({ title: anonymous ? '익명 러너로 시작할까요?' : '로그인하고 이동할까요?', description: anonymous ? '러너 만들기 화면으로 이동합니다. 익명 체험은 저장되지 않아요.' : '로그인 후 내 러너의 화면으로 이동합니다.', confirmLabel: anonymous ? '익명으로 시작' : '로그인', cancelLabel: '취소' })) return
      if (anonymous) await onLogin(await api.signInAnonymously())
      else await onLogin(await api.signIn({ email: email.trim(), password: pw }))
    } catch (error) {
      const messages = { 'Invalid login credentials': '이메일 또는 비밀번호를 확인해 주세요.', 'Email not confirmed': '이메일 인증을 완료한 뒤 로그인해 주세요.', 'Anonymous sign-ins are disabled': 'Supabase에서 익명 로그인을 활성화해 주세요.' }
      setErr(messages[error.message] || error.message || '연결에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally { setLoading(false) }
  }
  return (
    <div className="login-screen">
      <div className="login-hero">
        <Logo />
        <h1>나만의 페이스로<br />러너와 함께 성장해요</h1>
        <p>러닝 강도와 거리를 정하고, 달린 만큼 경험치를 쌓아요.<br />레벨이 오르면 더 빠르고 튼튼한 러너가 돼요.</p>
        <ul className="hero-steps">
          <li><b>1</b> 닉네임을 정하고 캐릭터 생성</li>
          <li><b>2</b> 나에게 맞는 러닝 강도 · 거리 선택</li>
          <li><b>3</b> 경험치 · 레벨업 · 부스터 해금</li>
        </ul>
      </div>
      <form className="card login-card" onSubmit={(e) => { e.preventDefault(); authenticate() }}>
        <h2>시작하기</h2>
        <label className="field"><span>이메일</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="runner@email.com" autoComplete="email" disabled={loading} /></label>
        <label className="field"><span>비밀번호</span><input type="password" required minLength={1} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="비밀번호를 입력해 주세요" autoComplete="current-password" disabled={loading} /></label>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn primary block" disabled={loading}>{loading ? '연결 중…' : '로그인'}</button>
        <div className="auth-help-links">
          <button type="button" className="link" disabled={loading} onClick={() => onHelp('forgot-password')}>비밀번호 찾기</button>
          <button type="button" className="link" disabled={loading} onClick={() => onHelp('verify-email')}>인증 메일 다시 받기</button>
        </div>
        <p className="note"><button type="button" className="link" disabled={loading} onClick={onSignUp}>처음 오셨나요? · 회원가입</button></p>
        <div className="divider"><span>가볍게 먼저 달려볼까요?</span></div>
        <button type="button" className="btn ghost block" disabled={loading} onClick={() => authenticate(true)}>익명 계정으로 시작하기 →</button>
        <p className="note">익명 러너와 기록은 체험 중에만 유지돼요.<br />새로고침하면 초기화되며 경험치는 저장되지 않아요.</p>
      </form>
    </div>
  )
}
