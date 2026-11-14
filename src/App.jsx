import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { api } from './lib/api'
import Login from './screens/Login'
import Loading from './components/Loading'
import Header from './components/Header'
import AccountHelp from './screens/AccountHelp'
import ResetPassword from './screens/ResetPassword'
import { supabase } from './lib/supabase'
import { trainingFor } from './lib/progression'
import ConfirmDialog from './components/ConfirmDialog'
import useConfirmation from './lib/useConfirmation'
import ManualDialog from './components/ManualDialog'
import Support from './screens/Support'
import { configureSettings, getSettings } from './lib/settings'


const SignUp = lazy(() => import('./screens/SignUp'))
const CharacterCreate = lazy(() => import('./screens/CharacterCreate'))
const RunSetup = lazy(() => import('./screens/RunSetup'))
const RunScreen = lazy(() => import('./screens/RunScreen'))
const Result = lazy(() => import('./screens/Result'))
const MyPage = lazy(() => import('./screens/MyPage'))
const Admin = lazy(() => import('./screens/Admin'))

const SCREEN_NAMES = { admin: '관리자', support: '문의하기', mypage: '마이페이지', login: '로그인', signup: '회원가입', character: '러너 만들기', setup: '러닝 설정', 'forgot-password': '비밀번호 찾기', 'verify-email': '이메일 재인증', result: '러닝 결과' }

const callbackHash = new URLSearchParams(window.location.hash.slice(1))
const recoveryRequested = new URLSearchParams(window.location.search).get('auth') === 'reset-password' || callbackHash.get('type') === 'recovery'
const callbackFailed = callbackHash.has('error') || new URLSearchParams(window.location.search).has('error')

// 화면 흐름: login → character → setup → run → result
export default function App() {
  const [screen, setScreen] = useState('loading')
  const [user, setUser] = useState(null)
  const [account, setAccount] = useState({ admin: false, suspended: false })
  const [profile, setProfile] = useState(null)
  const [config, setConfig] = useState({ intensity: 'steady', distanceKm: 5, activity: 'rest' })
  const [progression, setProgression] = useState({ xp: 0 })
  const [activeConfig, setActiveConfig] = useState(null)
  const [starting, setStarting] = useState(false)
  const startId = useRef(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [pendingRun, setPendingRun] = useState(null)
  const [saving, setSaving] = useState(false)
  const recovery = useRef(recoveryRequested)
  const [recoverySession, setRecoverySession] = useState(false)
  const { confirm, question, answer } = useConfirmation()
  const runControls = useRef(null)
  const pendingDestination = useRef('result')
  const [manualOpen, setManualOpen] = useState(false)
  const manualResume = useRef(null)
  const openManual = () => {
    if (question || manualOpen) return
    if (screen === 'run') {
      const resume = runControls.current?.pauseForManual()
      if (!resume) return
      manualResume.current = resume
    }
    setManualOpen(true)
  }
  const closeManual = () => { setManualOpen(false); manualResume.current?.(); manualResume.current = null }

  const enter = async (u) => {
    const [settings, status] = await Promise.all([api.getSettings(), api.accountStatus()])
    configureSettings(settings.value)
    setAccount(status)
    setUser(u)
    const p = u.is_anonymous ? null : await api.getProfile(u.id)
    setProfile(p)
    setProgression({ xp: 0 })
    if (p && !u.is_anonymous) {
      try { setProgression(await api.getProgression(u.id)) }
      catch { setError('성장 정보를 불러오지 못했어요. 러닝 시작 시 다시 확인할게요.') }
    }
    setScreen(status.suspended ? 'support' : p ? 'setup' : 'character')
  }

  useEffect(() => {
    let mounted = true
    const subscription = supabase?.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && mounted) {
        recovery.current = true
        setRecoverySession(!!session)
        setScreen('reset-password')
      }
    }).data.subscription
    ;(async () => {
      try {
        const u = await api.getSession()
        if (!mounted) return
        if (recovery.current) {
          setRecoverySession(!!u && !callbackFailed)
          setScreen('reset-password')
        } else if (callbackFailed) {
          setError('이메일 링크가 만료됐거나 유효하지 않아요. 인증 메일을 다시 요청해 주세요.')
          setScreen('verify-email')
        } else if (u) await enter(u)
        else setScreen('login')
      } catch (err) {
        if (!mounted) return
        if (recovery.current) { setRecoverySession(false); setScreen('reset-password') }
        else { setError(err.message); setScreen('login') }
      }
    })()
    return () => { mounted = false; subscription?.unsubscribe() }
  }, [])

  const leaveRecovery = (next) => {
    recovery.current = false
    setRecoverySession(false)
    window.history.replaceState({}, '', window.location.pathname)
    setUser(null); setProfile(null); setError(''); setScreen(next)
  }

  useEffect(() => {
    document.body.classList.toggle('runner-studio-open', screen === 'character')
    return () => document.body.classList.remove('runner-studio-open')
  }, [screen])

  useEffect(() => {
    const beforeUnload = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [])

  const logout = async () => {
    await api.signOut()
    setError('')
    setUser(null)
    setProfile(null)
    setScreen('login')
  }

  const navigate = async (next) => {
    if (next === screen || starting || saving) return
    if (next === 'admin' && !account.admin) return
    if (account.suspended && !['support', 'mypage', 'login', 'signup'].includes(next)) { setError('이용이 제한된 계정이에요. 문의하기로 연락해 주세요.'); return }
    if (screen === 'run') return runControls.current?.requestExit(next)
    if (!await confirm({ title: `${SCREEN_NAMES[next] || '다른 화면'} 화면으로 이동할까요?`, description: screen === 'character' ? '저장하지 않은 러너 변경사항은 사라져요.' : '입력 중인 내용은 이동하면 초기화될 수 있어요.' })) return
    try {
      if (next === 'setup') configureSettings((await api.getSettings()).value)
      setError(''); setScreen(next)
    } catch { setError('러닝 설정을 불러오지 못했어요. 다시 시도해 주세요.') }
  }

  const requestLogout = async () => {
    if (screen === 'run') return runControls.current?.requestExit('logout')
    if (!await confirm({ title: '로그아웃할까요?', description: user?.is_anonymous ? '익명 러너와 체험 기록은 사라져요.' : '로그인 화면으로 돌아갑니다. 저장하지 않은 변경사항은 사라져요.', confirmLabel: '로그아웃' })) return
    try { await logout() } catch (err) { setError(err.message) }
  }

  const requestRecoveryNavigation = async (next) => {
    if (await confirm({ title: `${SCREEN_NAMES[next]} 화면으로 이동할까요?`, description: '현재 비밀번호 재설정 화면에서 나갑니다.' })) leaveRecovery(next)
  }

  const finishRun = async (r, destination = 'result') => {
    pendingDestination.current = destination
    const run = { ...r, id: r.id || crypto.randomUUID(), userId: user.id }
    setPendingRun(run)
    setSaving(true)
    setError('')
    setScreen('saving')
    try {
      if (user.is_anonymous) {
        setResult({ ...run, growth: { xpEarned: 0, reason: 'anonymous', xpBefore: 0, xpAfter: 0 } })
      } else {
        const saved = await api.saveRun(run)
        setResult(saved.run)
        setProgression(saved.progression)
      }
      if (destination === 'logout') await logout()
      else setScreen(destination)
      setPendingRun(null)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const startRun = async () => {
    if (starting) return
    setStarting(true); setError('')
    try {
      if (!await confirm({ title: '러닝을 시작할까요?', description: `${config.distanceKm}km 러닝을 시작합니다. 러닝 중 나가려면 종료 확인이 필요해요.`, confirmLabel: '달리기 시작', cancelLabel: '설정 더 보기' })) return
      startId.current ||= crypto.randomUUID()
      if (user.is_anonymous && config.distanceKm > getSettings().anonymousMaxKm) throw new Error(`익명 러너는 최대 ${getSettings().anonymousMaxKm}km까지 달릴 수 있어요.`)
      const ticket = user.is_anonymous ? { id: startId.current, xp: 0 } : await api.startRun({ id: startId.current, ...config })
      if (ticket.settings) configureSettings(ticket.settings)
      setProgression((previous) => ({ ...previous, xp: ticket.xp }))
      setActiveConfig({ ...config, distanceKm: ticket.distanceKm ?? config.distanceKm, ...trainingFor(ticket.xp, ticket.intensity || config.intensity, user.is_anonymous), id: ticket.id, anonymous: user.is_anonymous })
      startId.current = null
      setScreen('run')
    } catch (err) { setError(err.message || '러닝을 준비하지 못했어요. 다시 시도해 주세요.') }
    finally { setStarting(false) }
  }

  return (
    <>
      <Header user={user} profile={profile} admin={account.admin} screen={starting ? 'loading' : screen} onNavigate={navigate} onLogout={requestLogout} onHelp={openManual} />
      {question && <ConfirmDialog {...question} onAnswer={answer} />}
      {manualOpen && <ManualDialog onClose={closeManual} />}
      <main className="app-content">
      <Suspense fallback={<Loading text="화면을 준비하고 있어요." />}>
      {screen === 'loading' && <Loading text="러너를 깨우고 있어요." />}
      {error && screen !== 'saving' && <div className="app-error" role="alert">{error}<button className="link" onClick={() => setError('')}>닫기</button></div>}
      {screen === 'saving' && (saving ? <Loading text="러닝 기록을 저장하고 있어요." /> : <div className="loading-screen"><p role="alert">기록을 저장하지 못했어요. {error}</p><button className="btn primary" onClick={() => finishRun(pendingRun, pendingDestination.current)}>다시 저장하기</button></div>)}
      {screen === 'login' && <Login onLogin={enter} onSignUp={() => navigate('signup')} onHelp={navigate} confirmAction={confirm} />}
      {screen === 'signup' && <SignUp onLogin={enter} onBack={() => navigate('login')} onVerify={() => navigate('verify-email')} confirmAction={confirm} />}
      {['forgot-password', 'verify-email'].includes(screen) && <AccountHelp key={screen} mode={screen} onBack={() => navigate('login')} />}
      {screen === 'reset-password' && <ResetPassword validSession={recoverySession} confirmAction={confirm} onDone={() => leaveRecovery('login')} onRequestNew={() => requestRecoveryNavigation('forgot-password')} />}
      {screen === 'character' && (
        <CharacterCreate user={user} initial={profile} onDone={async (p) => { if (await confirm({ title: '러닝 설정으로 이동할까요?', description: '완성한 러너로 러닝을 준비합니다.' })) { setProfile(p); setScreen('setup') } }} />
      )}
      {screen === 'setup' && (
        <RunSetup
          profile={profile}
          config={config}
          xp={progression.xp}
          anonymous={user.is_anonymous}
          starting={starting}
          onChange={setConfig}
          onStart={startRun}
        />
      )}
      {screen === 'run' && <RunScreen ref={runControls} profile={profile} config={activeConfig} onFinish={finishRun} confirmAction={confirm} onActivityVisibilityChange={(visible) => setConfig((previous) => ({ ...previous, showActivity: visible }))} />}
      {screen === 'result' && <Result result={result} profile={profile} persisted={!user.is_anonymous} onAgain={() => navigate('setup')} />}
      {screen === 'mypage' && user && <MyPage user={user} profile={profile} onProfile={setProfile} confirmAction={confirm} onNavigate={navigate} />}
      {screen === 'support' && user && <Support suspended={account.suspended} />}
      {screen === 'admin' && account.admin && <Admin confirmAction={confirm} />}
      </Suspense>
      </main>
    </>
  )
}
