import { useState } from 'react'
import { api } from '../lib/api'
import Logo from '../components/Logo'

export default function Login({ onLogin, onSignUp }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const authenticate = async (anonymous = false) => {
    setErr(''); setLoading(true)
    try {
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
        <h1>정한 페이스로<br />내 캐릭터가 대신 달려요</h1>
        <p>페이스와 거리를 정하면 캐릭터가 코스를 달리고<br />나만의 러닝 기록이 차곡차곡 쌓여요.</p>
        <ul className="hero-steps">
          <li><b>1</b> 닉네임을 정하고 캐릭터 생성</li>
          <li><b>2</b> km당 페이스 · 거리 설정</li>
          <li><b>3</b> 달리는 동안 아이템 · 박자 · 응원</li>
        </ul>
      </div>
      <form className="card login-card" onSubmit={(e) => { e.preventDefault(); authenticate() }}>
        <h2>시작하기</h2>
        <label className="field"><span>이메일</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="runner@email.com" autoComplete="email" disabled={loading} /></label>
        <label className="field"><span>비밀번호</span><input type="password" required minLength={1} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="비밀번호를 입력해 주세요" autoComplete="current-password" disabled={loading} /></label>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn primary block" disabled={loading}>{loading ? '연결 중…' : '로그인'}</button>
        <p className="note"><button type="button" className="link" disabled={loading} onClick={onSignUp}>처음 오셨나요? · 회원가입</button></p>
        <div className="divider"><span>가볍게 먼저 달려볼까요?</span></div>
        <button type="button" className="btn ghost block" disabled={loading} onClick={() => authenticate(true)}>익명 계정으로 시작하기 →</button>
        <p className="note">익명 기록은 현재 브라우저의 로그인에 연결돼요.<br />로그아웃하거나 브라우저 데이터를 지우면 다시 접근할 수 없어요.</p>
      </form>
    </div>
  )
}
