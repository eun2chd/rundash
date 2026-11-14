import { isValidPassword, PASSWORD_RULE } from '../lib/password'
import { useState } from 'react'
import { api } from '../lib/api'
import Logo from '../components/Logo'

export default function SignUp({ onLogin, onBack, onVerify, confirmAction }) {
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [nicknameStatus, setNicknameStatus] = useState('idle')
  const [checkedNickname, setCheckedNickname] = useState('')
  const [nicknameError, setNicknameError] = useState('')
  const name = nickname.trim()
  const validNickname = /^[가-힣a-zA-Z0-9_]{2,10}$/.test(name)
  const checking = nicknameStatus === 'checking'
  const available = nicknameStatus === 'available' && checkedNickname === name
  const passwordsMatch = isValidPassword(password) && password === passwordConfirm
  const passwordMismatch = passwordConfirm.length > 0 && password !== passwordConfirm

  const checkNickname = async () => {
    if (!validNickname || checking) return
    setNicknameStatus('checking')
    setNicknameError('')
    try {
      const taken = await api.isNicknameTaken(name)
      setCheckedNickname(name)
      setNicknameStatus(taken ? 'taken' : 'available')
      if (taken) setNicknameError('이미 사용 중이거나 사용할 수 없는 닉네임이에요.')
    } catch (err) {
      setNicknameStatus('error')
      setNicknameError(err.code === '42501' ? '닉네임 확인 기능을 준비 중이에요. 잠시 후 다시 시도해 주세요.' : '닉네임을 확인하지 못했어요. 다시 시도해 주세요.')
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    if (loading) return
    const name = nickname.trim()
    if (!/^[가-힣a-zA-Z0-9_]{2,10}$/.test(name)) return setError('닉네임은 2~10자, 한글·영문·숫자·_로 정해 주세요.')
    if (['admin', '관리자', '운영자'].includes(name.toLowerCase())) return setError('사용할 수 없는 닉네임이에요.')
    if (!available) return setError('닉네임 중복 확인을 먼저 해주세요.')
    if (!isValidPassword(password)) return setError('비밀번호는 8자 이상, 특수문자를 1개 이상 포함해 주세요.')
    if (password !== passwordConfirm) return setError('비밀번호가 서로 달라요. 다시 확인해 주세요.')
    setLoading(true)
    setError('')
    try {
      if (!await confirmAction({ title: '회원가입을 진행할까요?', description: '가입 완료 후 이메일 인증 안내 또는 러너 만들기 화면으로 이동합니다.', confirmLabel: '회원가입', cancelLabel: '더 확인하기' })) return
      if (await api.isNicknameTaken(name)) {
        setNicknameStatus('taken')
        setNicknameError('이미 사용 중인 닉네임이에요. 다른 이름을 정해 주세요.')
        return
      }
      const data = await api.signUp({ email: email.trim(), password, nickname: name })
      if (data.session) await onLogin(data.user)
      else { setSent(true); setPassword(''); setPasswordConfirm('') }
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
          <p className="note"><button type="button" className="link" onClick={onVerify}>인증 메일이 안 왔나요? 다시 받기</button></p>
        </div> : <form onSubmit={submit}>
          <div className="eyebrow">JOIN RUN DASH</div>
          <h2>회원가입</h2>
          <div className="field">
            <label htmlFor="signup-nickname">닉네임</label>
            <div className="nickname-check-row">
              <input id="signup-nickname" required minLength={2} maxLength={10} value={nickname} onChange={(e) => { setNickname(e.target.value); setNicknameStatus('idle'); setNicknameError(''); setError('') }} placeholder="어떤 이름으로 달릴까요?" autoComplete="nickname" aria-describedby="nickname-help nickname-status" aria-invalid={nicknameStatus === 'taken'} disabled={loading || checking} />
              <button type="button" className="btn ghost" disabled={loading || checking || !validNickname} onClick={checkNickname}>{checking ? '확인 중…' : '중복 확인'}</button>
            </div>
            <small id="nickname-help">2~10자 · 한글, 영문, 숫자, _ · 대소문자 구분 없음</small>
            <small id="nickname-status" className={nicknameError ? 'warn' : ''} role="status">{nicknameError || (available ? '사용할 수 있는 닉네임이에요.' : checking ? '닉네임을 확인하고 있어요.' : '닉네임을 입력한 뒤 중복 확인을 눌러주세요.')}</small>
          </div>
          <label className="field"><span>이메일</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="runner@email.com" autoComplete="email" disabled={loading} /></label>
          <label className="field"><span>비밀번호</span><input type="password" required minLength={8} value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} placeholder="8자 이상 · 특수문자 포함" autoComplete="new-password" disabled={loading} /><small>{PASSWORD_RULE}</small></label>
          <label className="field"><span>비밀번호 확인</span><input type="password" required minLength={8} value={passwordConfirm} onChange={(e) => { setPasswordConfirm(e.target.value); setError('') }} placeholder="비밀번호를 한 번 더 입력해 주세요" autoComplete="new-password" aria-invalid={passwordMismatch} aria-describedby="signup-password-status" disabled={loading} /><small id="signup-password-status" className={passwordMismatch ? 'warn' : ''} role="status">{passwordMismatch ? '비밀번호가 서로 달라요.' : passwordsMatch ? '비밀번호가 일치해요.' : '같은 비밀번호를 한 번 더 입력해 주세요.'}</small></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn primary block" disabled={loading || !available || !passwordsMatch}>{loading ? '가입하는 중…' : '가입하고 러너 만들기 →'}</button>
          <p className="note">닉네임은 캐릭터 저장 시 확정돼요.</p>
        </form>}
      </section>
    </div>
  )
}
