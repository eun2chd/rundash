import { useEffect, useState } from 'react'
import {
  LuMusic, LuMegaphone, LuHand, LuPause, LuPlay, LuLogOut,
  LuHeartPulse, LuDroplet, LuBatteryLow, LuGauge, LuZap, LuCloud, LuLayoutDashboard, LuBot, LuLock,
} from 'react-icons/lu'
import { fmtTime, fmtPace } from '../lib/pace'
import { STAMINA, staminaState } from '../lib/stamina'
import { BIOME_ICONS } from '../lib/icons'
import Minimap from './Minimap'
import RhythmBar from './RhythmBar'
import { experienceFor, xpRangeText } from '../lib/progression'
import { getSettings } from '../lib/settings'
import ScoreSummary from './ScoreSummary'
import SupplyPanel from './SupplyPanel'
import RunnerChat from './RunnerChat'
import DeveloperDebug from './DeveloperDebug'
import RunningMusic from './RunningMusic'
import FriendPanel from './FriendPanel'
import RoomPresence from './RoomPresence'
import ConfirmDialog from './ConfirmDialog'
import GroupRoster from './GroupRoster'
import WeatherDashboard from './WeatherDashboard'
import { weatherAt } from '../lib/weather'
import { ACTIVITY_GROUPS } from '../lib/activities'
import HudPanelManager, { HUD_PANELS } from './HudPanelManager'
import { num } from '../lib/format'

function savedPanels() {
  try { return JSON.parse(localStorage.getItem('rundash:hud-panels') || '{}') || {} } catch { return {} }
}

export default function Hud({
  sim, getMyDist, getGhostDist, ghosts, nearestGhost, profile, config, totalM, biome,
  stats, items, stations, closedStations, rhythm, judge, cadence, toasts, paused, timeScale,
  onTimeScale, onPause, onQuit, onBeat, onCheer, onCollect, onCollectNearest, onBoost, auto = false, autoAvailable = false, onToggleAuto,
  room, showActivity, onToggleActivity, activity, onActivityChange, realPeers = [], myVisualPose, social, confirmAction, checkpointError, locating, onLocateFriend, onReturnToRunner, showPauseDialog = true, friendPanelRequest, canPause = true, onAcceptInvite,
}) {
  const [t, setT] = useState(() => snapshot())
  const [panels, setPanels] = useState(savedPanels)
  const [showMap, setShowMap] = useState(() => savedPanels().map ?? false)
  const [showChat, setShowChat] = useState(() => savedPanels().chat ?? window.innerWidth > 760)
  const [managePanels, setManagePanels] = useState(false)
  const visible = id => id === 'cloud' ? showActivity : id === 'map' ? showMap : id === 'chat' ? showChat : panels[id] !== false
  const togglePanel = id => {
    if (id === 'cloud') onToggleActivity()
    else if (id === 'map') setShowMap(value => !value)
    else if (id === 'chat') setShowChat(value => !value)
    else setPanels(previous => ({ ...previous, [id]: previous[id] === false }))
  }
  const setAllPanels = value => {
    setPanels(Object.fromEntries(HUD_PANELS.map(([id]) => [id, value])))
    setShowMap(value); setShowChat(value)
    if (showActivity !== value) onToggleActivity()
  }
  useEffect(() => {
    try { localStorage.setItem('rundash:hud-panels', JSON.stringify({ ...panels, map: showMap, chat: showChat })) } catch { /* Keep controls usable when storage is unavailable. */ }
  }, [panels, showMap, showChat])

  function snapshot() {
    const s = sim.current
    return {
      elapsed: s.elapsed,
      weather: weatherAt(s.weatherTimeMs),
      weatherTimeMs: s.weatherTimeMs,
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
  const curPace = t.resting || paused || t.mult <= 0 ? null : 1000 / (s.speed * t.mult)
  const slowPct = Math.max(0, Math.round((1 - (t.mult || 0)) * 100))

  const st = staminaState(t.stamina, t.resting, s.maxStamina)
  const stPct = Math.max(0, Math.min(100, t.stamina / s.maxStamina * 100))
  const xpEstimate = xpRangeText(experienceFor({ distanceKm: km, completed: false, practice: t.practice, anonymous: config.anonymous }))
  const boostDisabled = !config.boosterUnlocked || paused || t.resting || t.boostCooldownLeft > 0 || t.stamina <= config.boosterCost

  // 보급소
  const activeStation = stations.find(
    (x) => !closedStations.includes(x.id) && t.dist >= x.dist - STAMINA.stationGrabBeforeM && t.dist <= x.dist + STAMINA.stationGrabAfterM
  )
  const nextStation = stations.find((x) => x.dist + STAMINA.stationGrabAfterM > t.dist && !closedStations.includes(x.id))
  const activeItems = activeStation ? items.filter((i) => i.stationId === activeStation.id && i.status === 'pending') : []
  const medalNear = items.some((i) => !i.stationId && i.status === 'pending' && i.dist - t.dist < 60 && i.dist - t.dist > -4)

  return (
    <div className={`hud ${HUD_PANELS.map(([id]) => !visible(id) ? `hud-hide-${id}` : panels[id] === true ? `hud-show-${id}` : '').join(' ')}`}>
      {(stPct < 25 || t.resting) && <div className={`vignette ${t.resting ? 'strong' : ''}`} />}

      {/* 좌상단 */}
      <div className="hud-tl">
        <div className="pill">
          <button type="button" className="hud-manager-toggle" onClick={onQuit}><LuLogOut aria-hidden="true" /> 러닝 종료</button>
          <button type="button" className={`hud-manager-toggle ${managePanels ? 'on' : ''}`} title="화면 관리" aria-haspopup="dialog" aria-expanded={managePanels} onClick={() => setManagePanels(true)}><LuLayoutDashboard /><span>화면 관리</span></button>
          <FriendPanel onAcceptInvite={onAcceptInvite} openRequest={friendPanelRequest} social={social} onLocate={id => { setShowMap(true); onLocateFriend(id) }} confirmAction={confirmAction} />
          <span className="pill-sub">코스 01</span>
        </div>
        <GroupRoster group={social.pair} userId={room.userId} />
        <label className="running-activity-picker"><LuCloud aria-hidden="true" /><span className="sr-only">구름 활동 상태 변경</span><select value={activity} onChange={event => onActivityChange(event.target.value)}>{ACTIVITY_GROUPS.map(group => <optgroup key={group.id} label={group.label}>{group.items.map(([id, label, status]) => <option key={id} value={id}>{label} · {status}</option>)}</optgroup>)}</select></label>
        {locating && <button className="chat-toggle" onClick={onReturnToRunner}>내 러너로 돌아가기</button>}
        {checkpointError && <p className="checkpoint-notice" role="status">{checkpointError}</p>}
        <div className="pill info-pill"><BiomeIcon /> {Math.floor(km) + 1}km 구간 · {biome.name}</div>
        <div className="pill info-pill">{!config.anonymous && `Lv.${config.level} · `}{config.intensityLabel} · {config.anonymous ? '익명 체험' : t.practice ? '개발 체험 · XP 없음' : `예상 +${xpEstimate} XP`}</div>
        {nextStation ? (
          <div className={`pill info-pill ${activeStation ? 'station-on' : ''}`}>
            <LuDroplet />
            {activeStation
              ? `보급소 ${activeStation.n} 도착. 지금 챙기세요`
              : `다음 보급소 ${nextStation.n} · ${num(Math.round(nextStation.dist - t.dist))}m`}
          </div>
        ) : (
          <div className="pill info-pill dim"><LuDroplet /> 남은 보급소 없음</div>
        )}
        {showMap && <div className="panel hud-left-map" aria-label="러닝 미니맵"><Minimap me={{ dist: myVisualPose?.distance ?? t.dist, lane: myVisualPose?.lane || 0, color: profile.color }} others={[...realPeers, ...ghosts.map(g => ({ id: g.id, nickname: g.nickname, dist: getGhostDist(g), color: g.color, lane: g.lane }))]} stations={stations.map(x => ({ ...x, closed: closedStations.includes(x.id) }))} /></div>}
        <ScoreSummary stats={stats} />
        {activeStation && <SupplyPanel station={activeStation} items={activeItems} distance={t.dist} resting={t.resting} maxStamina={s.maxStamina} onCollect={onCollect} />}
        {showChat && <RunnerChat room={room} onHide={() => setShowChat(false)} />}
      </div>

      {managePanels && <HudPanelManager visible={visible} onToggle={togglePanel} onAll={setAllPanels} onClose={() => setManagePanels(false)} />}

      {/* 상단 중앙: 체력바 + 기록 */}
      <div className="hud-tc">
        <div className="live-pace" role="group" aria-label="현재 페이스">
          <LuGauge aria-hidden="true" /><span>현재 페이스</span><strong>{curPace ? fmtPace(curPace) : paused ? '일시정지' : '회복 중'}</strong>{curPace && <small>/km</small>}
        </div>
        <div className={`stamina tone-${st.tone}`}>
          <LuHeartPulse className="stamina-icon" />
          <div className="stamina-body">
            <div className="stamina-head">
              <span>체력</span>
              <span className="stamina-state">
                {st.label}
                {!t.resting && slowPct > 0 ? ` · 속도 -${slowPct}%` : ''}
              </span>
              <b>{num(Math.round(t.stamina))} / {num(s.maxStamina)}</b>
            </div>
            <div className="stamina-bar">
              <div className="stamina-fill" style={{ width: `${stPct}%` }} />
              <span className="stamina-mark" style={{ left: '60%' }} />
              <span className="stamina-mark" style={{ left: '25%' }} />
            </div>
          </div>
        </div>

        <div className="hint">E 챙기기 · Space 박자{import.meta.env.DEV && ' · C 응원'} · B 부스터 · P 일시정지</div>

        <div className="stat-card">
          <div className="stat-main">
            <div>
              <div className="stat-label">경과</div>
              <div className="stat-big">{fmtTime(t.elapsed)}</div>
            </div>
            <div className="stat-div" />
            <div>
              <div className="stat-label">거리</div>
              <div className="stat-big">{num(km, 2)}<small> / {num(config.distanceKm)} km</small></div>
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

      {/* 우상단: 음악, 날씨, 접속 인원 */}
      <div className="hud-tr">
        <RunningMusic />
        <WeatherDashboard weather={t.weather} timestamp={t.weatherTimeMs} />
        <RoomPresence room={room} />
      </div>

      {import.meta.env.DEV && <DeveloperDebug timeScale={timeScale} onTimeScale={onTimeScale} practice={t.practice} level={config.level} stamina={t.stamina} maxStamina={num(s.maxStamina)} />}

      {/* 하단 */}
      <div className="hud-bc">
        <RhythmBar rhythm={rhythm} judge={judge} onBeat={onBeat} cadence={cadence} disabled={paused || t.resting} />
        <div className="dock">
          {!config.anonymous && <button className={`dock-btn booster-btn ${t.boostLeft > 0 ? 'boosting' : ''}`} disabled={boostDisabled} onClick={onBoost} title={config.boosterUnlocked ? `속도 +${Math.round((getSettings().boostMultiplier - 1) * 100)}% · 체력 ${config.boosterCost} 소모 · 종료 후 ${config.boosterCooldown}초 재충전` : '레벨을 올려 부스터를 해금해요'}><LuZap /><span>{!config.boosterUnlocked ? '부스터 잠김' : t.boostLeft > 0 ? `가속 ${Math.ceil(t.boostLeft)}초` : t.boostCooldownLeft > 0 ? `충전 ${Math.ceil(t.boostCooldownLeft)}초` : t.stamina <= config.boosterCost ? '체력 부족' : '부스터'}</span><kbd>B</kbd></button>}
          {!config.anonymous && <button className={`dock-btn auto-btn${auto ? ' on' : ''}${autoAvailable ? '' : ' locked'}`} aria-pressed={auto} onClick={onToggleAuto} title={autoAvailable ? '보급소·메달·리듬 러닝을 자동으로 수행해요' : `Lv.${getSettings().autoLevel}에 해금돼요`}>{autoAvailable ? <LuBot /> : <LuLock />}<span>{autoAvailable ? (auto ? 'AUTO 켜짐' : 'AUTO') : `AUTO Lv.${getSettings().autoLevel}`}</span><kbd>A</kbd></button>}
          <button className="dock-btn" onClick={onBeat}><LuMusic /><span>박자</span><kbd>Space</kbd></button>
          {import.meta.env.DEV && <button className={`dock-btn ${t.near ? 'glow' : ''}`} onClick={onCheer}>
            <LuMegaphone /><span>{t.near ? `${t.near.g.nickname} 응원` : '응원'}</span><kbd>C</kbd>
          </button>}
          <button className={`dock-btn ${activeItems.length || medalNear ? 'glow' : ''}`} onClick={onCollectNearest}>
            <LuHand /><span>{activeItems.length ? '보급 챙기기' : '줍기'}</span><kbd>E</kbd>
          </button>
          <button className="dock-btn" disabled={!canPause} title={!canPause ? '방장만 일시정지할 수 있어요' : undefined} onClick={onPause}>{paused ? <LuPlay /> : <LuPause />}<span>{!canPause ? '방장만 정지' : paused ? '계속' : '일시정지'}</span><kbd>P</kbd></button>
        </div>
      </div>

      <div className="toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((x) => (
          <div key={x.id} className={`toast ${x.kind}`}>{x.icon && <x.icon />}{x.text}{x.action && <button type="button" className="toast-action" onClick={x.action.onClick}>{x.action.label}</button>}</div>
        ))}
      </div>

      {t.resting && !paused && (
        <div className="rest-card">
          <LuBatteryLow className="rest-icon" />
          <div className="rest-title">탈진. 무릎 꿇고 숨 고르는 중</div>
          <div className="rest-time">{fmtTime(Math.max(0, t.restLeft))}</div>
          <div className="rest-bar"><div style={{ width: `${(1 - Math.max(0, t.restLeft) / s.recoverySec) * 100}%` }} /></div>
          <div className="rest-sub">회복이 끝나면 체력 {Math.round(s.recoverTo)}로 다시 달려요</div>
        </div>
      )}

      {paused && showPauseDialog && <ConfirmDialog title={canPause ? '일시정지' : '방장이 일시정지했어요'} description={canPause ? '캐릭터가 제자리에서 기다리고 있어요.' : '방장이 다시 시작하면 함께 달려요.'} cancelLabel="여기서 종료" confirmLabel={canPause ? '계속 달리기' : '방장의 재개를 기다리는 중'} confirmDisabled={!canPause} eyebrow="잠시 쉬어가기" focusConfirm={canPause} resumeShortcut={canPause} onDismiss={canPause ? onPause : () => {}} onAnswer={resume => resume ? onPause() : onQuit()} />}
    </div>
  )
}
