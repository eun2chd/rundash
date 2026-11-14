import { useEffect, useState } from 'react'
import {
  LuMusic, LuMegaphone, LuHand, LuPause, LuPlay, LuLogOut, LuMap,
  LuHeartPulse, LuDroplet, LuBatteryLow, LuGauge, LuZap, LuCloud, LuCloudOff, LuMessageCircle, LuUsers,
} from 'react-icons/lu'
import { fmtTime, fmtPace } from '../lib/pace'
import { STAMINA, staminaState } from '../lib/stamina'
import { BIOME_ICONS } from '../lib/icons'
import Minimap from './Minimap'
import RhythmBar from './RhythmBar'
import { experienceFor } from '../lib/progression'
import ScoreSummary from './ScoreSummary'
import SupplyPanel from './SupplyPanel'
import RunnerChat from './RunnerChat'

const SPEEDS = [1, 10, 30, 60]

export default function Hud({
  sim, getMyDist, getGhostDist, ghosts, nearestGhost, profile, config, totalM, biome,
  stats, items, stations, closedStations, rhythm, judge, cadence, toasts, paused, timeScale,
  onTimeScale, onPause, onQuit, onBeat, onCheer, onCollect, onCollectNearest, onBoost,
  room, showActivity, onToggleActivity,
}) {
  const [t, setT] = useState(() => snapshot())
  const [showMap, setShowMap] = useState(false)
  const [showChat, setShowChat] = useState(() => window.innerWidth > 760)

  function snapshot() {
    const s = sim.current
    return {
      elapsed: s.elapsed,
      dist: s.dist,
      stamina: s.stamina,
      mult: s.speedMult,
      resting: s.resting,
      restLeft: s.restLeft,
      boostLeft: s.boostLeft,
      boostCooldownLeft: s.boostCooldownLeft,
      practice: s.practice,
      near: nearestGhost ? nearestGhost() : null,
    }
  }

  useEffect(() => {
    const id = setInterval(() => setT(snapshot()), 100)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const s = sim.current
  const BiomeIcon = BIOME_ICONS[biome.key]
  const km = t.dist / 1000
  const progress = Math.min(1, t.dist / totalM)
  const kmMarks = Array.from({ length: Math.floor(config.distanceKm) }, (_, i) => i + 1).filter((k) => k < config.distanceKm)

  // 예상 남은 시간 = 남은 거리 / 현재 속도 (+ 남은 회복 시간)
  const curSpeed = s.speed * Math.max(t.mult || 0, 0.5)
  const remainSec = (totalM - t.dist) / curSpeed + (t.resting ? Math.max(0, t.restLeft) : 0)
  const curPace = t.resting ? null : config.paceSec / (t.mult || 1)
  const slowPct = Math.max(0, Math.round((1 - (t.mult || 0)) * 100))

  const st = staminaState(t.stamina, t.resting, s.maxStamina)
  const stPct = Math.max(0, Math.min(100, t.stamina / s.maxStamina * 100))
  const xpEstimate = experienceFor({ distanceKm: km, completed: false, practice: t.practice, anonymous: config.anonymous }).total
  const boostDisabled = !config.boosterUnlocked || paused || t.resting || t.boostCooldownLeft > 0 || t.stamina <= config.boosterCost

  // 보급소
  const activeStation = stations.find(
    (x) => !closedStations.includes(x.id) && t.dist >= x.dist - STAMINA.stationGrabBeforeM && t.dist <= x.dist + STAMINA.stationGrabAfterM
  )
  const nextStation = stations.find((x) => x.dist + STAMINA.stationGrabAfterM > t.dist && !closedStations.includes(x.id))
  const activeItems = activeStation ? items.filter((i) => i.stationId === activeStation.id && i.status === 'pending') : []
  const medalNear = items.some((i) => !i.stationId && i.status === 'pending' && i.dist - t.dist < 60 && i.dist - t.dist > -4)

  return (
    <div className="hud">
      {(stPct < 25 || t.resting) && <div className={`vignette ${t.resting ? 'strong' : ''}`} />}

      {/* 좌상단 */}
      <div className="hud-tl">
        <div className="pill">
          <button className="icon-btn" title="종료" onClick={onQuit}><LuLogOut /></button>
          <button className={`icon-btn ${showMap ? 'on' : ''}`} title="미니맵" onClick={() => setShowMap((v) => !v)}><LuMap /></button>
          <button className={`icon-btn ${showActivity ? 'on' : ''}`} title={showActivity ? '구름 말풍선 숨기기' : '구름 말풍선 보이기'} aria-label={showActivity ? '구름 말풍선 숨기기' : '구름 말풍선 보이기'} aria-pressed={showActivity} onClick={onToggleActivity}>{showActivity ? <LuCloud /> : <LuCloudOff />}</button>
          <span className="pill-title">런대시</span>
          <span className="pill-sub">코스 01</span>
        </div>
        <div className="pill info-pill"><BiomeIcon /> {Math.floor(km) + 1}km 구간 · {biome.name}</div>
        <div className="pill info-pill">Lv.{config.level} · {config.intensityLabel} · {config.anonymous ? '익명 체험' : t.practice ? '개발 체험 · XP 없음' : `예상 +${xpEstimate} XP`}</div>
        {nextStation ? (
          <div className={`pill info-pill ${activeStation ? 'station-on' : ''}`}>
            <LuDroplet />
            {activeStation
              ? `보급소 ${activeStation.n} 도착 — 지금 챙기세요`
              : `다음 보급소 ${nextStation.n} · ${Math.round(nextStation.dist - t.dist)}m`}
          </div>
        ) : (
          <div className="pill info-pill dim"><LuDroplet /> 남은 보급소 없음</div>
        )}
        <ScoreSummary stats={stats} />
        {activeStation && <SupplyPanel station={activeStation} items={activeItems} distance={t.dist} resting={t.resting} onCollect={onCollect} />}
      </div>

      {/* 상단 중앙: 체력바 + 기록 */}
      <div className="hud-tc">
        <div className={`stamina tone-${st.tone}`}>
          <LuHeartPulse className="stamina-icon" />
          <div className="stamina-body">
            <div className="stamina-head">
              <span>체력</span>
              <span className="stamina-state">
                {st.label}
                {!t.resting && slowPct > 0 ? ` · 속도 -${slowPct}%` : ''}
              </span>
              <b>{Math.round(t.stamina)} / {s.maxStamina}</b>
            </div>
            <div className="stamina-bar">
              <div className="stamina-fill" style={{ width: `${stPct}%` }} />
              <span className="stamina-mark" style={{ left: '60%' }} />
              <span className="stamina-mark" style={{ left: '25%' }} />
            </div>
          </div>
        </div>

        <div className="hint">E 챙기기 · Space 박자 · C 응원 · B 부스터 · P 일시정지</div>

        <div className="stat-card">
          <div className="stat-main">
            <div>
              <div className="stat-label">경과</div>
              <div className="stat-big">{fmtTime(t.elapsed)}</div>
            </div>
            <div className="stat-div" />
            <div>
              <div className="stat-label">거리</div>
              <div className="stat-big">{km.toFixed(2)}<small> / {config.distanceKm} km</small></div>
            </div>
            <div className="stat-div" />
            <div>
              <div className="stat-label">예상 남은</div>
              <div className="stat-big dim">{fmtTime(remainSec)}</div>
            </div>
          </div>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
            {kmMarks.map((k) => (
              <span key={k} className="progress-tick" style={{ left: `${(k / config.distanceKm) * 100}%` }} />
            ))}
            {stations.map((x) => (
              <span key={x.id} className={`progress-station ${closedStations.includes(x.id) ? 'closed' : ''}`} style={{ left: `${(x.dist / totalM) * 100}%` }} />
            ))}
          </div>
          <div className="stat-foot">
            <span><LuGauge /> 현재 {curPace ? fmtPace(curPace) : '휴식'} <em>/ {config.intensityLabel}</em></span>
            <span>기준 {fmtTime(s.targetSec)}</span>
          </div>
        </div>
      </div>

      {/* 우상단 */}
      <div className="hud-tr">
        <div className="room-presence"><LuUsers /><span>{room.connection === 'connected' ? <>접속 <b>{room.online}</b>명 · 달리는 중 <b>{room.running}</b>명</> : '접속 인원 확인 중…'}</span><span className={`connection-dot ${room.connection === 'connected' ? 'online' : ''}`} /></div>
        <button type="button" className="chat-toggle" aria-expanded={showChat} onClick={() => setShowChat((visible) => !visible)}><LuMessageCircle /> {showChat ? '채팅 숨기기' : '채팅 보이기'}</button>
        <div className="pill">
          {import.meta.env.DEV && <><span className="pill-sub">개발용 배속</span>
          {SPEEDS.map((v) => (
            <button key={v} className={`seg ${timeScale === v ? 'on' : ''}`} onClick={() => onTimeScale(v)}>{v}x</button>
          ))}</>}
          <button className="icon-btn" onClick={onPause} title="일시정지 (P)">{paused ? <LuPlay /> : <LuPause />}</button>
        </div>
        {showChat && <RunnerChat room={room} onHide={() => setShowChat(false)} />}
        {showMap && (
          <div className="panel">
            <Minimap
              me={{ dist: t.dist, color: profile.color }}
              others={ghosts.map((g) => ({ id: g.id, dist: getGhostDist(g), color: g.color, lane: g.lane }))}
              stations={stations.map((x) => ({ ...x, closed: closedStations.includes(x.id) }))}
            />

          </div>
        )}
      </div>

      {/* 하단 */}
      <div className="hud-bc">
        <RhythmBar rhythm={rhythm} judge={judge} onBeat={onBeat} cadence={cadence} disabled={paused || t.resting} />
        <div className="dock">
          <button className={`dock-btn booster-btn ${t.boostLeft > 0 ? 'boosting' : ''}`} disabled={boostDisabled} onClick={onBoost} title={config.boosterUnlocked ? `속도 +50% · 체력 ${config.boosterCost} 소모 · 종료 후 90초 재충전` : '레벨 5에서 해금'}><LuZap /><span>{!config.boosterUnlocked ? 'Lv.5 부스터' : t.boostLeft > 0 ? `가속 ${Math.ceil(t.boostLeft)}초` : t.boostCooldownLeft > 0 ? `충전 ${Math.ceil(t.boostCooldownLeft)}초` : t.stamina <= config.boosterCost ? '체력 부족' : '부스터'}</span><kbd>B</kbd></button>
          <button className="dock-btn" onClick={onBeat}><LuMusic /><span>박자</span><kbd>Space</kbd></button>
          <button className={`dock-btn ${t.near ? 'glow' : ''}`} onClick={onCheer}>
            <LuMegaphone /><span>{t.near ? `${t.near.g.nickname} 응원` : '응원'}</span><kbd>C</kbd>
          </button>
          <button className={`dock-btn ${activeItems.length || medalNear ? 'glow' : ''}`} onClick={onCollectNearest}>
            <LuHand /><span>{activeItems.length ? '보급 챙기기' : '줍기'}</span><kbd>E</kbd>
          </button>
          <button className="dock-btn" onClick={onPause}>{paused ? <LuPlay /> : <LuPause />}<span>{paused ? '계속' : '일시정지'}</span><kbd>P</kbd></button>
        </div>
      </div>

      <div className="toasts">
        {toasts.map((x) => (
          <div key={x.id} className={`toast ${x.kind}`}>{x.icon && <x.icon />}{x.text}</div>
        ))}
      </div>

      {t.resting && !paused && (
        <div className="rest-card">
          <LuBatteryLow className="rest-icon" />
          <div className="rest-title">탈진 — 무릎 꿇고 숨 고르는 중</div>
          <div className="rest-time">{fmtTime(Math.max(0, t.restLeft))}</div>
          <div className="rest-bar"><div style={{ width: `${(1 - Math.max(0, t.restLeft) / s.recoverySec) * 100}%` }} /></div>
          <div className="rest-sub">회복이 끝나면 체력 {Math.round(s.recoverTo)}로 다시 달려요</div>
        </div>
      )}

      {paused && (
        <div className="pause-overlay">
          <div className="pause-card">
            <h2>일시정지</h2>
            <p>캐릭터가 제자리에서 기다리고 있어요.</p>
            <div className="row">
              <button className="btn primary" onClick={onPause}>계속 달리기</button>
              <button className="btn ghost light" onClick={onQuit}>여기서 종료</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
