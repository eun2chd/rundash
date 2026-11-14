import { useState } from 'react'
import { api } from '../lib/api'
import Logo from '../components/Logo'

export default function SignUp({ onLogin, onBack }) {
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (loading) return
    const name = nickname.trim()
    if (!/^[가-힣a-zA-Z0-9_]{2,10}$/.test(name)) return setError('닉네임은 2~10자, 한글·영문·숫자·_로 정해 주세요.')
    if (['admin', '관리자', '운영자'].includes(name.toLowerCase())) return setError('사용할 수 없는 닉네임이에요.')
    setLoading(true)
    setError('')
    try {
      const data = await api.signUp({ email: email.trim(), password, nickname: name })
      if (data.session) await onLogin(data.user)
      else { setSent(true); setPassword('') }
    } catch (err) {
      const messages = { 'User already registered': '이미 가입한 이메일이에요. 로그인해 주세요.', 'Email rate limit exceeded': '이메일 발송 요청이 많아요. 잠시 후 다시 시도해 주세요.' }
      setError(messages[err.message] || err.message || '가입하지 못했어요. 다시 시도해 주세요.')
    } finally { setLoading(false) }
  }

  return (
    <div className="login-screen signup-screen">
      <div className="login-hero">
        <Logo />
        <h1>나만의 이름으로<br />첫 러닝을 시작해요</h1>
        <p>닉네임과 로그인 정보만 있으면 준비 끝.<br />가입 후 나만의 러너를 꾸며보세요.</p>
        <div className="signup-preview" aria-hidden="true"><span className="signup-avatar">{nickname.trim().slice(0, 1) || 'R'}</span><div><span className="eyebrow">YOUR RUNNER</span><strong>{nickname.trim() || '새로운 러너'}</strong><span className="muted">오늘부터, 나만의 페이스로.</span></div></div>
      </div>
      <section className="card login-card">
        <button type="button" className="link signup-back" disabled={loading} onClick={onBack}>← 로그인으로</button>
        {sent ? <div className="signup-success" role="status">
          <div className="eyebrow">CHECK YOUR EMAIL</div>
          <h2>이메일을 확인해 주세요</h2>
          <p><strong>{email.trim()}</strong> 주소로 가입 확인을 요청했어요. 받은편지함과 스팸함을 확인해 주세요.</p>
          <p className="note">인증을 마친 뒤 로그인하면 정한 닉네임으로 러너를 만들 수 있어요. 이미 가입한 이메일이라면 바로 로그인해 주세요.</p>
          <button type="button" className="btn primary block" onClick={onBack}>로그인하러 가기 →</button>
        </div> : <form onSubmit={submit}>
          <div className="eyebrow">JOIN RUN DASH</div>
          <h2>회원가입</h2>
          <label className="field"><span>닉네임</span><input required minLength={2} maxLength={10} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="어떤 이름으로 달릴까요?" autoComplete="nickname" disabled={loading} /><small>2~10자 · 한글, 영문, 숫자, _</small></label>
          <label className="field"><span>이메일</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="runner@email.com" autoComplete="email" disabled={loading} /></label>
          <label className="field"><span>비밀번호</span><input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상 입력해 주세요" autoComplete="new-password" disabled={loading} /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn primary block" disabled={loading}>{loading ? '가입하는 중…' : '가입하고 러너 만들기 →'}</button>
          <p className="note">닉네임 중복 확인은 캐릭터를 저장할 때 진행해요.</p>
        </form>}
      </section>
    </div>
  )
}
