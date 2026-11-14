import { useEffect, useState } from 'react'
import { api } from './lib/api'
import Login from './screens/Login'
import SignUp from './screens/SignUp'
import CharacterCreate from './screens/CharacterCreate'
import RunSetup from './screens/RunSetup'
import RunScreen from './screens/RunScreen'
import Result from './screens/Result'
import Loading from './components/Loading'
import Header from './components/Header'

// 화면 흐름: login → character → setup → run → result
export default function App() {
  const [screen, setScreen] = useState('loading')
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [config, setConfig] = useState({ paceSec: 360, distanceKm: 5 })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [pendingRun, setPendingRun] = useState(null)
  const [saving, setSaving] = useState(false)

  const enter = async (u) => {
    setUser(u)
    const p = await api.getProfile(u.id)
    setProfile(p)
    setScreen(p ? 'setup' : 'character')
  }

  useEffect(() => {
    ;(async () => {
      try {
        const u = await api.getSession()
        if (u) await enter(u)
        else setScreen('login')
      } catch (err) { setError(err.message); setScreen('login') }
    })()
  }, [])

  const logout = async () => {
    if (user?.is_anonymous && !window.confirm('익명 계정은 로그아웃하면 기록에 다시 접근할 수 없어요. 로그아웃할까요?')) return
    try { await api.signOut() } catch (err) { setError(err.message); return }
    setError('')
    setUser(null)
    setProfile(null)
    setScreen('login')
  }

  const finishRun = async (r) => {
    const run = { ...r, id: r.id || crypto.randomUUID(), userId: user.id }
    setPendingRun(run)
    setSaving(true)
    setError('')
    setScreen('saving')
    try {
      const saved = await api.saveRun(run)
      setResult(saved)
      setPendingRun(null)
      setScreen('result')
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <Header user={user} profile={profile} screen={screen} onNavigate={(next) => { setError(''); setScreen(next) }} onLogout={logout} />
      <main className="app-content">
      {screen === 'loading' && <Loading text="러너를 깨우고 있어요." />}
      {error && screen !== 'saving' && <div className="app-error" role="alert">{error}<button className="link" onClick={() => setError('')}>닫기</button></div>}
      {screen === 'saving' && (saving ? <Loading text="러닝 기록을 저장하고 있어요." /> : <div className="loading-screen"><p role="alert">기록을 저장하지 못했어요. {error}</p><button className="btn primary" onClick={() => finishRun(pendingRun)}>다시 저장하기</button></div>)}
      {screen === 'login' && <Login onLogin={enter} onSignUp={() => setScreen('signup')} />}
      {screen === 'signup' && <SignUp onLogin={enter} onBack={() => setScreen('login')} />}
      {screen === 'character' && (
        <CharacterCreate user={user} initial={profile} onDone={(p) => { setProfile(p); setScreen('setup') }} />
      )}
      {screen === 'setup' && (
        <RunSetup
          profile={profile}
          config={config}
          onChange={setConfig}
          onStart={() => setScreen('run')}
        />
      )}
      {screen === 'run' && <RunScreen profile={profile} config={config} onFinish={finishRun} />}
      {screen === 'result' && <Result result={result} profile={profile} onAgain={() => setScreen('setup')} />}
      </main>
    </>
  )
}
