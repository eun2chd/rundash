import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { LuFlag, LuBatteryWarning, LuBatteryLow, LuFootprints, LuDroplet } from 'react-icons/lu'
import World from '../three/World'
import Runner from '../three/Runner'
import CameraRig from '../three/CameraRig'
import Collectible from '../three/Collectible'
import AidStation from '../three/AidStation'
import { BIOMES, biomeIndexAt } from '../three/biomes'
import { loopGap } from '../three/track'
import { MOCK_RUNNERS, ITEM_TYPES, generateCourse } from '../lib/mockData'
import { cadenceFor, speedMps, totalRunSec } from '../lib/pace'
import { STAMINA, drainPerKm, speedMultFor, tiredFor } from '../lib/stamina'
import { BIOME_ICONS, CHEER_ICONS, CHEER_KEYS, ITEM_ICONS } from '../lib/icons'
import Hud from '../components/Hud'
import Loading from '../components/Loading'

const NEAR_M = 18

// 시뮬레이션 진행: 거리·체력·탈진/회복 (배속 적용)
function SimDriver({ sim }) {
  useFrame((_, dt) => {
    const s = sim.current
    if (s.paused || s.finished) return
    const step = Math.min(dt, 0.1) * s.timeScale
    s.elapsed += step

    if (s.resting) {
      s.restLeft -= step
      s.restSec += step
      s.speedMult = 0
      s.stamina = STAMINA.recoverTo * (1 - Math.max(0, s.restLeft) / STAMINA.recoverySec)
      if (s.restLeft <= 0) {
        s.resting = false
        s.stamina = STAMINA.recoverTo
      }
      return
    }

    s.speedMult = speedMultFor(s.stamina)
    const dd = s.speed * s.speedMult * step
    s.dist = Math.min(s.totalM, s.dist + dd)
    s.stamina = Math.max(0, s.stamina - (dd / 1000) * s.drain)

    if (s.dist >= s.totalM) {
      s.finished = true
    } else if (s.stamina <= 0) {
      s.resting = true
      s.restLeft = STAMINA.recoverySec
      s.exhaust++
    }
  })
  return null
}

const Scene = memo(function Scene({ sim, profile, ghosts, getMyDist, getGhostDist, getMyAction, items, stations, closedStations, biome, cheers, onCollect }) {
  return (
    <>
      <SimDriver sim={sim} />
      <World biome={biome} />
      <CameraRig getDistance={getMyDist} />
      <Runner
        getDistance={getMyDist}
        getAction={getMyAction}
        color={profile.color}
        skin={profile.skin}
        hair={profile.hair}
        nickname={profile.nickname}
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

export default function RunScreen({ profile, config, onFinish }) {
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
    drain: drainPerKm(config.paceSec),
    stamina: STAMINA.max,
    speedMult: 1,
    resting: false,
    restLeft: 0,
    restSec: 0,
    exhaust: 0,
    paused: true,
    finished: false,
    timeScale: 10,
  })
  const getMyDist = useCallback(() => sim.current.dist, [])
  const getGhostDist = useCallback((g) => g.start + (sim.current.elapsed * 1000) / g.paceSec, [])
  const getMyAction = useCallback(() => ({ kneel: sim.current.resting, tired: tiredFor(sim.current.stamina) }), [])

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
  const [timeScale, setTimeScale] = useState(10)
  const stats = useRef({ score: 0, collected: 0, supplies: 0, missedSupplies: 0, medals: 0, combo: 0, maxCombo: 0, cheersSent: 0, cheersGot: 0, perfect: 0, good: 0 })
  const [statsView, setStatsView] = useState({ ...stats.current })
  const rhythm = useRef({ start: performance.now(), period: (4 * 60) / cadence, lastIdx: -1 })
  const finishedRef = useRef(false)
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
      rhythm.current.start = performance.now()
      toast(`출발! ${BIOMES[0].name} 구간`, 'km', LuFlag)
    }, 1400)
    return () => clearTimeout(id)
  }, [toast])

  const nearestGhost = useCallback(() => {
    const my = getMyDist()
    let best = null
    for (const g of ghosts) {
      const gap = loopGap(getGhostDist(g), my)
      if (Math.abs(gap) < NEAR_M && (!best || Math.abs(gap) < Math.abs(best.gap))) best = { g, gap }
    }
    return best
  }, [getMyDist, getGhostDist, ghosts])

  const finish = (completed) => {
    if (finishedRef.current) return
    finishedRef.current = true
    sim.current.paused = true
    const s = sim.current
    onFinish({
      completed,
      nickname: profile.nickname,
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
    })
  }

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
      return toast(cur.stationId ? '보급소에 도착하면 챙길 수 있어요' : '아직 멀어요 — 가까워지면 눌러주세요', 'warn')
    }
    const t = ITEM_TYPES[cur.type]
    const mult = 1 + Math.min(stats.current.combo, 10) * 0.1
    const pts = Math.round(t.points * mult)
    stats.current.score += pts
    stats.current.collected++
    let msg = `${t.label} +${pts}pt`
    if (t.restore) {
      const before = s.stamina
      s.stamina = Math.min(STAMINA.max, s.stamina + t.restore)
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
    if (!n) return toast(`근처(${NEAR_M}m)에 러너가 없어요`, 'warn')
    const now = Date.now()
    if (now - (lastCheer.current[n.g.id] || 0) < 2000) return
    lastCheer.current[n.g.id] = now
    const key = CHEER_KEYS[Math.floor(Math.random() * CHEER_KEYS.length)]
    setCheers((c) => ({ ...c, [n.g.id]: { icon: key, at: now } }))
    stats.current.cheersSent++
    stats.current.score += 15
    toast(`${n.g.nickname}님에게 응원 +15`, 'good', CHEER_ICONS[key])
    bump()
  }

  const hitBeat = () => {
    if (sim.current.paused || sim.current.resting) return
    const r = rhythm.current
    const sec = (performance.now() - r.start) / 1000
    const idx = Math.round(sec / r.period)
    if (idx === r.lastIdx) return
    r.lastIdx = idx
    const p = (sec % r.period) / r.period
    const off = Math.min(p, 1 - p) * r.period
    const s = stats.current
    let res
    if (off < 0.09) { res = 'PERFECT'; s.perfect++; s.combo++; s.score += 5 }
    else if (off < 0.2) { res = 'GOOD'; s.good++; s.combo++; s.score += 2 }
    else { res = 'MISS'; s.combo = 0 }
    s.maxCombo = Math.max(s.maxCombo, s.combo)
    setJudge({ res, at: Date.now(), combo: s.combo })
    bump()
  }

  const togglePause = () => {
    if (finishedRef.current || !ready) return
    sim.current.paused = !sim.current.paused
    setPaused(sim.current.paused)
  }

  const changeScale = (v) => {
    sim.current.timeScale = v
    setTimeScale(v)
  }

  const handlers = useRef({})
  handlers.current = { hitBeat, cheer, collectNearest, togglePause }
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || e.target.tagName === 'INPUT') return
      const h = handlers.current
      if (e.code === 'Space') { e.preventDefault(); h.hitBeat() }
      else if (e.code === 'KeyC') h.cheer()
      else if (e.code === 'KeyE') h.collectNearest()
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
          toast(`보급소 ${st.n} 지나침 — 못 챙긴 보급품 ${left.length}개는 사라졌어요`, 'warn', LuDroplet)
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
      toast(`탈진! 무릎 꿇고 ${STAMINA.recoverySec}초 회복해야 해요`, 'bad', LuBatteryLow)
    } else if (!s.resting && flags.current.resting) {
      flags.current.resting = false
      flags.current.low = false
      toast('회복 완료 — 다시 출발!', 'km', LuFootprints)
    }
    if (!s.resting && s.stamina < 25 && !flags.current.low) {
      flags.current.low = true
      const next = stations.find((st) => st.dist + STAMINA.stationGrabAfterM > my)
      toast(next ? `체력이 바닥나고 있어요 — 보급소 ${next.n}까지 ${Math.max(0, Math.round(next.dist - my))}m` : '체력이 바닥나고 있어요', 'warn', LuBatteryWarning)
    }
    if (s.stamina >= 35) flags.current.low = false

    if (!s.paused && !s.resting && Math.random() < 0.015) {
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
          profile={profile}
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
          onPause={togglePause}
          onQuit={() => finish(false)}
          onBeat={hitBeat}
          onCheer={cheer}
          onCollect={onCollect}
          onCollectNearest={collectNearest}
        />
      ) : (
        <div className="run-loading">
          <Loading text="코스와 보급소를 준비하고 있어요." sub={`${ghosts.length}명이 같은 코스에서 기다리고 있어요.`} />
        </div>
      )}
    </div>
  )
}
