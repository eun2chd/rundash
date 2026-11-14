import { useEffect, useState } from 'react'
import { api } from './lib/api'
import Login from './screens/Login'
import CharacterCreate from './screens/CharacterCreate'
import RunSetup from './screens/RunSetup'
import RunScreen from './screens/RunScreen'
import Result from './screens/Result'
import Loading from './components/Loading'

// 화면 흐름: login → character → setup → run → result
export default function App() {
  const [screen, setScreen] = useState('loading')
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [config, setConfig] = useState({ paceSec: 360, distanceKm: 5 })
  const [result, setResult] = useState(null)

  const enter = async (u) => {
    setUser(u)
    const p = await api.getProfile(u.id)
    setProfile(p)
    setScreen(p ? 'setup' : 'character')
  }

  useEffect(() => {
    ;(async () => {
      const u = await api.getSession()
      if (u) await enter(u)
      else setScreen('login')
    })()
  }, [])

  const logout = async () => {
    await api.signOut()
    setUser(null)
    setProfile(null)
    setScreen('login')
  }

  const finishRun = async (r) => {
    const saved = await api.saveRun({ ...r, userId: user.id })
    setResult(saved)
    setScreen('result')
  }

  if (screen === 'loading') return <Loading text="러너를 깨우고 있어요." />

  return (
    <>
      {screen === 'login' && <Login onLogin={enter} />}
      {screen === 'character' && (
        <CharacterCreate user={user} initial={profile} onDone={(p) => { setProfile(p); setScreen('setup') }} />
      )}
      {screen === 'setup' && (
        <RunSetup
          profile={profile}
          config={config}
          onChange={setConfig}
          onStart={() => setScreen('run')}
          onEditCharacter={() => setScreen('character')}
          onLogout={logout}
        />
      )}
      {screen === 'run' && <RunScreen profile={profile} config={config} onFinish={finishRun} />}
      {screen === 'result' && <Result result={result} profile={profile} onAgain={() => setScreen('setup')} />}
    </>
  )
}
