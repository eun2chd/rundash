import { useRef, useState } from 'react'
import { api, authErrorMessage } from '../lib/api'
import Logo from '../components/Logo'
import Captcha, { captchaEnabled } from '../components/Captcha'
import PasswordInput from '../components/PasswordInput'

export default function Login({ onLogin, onSignUp, onHelp, confirmAction }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const captcha = useRef(null)
  const captchaPending = captchaEnabled && !captchaToken
  const authenticate = async (anonymous = false) => {
    if (captchaPending) return setErr('보안 확인이 끝날 때까지 잠시만 기다려 주세요.')
    setErr(''); setLoading(true)
    let requested = false
    try {
      if (!await confirmAction({ title: anonymous ? '익명 러너로 시작할까요?' : '로그인하고 이동할까요?', description: anonymous ? '러너 만들기 화면으로 이동합니다. 익명 체험은 저장되지 않아요.' : '로그인 후 내 러너의 화면으로 이동합니다.', confirmLabel: anonymous ? '익명으로 시작' : '로그인', cancelLabel: '취소' })) return
      requested = true
      if (anonymous) await onLogin(await api.signInAnonymously(captchaToken))
      else await onLogin(await api.signIn({ email: email.trim(), password: pw, captchaToken }))
    } catch (error) {
      const messages = { 'Invalid login credentials': '이메일 또는 비밀번호를 확인해 주세요.', 'Email not confirmed': '이메일 인증을 완료한 뒤 로그인해 주세요.', 'Anonymous sign-ins are disabled': 'Supabase에서 익명 로그인을 활성화해 주세요.' }
      setErr(messages[error.message] || authErrorMessage(error) || '연결에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally { setLoading(false); if (requested) captcha.current?.reset() }
  }
  return (
    <div className="login-screen">
      <div className="login-hero">
        <Logo />
        <h1>같이 달리자!<br />나만의 캐릭터와 러닝</h1>
        <p>같이 뛸 사람을 찾고 있나요? 온라인에서 다른 러너들과 함께 달려요.<br />일하는 동안에도 내 3D 캐릭터는 러닝 중!<br />러닝 강도와 거리, 페이스를 정하고 달린 만큼 경험치를 쌓는 캐릭터 성장 게임이에요.</p>
        <ul className="hero-steps">
          <li><b>1</b> 닉네임을 정하고 캐릭터 생성</li>
          <li><b>2</b> 나에게 맞는 러닝 강도 · 거리 선택</li>
          <li><b>3</b> 경험치 · 레벨업 · 부스터 해금</li>
        </ul>
      </div>
      <form className="card login-card" onSubmit={(e) => { e.preventDefault(); authenticate() }}>
        <h2>시작하기</h2>
        <label className="field"><span>이메일</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="runner@email.com" autoComplete="email" disabled={loading} /></label>
        <label className="field"><span>비밀번호</span><PasswordInput required minLength={1} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="비밀번호를 입력해 주세요" autoComplete="current-password" disabled={loading} /></label>
        <Captcha ref={captcha} onToken={setCaptchaToken} />
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn primary block" disabled={loading || captchaPending}>{loading ? '연결 중…' : captchaPending ? '보안 확인 중…' : '로그인'}</button>
        <div className="auth-help-links">
          <button type="button" className="link" disabled={loading} onClick={() => onHelp('forgot-password')}>비밀번호 찾기</button>
          <button type="button" className="link" disabled={loading} onClick={() => onHelp('verify-email')}>인증 메일 다시 받기</button>
        </div>
        <p className="note"><button type="button" className="link" disabled={loading} onClick={onSignUp}>처음 오셨나요? · 회원가입</button></p>
        <div className="divider"><span>가볍게 먼저 달려볼까요?</span></div>
        <button type="button" className="btn ghost block" disabled={loading || captchaPending} onClick={() => authenticate(true)}>익명 계정으로 시작하기 →</button>
        <p className="note">익명 러너와 기록은 체험 중에만 유지돼요.<br />새로고침하면 초기화되며 경험치는 저장되지 않아요.</p>
        <p className="login-legal">시작하면 <a href="/terms" target="_blank" rel="noopener">이용약관</a>과 <a href="/privacy" target="_blank" rel="noopener">개인정보처리방침</a>에 동의하는 것으로 봐요.</p>
      </form>
    </div>
  )
}
