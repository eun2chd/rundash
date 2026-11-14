// @refresh reset
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { LuFlag, LuBatteryWarning, LuBatteryLow, LuFootprints, LuDroplet, LuZap } from 'react-icons/lu'
import World from '../three/World'
import Runner from '../three/Runner'
import CameraRig from '../three/CameraRig'
import Collectible from '../three/Collectible'
import AidStation from '../three/AidStation'
import { BIOMES, biomeIndexAt } from '../three/biomes'
import { loopGap } from '../three/track'
import { MOCK_RUNNERS, ITEM_TYPES, generateCourse } from '../lib/mockData'
import { cadenceFor, speedMps, totalRunSec } from '../lib/pace'
import { STAMINA, drainPerKm, tiredFor } from '../lib/stamina'
import { activateBooster, advanceSimulation } from '../lib/simulation'
import { api } from '../lib/api'
import { BIOME_ICONS, CHEER_ICONS, CHEER_KEYS, ITEM_ICONS } from '../lib/icons'
import Hud from '../components/Hud'
import Loading from '../components/Loading'
import { judgeRhythm } from '../lib/rhythm'
import useRaceRoom from '../lib/useRaceRoom'
import { getSettings } from '../lib/settings'


// 시뮬레이션 진행: 거리·체력·탈진/회복 (배속 적용)
function SimDriver({ sim, rhythm }) {
  useFrame((_, dt) => {
    if (!sim.current.paused && !sim.current.finished && !sim.current.resting) rhythm.current.elapsed += Math.min(dt, .1)
    advanceSimulation(sim.current, dt)
  })
  return null
}

const Scene = memo(function Scene({ sim, rhythm, profile, activity, ghosts, getMyDist, getGhostDist, getMyAction, items, stations, closedStations, biome, cheers, onCollect }) {
  return (
    <>
      <SimDriver sim={sim} rhythm={rhythm} />
      <World biome={biome} />
      <CameraRig getDistance={getMyDist} />
      <Runner
        getDistance={getMyDist}
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

export default forwardRef(function RunScreen({ profile, config, onFinish, confirmAction, onActivityVisibilityChange }, ref) {
  const totalM = config.distanceKm * 1000
  const cadence = cadenceFor(config.paceSec)
  const ghosts = MOCK_RUNNERS
  const course = useMemo(() => generateCourse(totalM), [totalM])
  const stations = course.stations

  const sim = useRef({
    elapsed: 0,
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
    practice: false,
    speedMult: 1,
    resting: false,
    restLeft: 0,
    restSec: 0,
    exhaust: 0,
    paused: true,
    finished: false,
    timeScale: 1,
  })
  const getMyDist = useCallback(() => sim.current.dist, [])
  const getGhostDist = useCallback((g) => g.start + (sim.current.elapsed * 1000) / g.paceSec, [])
  const getMyAction = useCallback(() => ({ kneel: sim.current.resting, tired: tiredFor(sim.current.stamina, sim.current.maxStamina), boosting: sim.current.boostLeft > 0 }), [])

  const [ready, setReady] = useState(false)
  const [items, setItems] = useState(course.items)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const [closedStations, setClosedStations] = useState([])
  const closedRef = useRef(new Set())
  const [biomeIdx, setBiomeIdx] = useState(0)
  const biomeRef = useRef(0)
  const [cheers, setCheers] = useState({})
  const [toasts, setToasts] = useState([])
  const [judge, setJudge] = useState(null)
  const [paused, setPaused] = useState(false)
  const [showActivity, setShowActivity] = useState(config.showActivity !== false)
  const room = useRaceRoom({ userId: profile.userId, nickname: profile.nickname, paused: paused || !ready })
  const toggleActivity = () => { const next = !showActivity; setShowActivity(next); onActivityVisibilityChange?.(next) }
  const [timeScale, setTimeScale] = useState(1)
  const stats = useRef({ score: 0, collected: 0, supplies: 0, missedSupplies: 0, medals: 0, combo: 0, maxCombo: 0, cheersSent: 0, cheersGot: 0, perfect: 0, good: 0 })
  const [statsView, setStatsView] = useState({ ...stats.current })
  const rhythm = useRef({ elapsed: 0, period: (4 * 60) / cadence, lastIdx: -1 })
  const finishedRef = useRef(false)
  const exitPending = useRef(false)
  const manualPending = useRef(false)
  const lastCheer = useRef({})
  const flags = useRef({ resting: false, low: false })

  const bump = () => setStatsView({ ...stats.current })

  const toast = useCallback((text, kind = 'info', icon = null) => {
    const id = Math.random()
    setToasts((t) => [...t.slice(-3), { id, text, kind, icon }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }, [])

  useEffect(() => {
    const id = setTimeout(() => {
      setReady(true)
      sim.current.paused = false
      rhythm.current.elapsed = 0
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

  const finish = (completed, destination = 'result') => {
    if (finishedRef.current) return
    finishedRef.current = true
    sim.current.paused = true
    const s = sim.current
    onFinish({
      id: config.id,
      intensity: config.intensity,
      practice: s.practice,
      boostUses: s.boostUses,
      completed,
      nickname: profile.nickname,
      activity: config.activity || 'rest',
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
    }, destination)
  }

  const requestExit = async (destination = 'result') => {
    if (finishedRef.current || sim.current.finished || exitPending.current || !ready) return
    exitPending.current = true
    const wasPaused = sim.current.paused
    sim.current.paused = true
    setPaused(true)
    const exitingToMenu = destination !== 'result'
    try {
      const accepted = await confirmAction({
        title: destination === 'logout' ? '러닝을 종료하고 로그아웃할까요?' : exitingToMenu ? '러닝을 종료하고 이동할까요?' : '러닝을 여기서 종료할까요?',
        description: config.anonymous ? '현재까지 달린 결과를 확인할 수 있지만, 익명 체험 기록과 경험치는 저장되지 않아요.' : sim.current.practice ? '개발 체험 기록으로 저장되며 경험치는 지급되지 않아요.' : '달린 거리까지 기록과 경험치를 저장해요. 남은 코스는 이어서 달릴 수 없어요.',
        confirmLabel: destination === 'logout' ? '종료 후 로그아웃' : exitingToMenu ? '종료하고 이동' : '종료하고 결과 보기',
        cancelLabel: wasPaused ? '돌아가기' : '계속 달리기',
      })
      if (accepted) finish(false, destination)
      else { sim.current.paused = wasPaused; setPaused(wasPaused) }
    } finally { exitPending.current = false }
  }
  const pauseForManual = () => {
    if (!ready || finishedRef.current || sim.current.finished || exitPending.current) return null
    const wasPaused = sim.current.paused
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
    let msg = `${t.label} +${pts}pt`
    if (t.restore) {
      const before = s.stamina
      s.stamina = Math.min(s.maxStamina, s.stamina + t.restore)
      stats.current.supplies++
      msg = `${t.label} · 체력 +${Math.round(s.stamina - before)}`
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
    if (sim.current.paused || sim.current.resting) return
    const r = rhythm.current
    const judgment = judgeRhythm(r, stats.current)
    if (!judgment) return
    setJudge({ ...judgment, at: Date.now() })
    bump()
  }

  const togglePause = () => {
    if (finishedRef.current || !ready) return
    sim.current.paused = !sim.current.paused
    setPaused(sim.current.paused)
  }

  const changeScale = (v) => {
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
    if (activateBooster(sim.current)) toast(`부스터! ${config.boosterDuration}초 동안 속도 +${Math.round((getSettings().boostMultiplier - 1) * 100)}%`, 'good', LuZap)
  }

  const handlers = useRef({})
  handlers.current = { hitBeat, cheer, collectNearest, togglePause, boost }
  useEffect(() => {
    const onKey = (e) => {
      if (exitPending.current || manualPending.current || e.repeat || e.target.closest('input, textarea, select, [contenteditable="true"], .runner-chat')) return
      const h = handlers.current
      if (e.code === 'Space') { e.preventDefault(); h.hitBeat() }
      else if (import.meta.env.DEV && e.code === 'KeyC') h.cheer()
      else if (e.code === 'KeyE') h.collectNearest()
      else if (e.code === 'KeyB') h.boost()
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

    const bi = biomeIndexAt(my)
    if (bi !== biomeRef.current) {
      biomeRef.current = bi
      setBiomeIdx(bi)
      toast(`${Math.floor(my / 1000)}km 통과! ${BIOMES[bi].name} 구간`, 'km', BIOME_ICONS[BIOMES[bi].key])
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
      toast(next ? `체력이 바닥나고 있어요. 보급소 ${next.n}까지 ${Math.max(0, Math.round(next.dist - my))}m` : '체력이 바닥나고 있어요', 'warn', LuBatteryWarning)
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

    if (s.finished) finish(true)
  }
  useEffect(() => {
    const id = setInterval(() => loopRef.current(), 250)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="run-screen">
      <Canvas camera={{ fov: 55, near: 0.1, far: 700, position: [0, 5, -10] }} dpr={[1, 1.75]}>
        <Scene
          sim={sim}
          rhythm={rhythm}
          profile={profile}
          activity={showActivity ? config.activity || 'rest' : undefined}
          ghosts={ghosts}
          getMyDist={getMyDist}
          getGhostDist={getGhostDist}
          getMyAction={getMyAction}
          items={items}
          stations={stations}
          closedStations={closedStations}
          biome={BIOMES[biomeIdx]}
          cheers={cheers}
          onCollect={onCollect}
        />
      </Canvas>

      {ready ? (
        <Hud
          sim={sim}
          room={room}
          showActivity={showActivity}
          onToggleActivity={toggleActivity}
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
        />
      ) : (
        <div className="run-loading">
          <Loading text="코스와 보급소를 준비하고 있어요." sub={import.meta.env.DEV ? `테스트 AI 러너 ${ghosts.length}명이 같은 코스에서 기다리고 있어요.` : undefined} />
        </div>
      )}
    </div>
  )
})
