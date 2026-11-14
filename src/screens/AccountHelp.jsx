import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import Logo from '../components/Logo'

export default function AccountHelp({ mode, onBack }) {
  const verification = mode === 'verify-email'
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  useEffect(() => {
    if (!cooldown) return
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])
  const submit = async (event) => {
    event.preventDefault()
    if (loading || cooldown) return
    setLoading(true); setError(''); setSent(false)
    try {
      if (verification) await api.resendVerification(email.trim())
      else await api.requestPasswordReset(email.trim())
      setSent(true); setCooldown(60)
    } catch (err) {
      if (err.status === 429 || /rate limit|too many|after \d+ seconds/i.test(err.message)) {
        setCooldown(60)
        setError('요청이 많아요. 1분 뒤 다시 시도해 주세요.')
      } else setError('메일을 요청하지 못했어요. 이메일을 확인한 뒤 다시 시도해 주세요.')
    } finally { setLoading(false) }
  }
  return <div className="login-screen">
    <div className="login-hero"><Logo /><h1>{verification ? <>인증 메일을<br />다시 받아보세요</> : <>비밀번호를 잊어도<br />다시 달릴 수 있어요</>}</h1><p>{verification ? '가입할 때 사용한 이메일로 인증 링크를 요청해 주세요.' : '가입한 이메일로 비밀번호 재설정 링크를 보내드려요.'}</p></div>
    <section className="card login-card">
      <button className="link signup-back" type="button" disabled={loading} onClick={onBack}>← 로그인으로</button>
      <div className="eyebrow">{verification ? 'VERIFY YOUR EMAIL' : 'PASSWORD RECOVERY'}</div>
      <h2>{verification ? '이메일 재인증' : '비밀번호 찾기'}</h2>
      <form onSubmit={submit}>
        <label className="field"><span>가입한 이메일</span><input type="email" required value={email} onChange={(e) => { setEmail(e.target.value); setSent(false); setError('') }} placeholder="runner@email.com" autoComplete="email" disabled={loading} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        {sent && <div className="auth-notice" role="status">{verification ? '인증이 필요한 계정이면 인증 메일이 발송됩니다.' : '가입된 계정이면 재설정 메일이 발송됩니다.'} 받은편지함과 스팸함을 확인해 주세요.</div>}
        <button className="btn primary block" disabled={loading || cooldown > 0}>{loading ? '요청 중…' : cooldown > 0 ? `${cooldown}초 후 다시 요청` : verification ? '인증 메일 다시 받기' : '재설정 링크 받기'}</button>
        <p className="note">가장 최근에 받은 메일의 링크를 사용해 주세요.</p>
      </form>
    </section>
  </div>
}
