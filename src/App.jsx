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
import Footer from './components/Footer'
import { configureSettings, getSettings } from './lib/settings'
import { readLocalCheckpoint, clearLocalCheckpoint, validCheckpoint } from './lib/runClock'


const loadCharacterCreate = () => import('./screens/CharacterCreate')
const loadRunSetup = () => import('./screens/RunSetup')
const loadRunScreen = () => import('./screens/RunScreen')
const SignUp = lazy(() => import('./screens/SignUp'))
const CharacterCreate = lazy(loadCharacterCreate)
const RunSetup = lazy(loadRunSetup)
const RunScreen = lazy(loadRunScreen)

// Warm the three.js screens while the visitor reads the login page, unless they asked to save data.
function prefetchRunnerScreens() {
  if (navigator.connection?.saveData) return
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500))
  idle(() => { for (const load of [loadRunSetup, loadCharacterCreate, loadRunScreen]) load().catch(() => {}) }, { timeout: 4000 })
}
const Result = lazy(() => import('./screens/Result'))
const MyPage = lazy(() => import('./screens/MyPage'))
const Admin = lazy(() => import('./screens/Admin'))
const Ranking = lazy(() => import('./screens/Ranking'))
const Attendance = lazy(() => import('./screens/Attendance'))

const SCREEN_NAMES = { admin: '관리자', ranking: '주간 랭킹', attendance: '출석 달력', support: '문의하기', mypage: '마이페이지', login: '로그인', signup: '회원가입', character: '러너 만들기', setup: '러닝 설정', 'forgot-password': '비밀번호 찾기', 'verify-email': '이메일 재인증', result: '러닝 결과' }

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
  const [resumeOffer, setResumeOffer] = useState(null)
  const [starting, setStarting] = useState(false)
  const startId = useRef(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState('')
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

  const withLoading = async (text, task) => {
    setPending(text)
    try { return await task() } finally { setPending('') }
  }

  const enter = (u) => withLoading('러너 정보를 불러오고 있어요.', async () => {
    const [settings, status, p] = await Promise.all([api.getSettings(), api.accountStatus(), u.is_anonymous ? null : api.getProfile(u.id)])
    configureSettings(settings.value)
    setNotice('')
    setAccount(status)
    setUser(u)
    setProfile(p)
    setProgression({ xp: 0 })
    setResumeOffer(null)
    const member = p && !u.is_anonymous
    // Growth and the resumable run are independent, so load them together.
    const [growth, saved] = await Promise.allSettled([
      member ? api.getProgression(u.id) : null,
      member && !status.suspended ? api.loadCheckpoint() : null,
    ])
    if (member) {
      if (growth.status === 'fulfilled') setProgression(growth.value)
      else setError('성장 정보를 불러오지 못했어요. 러닝 시작 시 다시 확인할게요.')
    }
    // A rejected checkpoint load is ignored: older deployments can still log in before the migration.
    if (saved.status === 'fulfilled' && saved.value?.session) {
      const local = readLocalCheckpoint(u.id)
      const payloads = [local, saved.value.payload].filter(value => validCheckpoint(value, saved.value.session.id))
      payloads.sort((a,b) => b.savedAt - a.savedAt)
      setResumeOffer({ payload: payloads[0] || null, session: saved.value.session })
    }
    setScreen(status.suspended ? 'support' : p ? 'setup' : 'character')
  })

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

  useEffect(prefetchRunnerScreens, [])

  // Screens share one URL, so tell Google Tag Manager about each screen as a virtual page.
  // Only the screen name is sent: no account, email or nickname.
  useEffect(() => {
    if (['loading', 'saving'].includes(screen)) return
    window.dataLayer?.push({ event: 'rundash_screen_view', screen_name: screen, page_path: `/app/${screen}`, page_title: SCREEN_NAMES[screen] || screen })
  }, [screen])

  // Only warn on leave where progress could be lost: an active run, a pending save or an unsaved runner.
  const guardLeave = ['run', 'saving', 'character'].includes(screen)
  useEffect(() => {
    if (!guardLeave) return
    const beforeUnload = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [guardLeave])

  const logout = async () => {
    await api.signOut()
    setError('')
    setUser(null)
    setProfile(null)
    setScreen('login')
  }

  const navigate = async (next) => {
    if (next === screen || starting || saving || pending) return
    if (next === 'admin' && !account.admin) return
    if (next === 'attendance' && (!user || user.is_anonymous)) return
    if (account.suspended && !['support', 'mypage', 'login', 'signup'].includes(next)) { setError('이용이 제한된 계정이에요. 문의하기로 연락해 주세요.'); return }
    if (screen === 'run') return runControls.current?.requestExit(next)
    if (!await confirm({ title: `${SCREEN_NAMES[next] || '다른 화면'} 화면으로 이동할까요?`, description: screen === 'character' ? '저장하지 않은 러너 변경사항은 사라져요.' : '입력 중인 내용은 이동하면 초기화될 수 있어요.' })) return
    try {
      if (next === 'setup') await withLoading('러닝 설정을 불러오고 있어요.', async () => configureSettings((await api.getSettings()).value))
      setError(''); setScreen(next)
    } catch { setError('러닝 설정을 불러오지 못했어요. 다시 시도해 주세요.') }
  }

  const requestLogout = async () => {
    if (screen === 'run') return runControls.current?.requestExit('logout')
    if (!await confirm({ title: '로그아웃할까요?', description: user?.is_anonymous ? '익명 러너와 체험 기록은 사라져요.' : '로그인 화면으로 돌아갑니다. 저장하지 않은 변경사항은 사라져요.', confirmLabel: '로그아웃' })) return
    try { await withLoading('로그아웃하고 있어요.', logout) } catch (err) { setError(err.message) }
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
        setResult({ ...saved.run, attendance: saved.attendance })
        setProgression(saved.progression)
      }
      if (destination === 'logout') await logout()
      else setScreen(destination)
      clearLocalCheckpoint(user.id)
      setResumeOffer(null)
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
      // Load the 3D run screen alongside the server ticket so only one loading screen shows.
      const ticket = await withLoading('러닝 코스를 준비하고 있어요.', async () => (await Promise.all([user.is_anonymous ? { id: startId.current, xp: 0 } : api.startRun({ id: startId.current, ...config }), loadRunScreen()]))[0])
      if (ticket.settings) configureSettings(ticket.settings)
      setProgression((previous) => ({ ...previous, xp: ticket.xp }))
      setActiveConfig({ ...config, distanceKm: ticket.distanceKm ?? config.distanceKm, ...trainingFor(ticket.xp, ticket.intensity || config.intensity, user.is_anonymous, Number(ticket.paceSec) || config.customPace), id: ticket.id, anonymous: user.is_anonymous })
      clearLocalCheckpoint(user.id)
      setResumeOffer(null)
      startId.current = null
      setScreen('run')
    } catch (err) { setError(err.message || '러닝을 준비하지 못했어요. 다시 시도해 주세요.') }
    finally { setStarting(false) }
  }

  const enterCompanionRun = (value) => {
    const ticket = value.ticket
    setProgression(previous => value.previousRun?.progression || { ...previous, xp: ticket.xp })
    configureSettings(ticket.settings)
    setActiveConfig({ ...config, ...trainingFor(ticket.xp, ticket.intensity, false, Number(ticket.paceSec)), paceSec: Number(ticket.paceSec), distanceKm: Number(ticket.distanceKm), id: ticket.id, anonymous: false, groupPaused: !!ticket.groupPaused })
    setConfig(previous => ({ ...previous, distanceKm: Number(ticket.distanceKm), intensity: ticket.intensity }))
    clearLocalCheckpoint(user.id); setResumeOffer(null); setError(''); setScreen('run')
  }

  const resumeRun = async () => {
    if (!resumeOffer || starting) return
    setStarting(true)
    try {
      if (!await confirm({ title: '진행 중이던 러닝을 이어갈까요?', description: '달리던 러너는 마지막 저장 시점부터 경과 시간을 반영하고, 일시정지 중이었다면 그대로 복원해요.' })) return
      const fresh = await withLoading('달리던 러닝을 불러오고 있어요.', async () => (await Promise.all([api.loadCheckpoint(), loadRunScreen()]))[0])
      if (fresh?.session.id !== resumeOffer.session.id) throw new Error('이미 종료되거나 다른 곳에서 새로 시작한 러닝이에요.')
      const session = fresh.session
      configureSettings(session.rules)
      setActiveConfig({ ...config, ...trainingFor(session.xp_at_start, session.intensity, false, Number(session.pace_sec)), paceSec: Number(session.pace_sec), distanceKm: Number(session.target_km), id: session.id, anonymous: false, practice: session.practice, activity: resumeOffer.payload?.activity || 'rest', showActivity: resumeOffer.payload?.showActivity !== false, resume: resumeOffer.payload || undefined })
      setResumeOffer(null); setError(''); setScreen('run')
    } catch (err) { setError(err.message || '러닝을 복구하지 못했어요.') }
    finally { setStarting(false) }
  }

  return (
    <>
      <Header user={user} profile={profile} admin={account.admin} screen={starting || pending ? 'loading' : screen} onNavigate={navigate} onLogout={requestLogout} onHelp={openManual} />
      {pending && screen !== 'loading' && <Loading overlay text={pending} />}
      {question && <ConfirmDialog {...question} onAnswer={answer} />}
      {manualOpen && <ManualDialog onClose={closeManual} />}
      <main className="app-content">
      <Suspense fallback={<Loading text="화면을 준비하고 있어요." />}>
      {screen === 'loading' && <Loading text="러너를 깨우고 있어요." />}
      {error && screen !== 'saving' && <div className="app-error" role="alert">{error}<button className="link" onClick={() => setError('')}>닫기</button></div>}
      {notice && !error && <div className="app-error app-notice" role="status">{notice}<button className="link" onClick={() => setNotice('')}>닫기</button></div>}
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
          onOpenAttendance={() => navigate('attendance')}
          resumeOffer={resumeOffer}
          onResume={resumeRun}
        />
      )}
      {screen === 'run' && <RunScreen key={activeConfig?.id} onCompanionStart={enterCompanionRun} overlayOpen={!!question || manualOpen} ref={runControls} profile={profile} config={activeConfig} onFinish={finishRun} confirmAction={confirm} onActivityVisibilityChange={(visible) => setConfig((previous) => ({ ...previous, showActivity: visible }))} />}
      {screen === 'result' && <Result result={result} profile={profile} persisted={!user.is_anonymous} onAgain={() => navigate('setup')} />}
      {screen === 'mypage' && user && <MyPage user={user} profile={profile} onProfile={setProfile} confirmAction={confirm} onNavigate={navigate} onDeleted={() => { setUser(null); setProfile(null); setAccount({ admin: false, suspended: false }); setNotice('회원 탈퇴가 완료됐어요. 그동안 함께 달려주셔서 고마워요.'); setScreen('login') }} />}
      {screen === 'support' && user && <Support suspended={account.suspended} />}
      {screen === 'admin' && account.admin && <Admin confirmAction={confirm} />}
      {screen === 'ranking' && user && <Ranking anonymous={user.is_anonymous} onRun={() => navigate(profile ? 'setup' : 'character')} />}
      {screen === 'attendance' && user && !user.is_anonymous && <Attendance onRun={() => navigate('setup')} />}
      </Suspense>
      </main>
      {!['run', 'character', 'loading', 'saving'].includes(screen) && <Footer />}
    </>
  )
}
