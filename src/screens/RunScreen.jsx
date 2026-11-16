// @refresh reset
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { LuFlag, LuBatteryWarning, LuBatteryLow, LuFootprints, LuDroplet, LuZap, LuUsers } from 'react-icons/lu'
import World from '../three/World'
import Runner from '../three/Runner'
import CameraRig from '../three/CameraRig'
import Collectible from '../three/Collectible'
import AidStation from '../three/AidStation'
import { BIOMES, biomeIndexAt } from '../three/biomes'
import { loopGap } from '../three/track'
import { MOCK_RUNNERS, ITEM_TYPES, generateCourse } from '../lib/mockData'
import { cadenceFor, speedMps, totalRunSec, fmtPace } from '../lib/pace'
import { STAMINA, drainPerKm, tiredFor } from '../lib/stamina'
import { activateBooster } from '../lib/simulation'
import { api } from '../lib/api'
import { BIOME_ICONS, CHEER_ICONS, CHEER_KEYS, ITEM_ICONS } from '../lib/icons'
import Hud from '../components/Hud'
import Loading from '../components/Loading'
import { judgeRhythm, rhythmFrame, RHYTHM_WINDOWS } from '../lib/rhythm'
import { autoUnlocked } from '../lib/progression'
import { applyRhythmBoost } from '../lib/rhythmBoost'
import useRaceRoom from '../lib/useRaceRoom'
import { getSettings } from '../lib/settings'
import { advanceElapsed, restoreSimulation, checkpointKey } from '../lib/runClock'
import useRunningSocial, { peerDistance } from '../lib/useRunningSocial'
import { formationOffset } from '../lib/formation'
import { weatherAt } from '../lib/weather'
import { takeNewInvites } from '../lib/invites'
import WeatherEffects from '../three/WeatherEffects'
import { getActivity } from '../lib/activities'
import FinishLine, { FINISH_VISIBLE_M } from '../three/FinishLine'
import FinishCelebration from '../components/FinishCelebration'
import RhythmSpeedEffects from '../components/RhythmSpeedEffects'
import { num } from '../lib/format'


// 시뮬레이션 진행: 거리·체력·탈진/회복 (배속 적용)
function SimDriver({ tick }) {
  useFrame(tick)
  return null
}

const Scene = memo(function Scene({ sim, rhythm, finishDistance, profile, activity, ghosts, getMyDist, getGhostDist, getMyAction, items, stations, closedStations, biome, cheers, onCollect, tick, peers, getPeerDist, cameraDistance, getMyVisualDist, myLane, weather, showActivity }) {
  return (
    <>
      <SimDriver tick={tick} />
      <World biome={biome} weather={weather} />
      {weather.precipitation && <WeatherEffects key={weather.id} weather={weather} getDistance={getMyDist} />}
      <CameraRig getDistance={cameraDistance} getBoost={() => !sim.current.paused && !sim.current.resting && !sim.current.finished ? Math.min(1, (sim.current.rhythmBoostLeft || 0) / .5) : 0} />
      <Runner
        getDistance={getMyVisualDist}
        lane={myLane}
        getAction={getMyAction}
        color={profile.color}
        skin={profile.skin}
        hair={profile.hair}
        outfit={profile.outfit}
        nickname={profile.nickname}
        activity={activity}
        isMe
        cheer={cheers.me?.icon}
        cheerKey={cheers.me?.at}
      />
      {ghosts.map((g) => (
        <Runner
          key={g.id}
          getDistance={() => getGhostDist(g)}
          lane={g.lane}
          color={g.color}
          skin={g.skin}
          hair={g.hair}
          nickname={g.nickname}
          cheer={cheers[g.id]?.icon}
          cheerKey={cheers[g.id]?.at}
        />
      ))}
      {peers.map(peer => <Runner key={peer.id} getDistance={() => getPeerDist(peer)} lane={peer.paired ? formationOffset(peer.slot).lane : -1.4} color={peer.color} skin={peer.skin} hair={peer.hair} outfit={peer.outfit} nickname={peer.nickname} activity={showActivity ? peer.activity : undefined} getAction={() => ({ kneel: false, tired: 0, stopped: peer.paused })} />)}
      <FinishLine distance={finishDistance} getMyDist={getMyDist} />
      {stations.map((st) => (
        <AidStation key={st.id} station={st} getMyDist={getMyDist} closed={closedStations.includes(st.id)} />
      ))}
      {items
        .filter((i) => i.status === 'pending')
        .map((i) => (
          <Collectible key={i.id} item={i} getMyDist={getMyDist} onCollect={onCollect} onTable={!!i.stationId} />
        ))}
    </>
  )
})

export default forwardRef(function RunScreen({ profile, config, onFinish, confirmAction, onActivityVisibilityChange, overlayOpen = false, onCompanionStart }, ref) {
  const totalM = config.distanceKm * 1000
  const cadence = cadenceFor(config.paceSec)
  const ghosts = MOCK_RUNNERS
  const course = useMemo(() => config.resume ? { items: config.resume.items, stations: config.resume.stations } : generateCourse(totalM), [totalM])
  const stations = course.stations

  const sim = useRef(null)
  if (!sim.current) sim.current = restoreSimulation({
    elapsed: 0,
    weatherTimeMs: Date.now(),
    dist: 0,
    totalM,
    targetSec: totalRunSec(config.paceSec, config.distanceKm),
    speed: speedMps(config.paceSec),
    drain: drainPerKm(config.paceSec) * config.drainMultiplier,
    stamina: config.maxStamina,
    maxStamina: config.maxStamina,
    recoverySec: config.recoverySec,
    recoverTo: config.maxStamina * getSettings().recoverRatio,
    boosterUnlocked: config.boosterUnlocked,
    boosterDuration: config.boosterDuration,
    boosterCooldown: config.boosterCooldown,
    boosterCost: config.boosterCost,
    boostLeft: 0, boostCooldownLeft: 0, boostUses: 0,
    practice: !!config.practice,
    speedMult: 1,
    resting: false,
    restLeft: 0,
    restSec: 0,
    exhaust: 0,
    paused: true,
    finished: false,
    timeScale: 1,
  }, config.resume)
  const getMyDist = useCallback(() => sim.current.dist, [])
  const getGhostDist = useCallback((g) => g.start + (sim.current.elapsed * 1000) / g.paceSec, [])
  const getMyAction = useCallback(() => ({ celebrate: sim.current.finished, kneel: sim.current.resting, tired: tiredFor(sim.current.stamina, sim.current.maxStamina), boosting: sim.current.boostLeft > 0 || sim.current.rhythmBoostLeft > 0, rhythmBoosting: sim.current.rhythmBoostLeft > 0 }), [])

  const [ready, setReady] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [items, setItems] = useState(course.items)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const [closedStations, setClosedStations] = useState(config.resume?.closedStations || [])
  const closedRef = useRef(new Set(config.resume?.closedStations || []))
  const [weather, setWeather] = useState(() => weatherAt(sim.current.weatherTimeMs))
  const weatherEpoch = useRef(weather.epoch)
  const [biomeIdx, setBiomeIdx] = useState(0)
  const biomeRef = useRef(0)
  const [cheers, setCheers] = useState({})
  const [toasts, setToasts] = useState([])
  const seenInvites = useRef(new Set())
  const [friendPanelRequest, setFriendPanelRequest] = useState(0)
  const [judge, setJudge] = useState(null)
  const [paused, setPaused] = useState(config.resume?.sim.paused ?? !!config.groupPaused)
  const [showActivity, setShowActivity] = useState(config.showActivity !== false)
  const [activity, setActivity] = useState(() => getActivity(config.resume?.activity || config.activity).id)
  const room = useRaceRoom({ userId: profile.userId, nickname: profile.nickname, paused: paused || !ready, profile, config, sim, ready })
  const toggleActivity = () => { const next = !showActivity; setShowActivity(next); onActivityVisibilityChange?.(next) }
  const [timeScale, setTimeScale] = useState(1)
  const stats = useRef(config.resume?.stats || { score: 0, collected: 0, supplies: 0, missedSupplies: 0, medals: 0, combo: 0, maxCombo: 0, cheersSent: 0, cheersGot: 0, perfect: 0, good: 0 })
  const [statsView, setStatsView] = useState({ ...stats.current })
  const rhythm = useRef({ elapsed: config.resume?.rhythmElapsed || 0, period: (4 * 60) / cadence, lastIdx: -1 })
  const clock = useRef(performance.now())
  const tick = useCallback(() => {
    const now = performance.now()
    const seconds = Math.max(0, (now - clock.current) / 1000)
    clock.current = now
    advanceElapsed(sim.current, seconds, rhythm.current)
  }, [])
  const social = useRunningSocial({ profile, config, sim, ready, activity })
  const [locateId, setLocateId] = useState(null)
  const socialRef = useRef(social)
  socialRef.current = social
  const getPeerDist = useCallback(peer => peer.paired ? sim.current.dist + formationOffset(peer.slot).distance : peerDistance(peer), [])
  const getMyVisualDist = useCallback(() => sim.current.dist + formationOffset(socialRef.current.pair?.mySlot).distance, [])
  const myFormation = formationOffset(social.pair?.mySlot)
  const cameraDistance = () => {
    const target = socialRef.current.peers.find(peer => peer.id === locateId)
    return target ? getPeerDist(target) : sim.current.dist
  }
  const priorGroup = useRef(null)
  useEffect(() => {
    const group=social.pair
    if (group) { tick(); sim.current.paused=!!group.paused; setPaused(!!group.paused) }
    else if (priorGroup.current) { tick(); sim.current.paused=false; setPaused(false) }
    priorGroup.current=group?.id || null
  },[social.pair?.id,social.pair?.paused,tick])
  const persistence = useRef(null)
  const saveBusy = useRef(false)
  const [checkpointError, setCheckpointError] = useState('')
  persistence.current = async (cloud = false) => {
    if (config.anonymous) return
    tick()
    const snapshot = { version: 1, runId: config.id, savedAt: Date.now(), sim: { ...sim.current },
      stats: { ...stats.current }, items: itemsRef.current, stations, closedStations: [...closedRef.current],
      activity, showActivity, shareActivity: socialRef.current.shareActivity, publicLocation: socialRef.current.publicLocation, rhythmElapsed: rhythm.current.elapsed, autoUsed: autoUsed.current }
    try { localStorage.setItem(checkpointKey(profile.userId), JSON.stringify(snapshot)) }
    catch { setCheckpointError('자동 저장이 지연되고 있어요. 잠시 후 다시 저장할게요.') }
    if (cloud && !saveBusy.current) {
      saveBusy.current = true
      try { await api.saveCheckpoint(config.id, snapshot); setCheckpointError('') }
      catch { setCheckpointError('자동 저장이 지연되고 있어요. 잠시 후 다시 저장할게요.') }
      finally { saveBusy.current = false }
    }
  }
  useEffect(() => {
    const advance = () => tick()
    const save = () => { tick(); persistence.current?.(true) }
    const timer = setInterval(advance, 100)
    const localTimer = setInterval(() => persistence.current?.(), 1000)
    const cloudTimer = setInterval(() => persistence.current?.(true), 10000)
    window.addEventListener('pagehide', save)
    window.addEventListener('focus', save)
    document.addEventListener('visibilitychange', save)
    return () => { clearInterval(timer); clearInterval(localTimer); clearInterval(cloudTimer); window.removeEventListener('pagehide', save); window.removeEventListener('focus', save); document.removeEventListener('visibilitychange', save) }
  }, [tick])
  const finishedRef = useRef(false)
  const exitPending = useRef(false)
  const manualPending = useRef(false)
  const lastCheer = useRef({})
  const flags = useRef({ resting: false, low: false })

  const bump = () => setStatsView({ ...stats.current })

  // AUTO (Lv.autoLevel+): collects supplies and medals in reach and hits every rhythm beat on PERFECT.
  const autoAvailable = !config.anonymous && autoUnlocked(config.level)
  const [auto, setAuto] = useState(() => {
    if (!autoAvailable) return false
    try { return localStorage.getItem('rundash:auto') !== 'off' } catch { return true }
  })
  const autoRef = useRef(auto)
  autoRef.current = auto
  // Remembered on the saved run so admins can tell AUTO runs apart.
  const autoUsed = useRef(!!config.resume?.autoUsed)
  if (auto && ready) autoUsed.current = true
  const toggleAuto = () => {
    if (!autoAvailable) return toast(`AUTO는 Lv.${getSettings().autoLevel}부터 사용할 수 있어요`, 'warn')
    const next = !autoRef.current
    try { localStorage.setItem('rundash:auto', next ? 'on' : 'off') } catch { /* The toggle still works without storage. */ }
    setAuto(next)
    toast(next ? 'AUTO 켜짐 · 보급·메달·리듬 러닝을 자동으로 수행해요' : 'AUTO 꺼짐', 'info')
  }

  const toast = useCallback((text, kind = 'info', icon = null, action = null) => {
    const id = Math.random()
    setToasts((t) => [...t.slice(-3), { id, text, kind, icon, action }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'invite' ? 6500 : 2600)
  }, [])
  const paceReport = useRef(Math.floor((config.resume?.sim.elapsed || 0) / 300))
  const distancePaceReport = useRef(Math.floor((config.resume?.sim.dist || 0) / 1000))
  useEffect(() => {
    const timer = setInterval(() => {
      const s = sim.current
      const period = Math.floor(s.elapsed / 300)
      if (!ready || s.paused || s.finished || period <= paceReport.current) return
      paceReport.current = period
      const weather = weatherAt(s.weatherTimeMs)
      const extra = Math.round((weather.drainMultiplier - 1) * 100)
      const pace = s.resting ? '회복 중' : `${fmtPace(1000 / (s.speed * (s.speedMult || 1)))}/km`
      const boosts = [s.boostLeft > 0 && '부스터', s.rhythmBoostLeft > 0 && '리듬 부스트'].filter(Boolean)
      toast(`${period * 5}분 · 현재 ${pace}${boosts.length ? ` · ${boosts.join(' + ')}` : ''} · ${weather.label}${extra ? ` (체력 소모 +${extra}%)` : ''}`, 'info', LuFootprints)
    }, 1000)
    return () => clearInterval(timer)
  }, [ready, toast])

  useEffect(() => {
    const fresh = takeNewInvites(social.invites,seenInvites.current)
    if (fresh.length) {
      const description = fresh.length > 1 ? `${fresh[0].nickname}님 외 ${fresh.length-1}명이 함께 달리기를 초대했어요` : `${fresh[0].nickname}님이 함께 달리기를 초대했어요`
      toast(description, 'invite', LuUsers, { label: '초대 보기', onClick: () => setFriendPanelRequest(value => value+1) })
    }
  }, [social.invites, toast])

  useEffect(() => {
    const id = setTimeout(() => {
      setReady(true)
      clock.current = performance.now()
      if (!config.resume) { sim.current.paused = !!config.groupPaused; rhythm.current.elapsed = 0 }
      persistence.current?.(true)
      toast(`출발! ${BIOMES[0].name} 구간`, 'km', LuFlag)
    }, 1400)
    return () => clearTimeout(id)
  }, [toast])

  const nearestGhost = useCallback(() => {
    const my = getMyDist()
    let best = null
    for (const g of ghosts) {
      const gap = loopGap(getGhostDist(g), my)
      if (Math.abs(gap) < getSettings().cheerRadius && (!best || Math.abs(gap) < Math.abs(best.gap))) best = { g, gap }
    }
    return best
  }, [getMyDist, getGhostDist, ghosts])

  const runSnapshot = (completed) => { const s=sim.current; return {
      id: config.id,
      intensity: config.intensity,
      practice: s.practice,
      boostUses: s.boostUses,
      autoUsed: autoUsed.current,
      completed,
      nickname: profile.nickname,
      activity,
      targetKm: config.distanceKm,
      distanceKm: s.dist / 1000,
      elapsedSec: s.elapsed,
      targetSec: s.targetSec,
      paceSec: s.dist > 0 ? s.elapsed / (s.dist / 1000) : config.paceSec,
      targetPaceSec: config.paceSec,
      exhaustCount: s.exhaust,
      restSec: s.restSec,
      suppliesTotal: itemsRef.current.filter((i) => i.stationId).length,
      medalsTotal: itemsRef.current.filter((i) => !i.stationId).length,
      ...stats.current,
    } }
  const finish = (completed, destination = 'result') => {
    if (finishedRef.current) return
    finishedRef.current = true; sim.current.paused = true
    onFinish(runSnapshot(completed), destination)
  }
  const joinIds = useRef(new Map())
  const acceptCompanionInvite = async (id) => {
    tick()
    if (exitPending.current || finishedRef.current || sim.current.finished) throw new Error('러닝 종료 후 다시 초대해 주세요.')
    const wasPaused = sim.current.paused
    exitPending.current = true; sim.current.paused = true; setPaused(true)
    if (!joinIds.current.has(id)) joinIds.current.set(id,crypto.randomUUID())
    try {
      const value = await api.acceptInvite(id,runSnapshot(false),joinIds.current.get(id))
      onCompanionStart(value)
    } catch (error) { sim.current.paused=wasPaused; setPaused(wasPaused); throw error }
    finally { exitPending.current=false }
  }

  const requestExit = async (destination = 'result') => {
    tick()
    // A finished run is already complete: leaving just saves it, no confirmation needed.
    if (sim.current.finished && !finishedRef.current) return finish(true, destination)
    if (finishedRef.current || sim.current.finished || exitPending.current || !ready) return
    exitPending.current = true
    const wasPaused = sim.current.paused
    if (!socialRef.current.pair) { sim.current.paused = true; setPaused(true) }
    const exitingToMenu = destination !== 'result'
    try {
      const accepted = await confirmAction({
        title: destination === 'logout' ? '러닝을 종료하고 로그아웃할까요?' : exitingToMenu ? '러닝을 종료하고 이동할까요?' : '러닝을 여기서 종료할까요?',
        description: config.anonymous ? '현재까지 달린 결과를 확인할 수 있지만, 익명 체험 기록과 경험치는 저장되지 않아요.' : sim.current.practice ? '개발 체험 기록으로 저장되며 경험치는 지급되지 않아요.' : '달린 거리까지 기록과 경험치를 저장해요. 남은 코스는 이어서 달릴 수 없어요.',
        confirmLabel: destination === 'logout' ? '종료 후 로그아웃' : exitingToMenu ? '종료하고 이동' : '종료하고 결과 보기',
        cancelLabel: wasPaused ? '돌아가기' : '계속 달리기',
      })
      if (accepted) finish(false, destination)
      else if (!socialRef.current.pair) { sim.current.paused = wasPaused; setPaused(wasPaused) }
    } finally { exitPending.current = false }
  }
  const pauseForManual = () => {
    tick()
    if (!ready || finishedRef.current || sim.current.finished || exitPending.current) return null
    const wasPaused = sim.current.paused
    if (socialRef.current.pair) { manualPending.current=true; return () => { manualPending.current=false } }
    manualPending.current = true; sim.current.paused = true; setPaused(true)
    return () => { manualPending.current = false; if (!finishedRef.current) { sim.current.paused = wasPaused; setPaused(wasPaused) } }
  }
  useImperativeHandle(ref, () => ({ requestExit, pauseForManual }))

  // 아이템/보급품 줍기
  const canGrab = (item, my) => {
    const gap = item.dist - my
    return item.stationId
      ? gap <= STAMINA.stationGrabBeforeM && gap >= -STAMINA.stationGrabAfterM
      : gap <= 60 && gap >= -4
  }

  const collect = (item) => {
    tick()
    const s = sim.current
    const cur = itemsRef.current.find((i) => i.id === item.id)
    if (!cur || cur.status !== 'pending' || s.paused) return
    if (s.resting) return toast('회복 중에는 움직일 수 없어요', 'warn', LuBatteryLow)
    const my = getMyDist()
    if (!canGrab(cur, my)) {
      return toast(cur.stationId ? '보급소에 도착하면 챙길 수 있어요' : '아직 멀어요. 가까워지면 눌러주세요', 'warn')
    }
    const t = ITEM_TYPES[cur.type]
    const mult = 1 + Math.min(stats.current.combo, getSettings().comboCap) * getSettings().comboBonus
    const pts = Math.round(t.points * mult)
    stats.current.score += pts
    stats.current.collected++
    let msg = `${t.label} +${num(pts)}pt`
    if (t.restore) {
      const before = s.stamina
      s.stamina = Math.min(s.maxStamina, s.stamina + t.restore)
      stats.current.supplies++
      msg = `${t.label} · 체력 +${num(Math.round(s.stamina - before))}`
    } else {
      stats.current.medals++
    }
    setItems((l) => l.map((i) => (i.id === cur.id ? { ...i, status: 'got' } : i)))
    toast(msg, 'good', ITEM_ICONS[cur.type])
    bump()
  }
  const collectRef = useRef(collect)
  collectRef.current = collect
  const onCollect = useCallback((item) => collectRef.current(item), [])

  // E: 근처 보급품(우선) → 메달
  const collectNearest = () => {
    const my = getMyDist()
    const cands = itemsRef.current.filter((i) => i.status === 'pending' && canGrab(i, my))
    const pick =
      cands.find((i) => i.stationId && i.type === (sim.current.stamina < 50 ? 'gel' : 'water')) ||
      cands.find((i) => i.stationId) ||
      cands.sort((a, b) => a.dist - b.dist)[0]
    if (!pick) return toast('근처에 챙길 게 없어요', 'warn')
    collect(pick)
  }

  const cheer = () => {
    if (sim.current.paused || sim.current.resting) return
    const n = nearestGhost()
    if (!n) return toast(`근처(${getSettings().cheerRadius}m)에 러너가 없어요`, 'warn')
    const now = Date.now()
    if (now - (lastCheer.current[n.g.id] || 0) < 2000) return
    lastCheer.current[n.g.id] = now
    const key = CHEER_KEYS[Math.floor(Math.random() * CHEER_KEYS.length)]
    setCheers((c) => ({ ...c, [n.g.id]: { icon: key, at: now } }))
    stats.current.cheersSent++
    stats.current.score += getSettings().cheerPoints
    toast(`${n.g.nickname}님에게 응원 +${getSettings().cheerPoints}`, 'good', CHEER_ICONS[key])
    bump()
  }

  const hitBeat = () => {
    tick()
    if (!ready || sim.current.finished || sim.current.paused || sim.current.resting) return
    const r = rhythm.current
    const judgment = judgeRhythm(r, stats.current)
    if (!judgment) return
    const boosted = applyRhythmBoost(sim.current, judgment.res)
    setJudge({ ...judgment, boosted, at: Date.now() })
    if (boosted) toast('리듬 부스트! 3초 동안 속도 +5%', 'good', LuZap)
    bump()
  }

  const pauseRequest = useRef(false)
  const togglePause = async () => {
    tick()
    if (finishedRef.current || !ready || pauseRequest.current) return
    const group = socialRef.current.pair
    if (group && group.leader_id !== profile.userId) return
    const next = !sim.current.paused
    pauseRequest.current = true
    try {
      if (group) await api.pauseGroup(next)
      tick(); sim.current.paused=next; setPaused(next)
      if (group) socialRef.current.refresh()
    } catch { toast('지금은 일시정지를 바꾸지 못했어요. 잠시 후 다시 눌러 주세요.','warn') }
    finally { pauseRequest.current=false }
  }

  const changeScale = (v) => {
    tick()
    if (!import.meta.env.DEV || ![1, 10, 30, 60].includes(v)) return
    if (v > 1 && !sim.current.practice) {
      sim.current.practice = true
      if (!config.anonymous) api.markPractice(config.id).catch(() => toast('체험 기록으로만 처리돼요. 경험치는 지급되지 않아요.', 'warn'))
      toast('개발용 배속 · 이번 러닝은 경험치가 지급되지 않아요.', 'warn')
    }
    sim.current.timeScale = v
    setTimeScale(v)
  }

  const boost = () => {
    tick()
    if (activateBooster(sim.current)) toast(`부스터! ${config.boosterDuration}초 동안 속도 +${Math.round((getSettings().boostMultiplier - 1) * 100)}%`, 'good', LuZap)
  }

  const handlers = useRef({})
  handlers.current = { hitBeat, cheer, collectNearest, togglePause, boost, toggleAuto }
  useEffect(() => {
    const onKey = (e) => {
      if (exitPending.current || manualPending.current || e.repeat || e.target.closest('input, textarea, select, [contenteditable="true"], .runner-chat')) return
      const h = handlers.current
      if (e.code === 'Space') { e.preventDefault(); h.hitBeat() }
      else if (import.meta.env.DEV && e.code === 'KeyC') h.cheer()
      else if (e.code === 'KeyE') h.collectNearest()
      else if (e.code === 'KeyB') h.boost()
      else if (e.code === 'KeyA') h.toggleAuto()
      else if (e.code === 'KeyP' || e.code === 'Escape') h.togglePause()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 저빈도 게임 루프: 구간, 지나친 보급소/메달, 체력 상태 알림, 응원 수신, 완주
  const loopRef = useRef()
  loopRef.current = () => {
    const s = sim.current
    const my = s.dist
    if (!flags.current.finishNear && !s.finished && totalM > FINISH_VISIBLE_M * 2 && totalM - my <= FINISH_VISIBLE_M) {
      flags.current.finishNear = true
      toast(`결승선이 보여요! ${num(Math.round(totalM - my))}m 남았어요`, 'km', LuFlag)
    }
    const currentWeather = weatherAt(s.weatherTimeMs)
    if (currentWeather.epoch !== weatherEpoch.current) {
      weatherEpoch.current = currentWeather.epoch
      setWeather(currentWeather)
      toast(`날씨가 바뀌었어요 · ${currentWeather.label} ${currentWeather.temperature}°C`, currentWeather.drainMultiplier > 1 ? 'warn' : 'info')
    }

    const bi = biomeIndexAt(my)
    if (bi !== biomeRef.current) {
      biomeRef.current = bi
      setBiomeIdx(bi)
    }
    const kmPassed = Math.floor(my / 1000)
    if (ready && kmPassed > distancePaceReport.current) {
      distancePaceReport.current = kmPassed
      const pace = s.resting || s.speedMult <= 0 ? '회복 중' : `${fmtPace(1000 / (s.speed * s.speedMult))}/km`
      toast(`${num(kmPassed)}km 통과! · 현재 페이스 ${pace} · ${BIOMES[bi].name} 구간`, 'km', LuFootprints)
    }

    // 지나친 보급소는 끝
    for (const st of stations) {
      if (!closedRef.current.has(st.id) && my > st.dist + STAMINA.stationGrabAfterM) {
        closedRef.current.add(st.id)
        setClosedStations([...closedRef.current])
        const left = itemsRef.current.filter((i) => i.stationId === st.id && i.status === 'pending')
        if (left.length) {
          stats.current.missedSupplies += left.length
          toast(`보급소 ${st.n} 지나침. 못 챙긴 보급품 ${left.length}개는 사라졌어요`, 'warn', LuDroplet)
        }
      }
    }
    const missed = itemsRef.current.filter(
      (i) => i.status === 'pending' && (i.stationId ? closedRef.current.has(i.stationId) : i.dist < my - 4)
    )
    if (missed.length) {
      const ids = new Set(missed.map((m) => m.id))
      setItems((l) => l.map((i) => (ids.has(i.id) ? { ...i, status: 'missed' } : i)))
    }

    // AUTO: pick up every supply and medal that is in reach.
    if (autoRef.current && ready && !s.paused && !s.resting && !s.finished) {
      for (const item of itemsRef.current) if (item.status === 'pending' && canGrab(item, my)) collect(item)
    }

    // 체력 상태 알림
    if (s.resting && !flags.current.resting) {
      flags.current.resting = true
      toast(`탈진! ${s.recoverySec}초 회복해야 해요`, 'bad', LuBatteryLow)
    } else if (!s.resting && flags.current.resting) {
      flags.current.resting = false
      flags.current.low = false
      toast('회복 완료. 다시 출발!', 'km', LuFootprints)
    }
    if (!s.resting && s.stamina / s.maxStamina < .25 && !flags.current.low) {
      flags.current.low = true
      const next = stations.find((st) => st.dist + STAMINA.stationGrabAfterM > my)
      toast(next ? `체력이 바닥나고 있어요. 보급소 ${next.n}까지 ${num(Math.max(0, Math.round(next.dist - my)))}m` : '체력이 바닥나고 있어요', 'warn', LuBatteryWarning)
    }
    if (s.stamina / s.maxStamina >= .35) flags.current.low = false

    if (import.meta.env.DEV && !s.paused && !s.resting && Math.random() < 0.015) {
      const n = nearestGhost()
      if (n) {
        setCheers((c) => ({ ...c, me: { icon: 'flame', at: Date.now() } }))
        stats.current.cheersGot++
        toast(`${n.g.nickname}님이 응원했어요`, 'info', CHEER_ICONS.flame)
        bump()
      }
    }

    // Celebrate first; results open when the runner chooses (or from any menu).
    if (s.finished && !finishedRef.current) setCelebrating(true)
  }
  useEffect(() => {
    const id = setInterval(() => loopRef.current(), 250)
    return () => clearInterval(id)
  }, [])
  // AUTO rhythm: sleep until the centre of the next beat, then hit it inside the PERFECT window.
  // One timer per beat instead of polling; while paused or resting it re-checks every half second.
  useEffect(() => {
    if (!auto || !ready) return
    let timer
    const step = () => {
      const s = sim.current
      let wait = 500
      if (!s.finished && !s.paused && !s.resting && !manualPending.current && !exitPending.current) {
        tick()
        const r = rhythm.current, frame = rhythmFrame(r)
        if (frame.cycle !== r.lastIdx && frame.offset <= RHYTHM_WINDOWS.perfect * .8) handlers.current.hitBeat()
        // The beat centre sits at phase .5; aim for this cycle's centre if it is still ahead, else the next one.
        const centre = (frame.cycle + .5) * r.period
        const target = r.elapsed < centre && frame.cycle !== r.lastIdx ? centre : centre + r.period
        wait = Math.max(5, (target - r.elapsed) * 1000)
      }
      timer = setTimeout(step, Math.min(wait, 500))
    }
    step()
    return () => clearTimeout(timer)
  }, [auto, ready, tick])

  return (
    <div className="run-screen">
      <Canvas camera={{ fov: 55, near: 0.1, far: 700, position: [0, 5, -10] }} dpr={[1, 1.75]}>
        <Scene
          tick={tick}
          peers={social.peers}
          getPeerDist={getPeerDist}
          cameraDistance={cameraDistance}
          getMyVisualDist={getMyVisualDist}
          myLane={myFormation.lane}
          weather={weather}
          showActivity={showActivity}
          sim={sim}
          rhythm={rhythm}
          profile={profile}
          activity={showActivity ? activity : undefined}
          ghosts={ghosts}
          getMyDist={getMyDist}
          getGhostDist={getGhostDist}
          getMyAction={getMyAction}
          finishDistance={totalM}
          items={items}
          stations={stations}
          closedStations={closedStations}
          biome={BIOMES[biomeIdx]}
          cheers={cheers}
          onCollect={onCollect}
        />
      </Canvas>
      {ready && <RhythmSpeedEffects sim={sim} />}
      {celebrating && <FinishCelebration distanceKm={sim.current.dist / 1000} elapsedSec={sim.current.elapsed} onResults={() => finish(true)} />}

      {ready ? (
        <Hud
          sim={sim}
          room={room}
          showPauseDialog={!overlayOpen && !exitPending.current}
          canPause={!social.pair || social.pair.leader_id === profile.userId}
          onAcceptInvite={acceptCompanionInvite}
          social={social}
          friendPanelRequest={friendPanelRequest}
          confirmAction={confirmAction}
          checkpointError={checkpointError}
          locating={!!locateId}
          onLocateFriend={id => { social.setFocusId(id); setLocateId(id) }}
          onReturnToRunner={() => { social.setFocusId(null); setLocateId(null) }}
          myVisualPose={{ distance: getMyVisualDist(), lane: myFormation.lane }}
          realPeers={social.peers.map(peer => ({ ...peer, dist: getPeerDist(peer), lane: peer.paired ? formationOffset(peer.slot).lane : -1.4 }))}
          showActivity={showActivity}
          onToggleActivity={toggleActivity}
          activity={activity}
          onActivityChange={value => setActivity(getActivity(value).id)}
          getMyDist={getMyDist}
          getGhostDist={getGhostDist}
          ghosts={ghosts}
          nearestGhost={nearestGhost}
          profile={profile}
          config={config}
          totalM={totalM}
          biome={BIOMES[biomeIdx]}
          stats={statsView}
          items={items}
          stations={stations}
          closedStations={closedStations}
          rhythm={rhythm}
          judge={judge}
          cadence={cadence}
          toasts={toasts}
          paused={paused}
          timeScale={timeScale}
          onTimeScale={changeScale}
          onBoost={boost}
          onPause={togglePause}
          onQuit={() => requestExit()}
          onBeat={hitBeat}
          onCheer={cheer}
          onCollect={onCollect}
          onCollectNearest={collectNearest}
          auto={auto}
          autoAvailable={autoAvailable}
          onToggleAuto={toggleAuto}
        />
      ) : (
        <div className="run-loading">
          <Loading text="코스와 보급소를 준비하고 있어요." sub={import.meta.env.DEV ? `테스트 AI 러너 ${ghosts.length}명이 같은 코스에서 기다리고 있어요.` : undefined} />
        </div>
      )}
    </div>
  )
})
