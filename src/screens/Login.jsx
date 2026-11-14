import { useState } from 'react'
import { api } from '../lib/api'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!email.includes('@')) return setErr('이메일 형식을 확인해 주세요.')
    if (pw.length < 4) return setErr('비밀번호는 4자 이상 입력해 주세요.')
    setErr('')
    setLoading(true)
    onLogin(await api.signIn({ email }))
  }

  const social = async (provider) => {
    setLoading(true)
    onLogin(await api.signIn({ email: `${provider}-demo@rundash.app`, provider }))
  }

  return (
    <div className="login-screen">
      <div className="login-hero">
        <div className="brand-mark">런 대 시</div>
        <h1>정한 페이스대로,<br />내 캐릭터가 대신 달려요.</h1>
        <p>페이스와 거리를 정하면 캐릭터가 코스를 달리고,<br />같은 시간에 접속한 사람들과 함께 뜁니다.</p>
        <ul className="hero-steps">
          <li><b>1</b> 닉네임을 정하면 캐릭터 생성</li>
          <li><b>2</b> km당 페이스 · 거리 설정</li>
          <li><b>3</b> 달리는 동안 아이템 · 박자 · 응원</li>
        </ul>
      </div>

      <form className="card login-card" onSubmit={submit}>
        <h2>시작하기</h2>
        <label className="field">
          <span>이메일</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="runner@email.com" autoFocus />
        </label>
        <label className="field">
          <span>비밀번호</span>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••" />
        </label>
        {err && <p className="error">{err}</p>}
        <button className="btn primary block" disabled={loading}>{loading ? '들어가는 중…' : '로그인'}</button>
        <div className="divider"><span>또는</span></div>
        <button type="button" className="btn ghost block" onClick={() => social('google')} disabled={loading}>Google로 계속하기</button>
        <button type="button" className="btn kakao block" onClick={() => social('kakao')} disabled={loading}>카카오로 계속하기</button>
        <p className="note">목업 단계 — 아무 이메일/비밀번호로 로그인돼요.</p>
      </form>
    </div>
  )
}
