import { useEffect, useState } from 'react'
import {
  LuMusic, LuMegaphone, LuHand, LuPause, LuPlay, LuLogOut, LuMap,
  LuHeartPulse, LuDroplet, LuBatteryLow, LuGauge,
} from 'react-icons/lu'
import { fmtTime, fmtPace } from '../lib/pace'
import { STAMINA, staminaState } from '../lib/stamina'
import { ITEM_TYPES } from '../lib/mockData'
import { BIOME_ICONS, ITEM_ICONS } from '../lib/icons'
import Minimap from './Minimap'
import RhythmBar from './RhythmBar'

const SPEEDS = [1, 10, 30, 60]

export default function Hud({
  sim, getMyDist, getGhostDist, ghosts, nearestGhost, profile, config, totalM, biome,
  stats, items, stations, closedStations, rhythm, judge, cadence, toasts, paused, timeScale,
  onTimeScale, onPause, onQuit, onBeat, onCheer, onCollect, onCollectNearest,
}) {
  const [t, setT] = useState(() => snapshot())
  const [showMap, setShowMap] = useState(true)

  function snapshot() {
    const s = sim.current
    return {
      elapsed: s.elapsed,
      dist: s.dist,
      stamina: s.stamina,
      mult: s.speedMult,
      resting: s.resting,
      restLeft: s.restLeft,
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
  const slowPct = Math.round((1 - (t.mult || 0)) * 100)

  const st = staminaState(t.stamina, t.resting)
  const stPct = Math.max(0, Math.min(100, t.stamina))

  // 보급소
  const activeStation = stations.find(
    (x) => !closedStations.includes(x.id) && t.dist >= x.dist - STAMINA.stationGrabBeforeM && t.dist <= x.dist + STAMINA.stationGrabAfterM
  )
  const nextStation = stations.find((x) => x.dist + STAMINA.stationGrabAfterM > t.dist && !closedStations.includes(x.id))
  const activeItems = activeStation ? items.filter((i) => i.stationId === activeStation.id && i.status === 'pending') : []
  const medalNear = items.some((i) => !i.stationId && i.status === 'pending' && i.dist - t.dist < 60 && i.dist - t.dist > -4)

  const ranking = [
    { id: 'me', nickname: profile.nickname, color: profile.color, dist: t.dist, me: true },
    ...ghosts.map((g) => ({ id: g.id, nickname: g.nickname, color: g.color, dist: Math.max(0, getGhostDist(g)) })),
  ].sort((a, b) => b.dist - a.dist)

  return (
    <div className="hud">
      {(stPct < 25 || t.resting) && <div className={`vignette ${t.resting ? 'strong' : ''}`} />}

      {/* 좌상단 */}
      <div className="hud-tl">
        <div className="pill">
          <button className="icon-btn" title="종료" onClick={onQuit}><LuLogOut /></button>
          <button className={`icon-btn ${showMap ? 'on' : ''}`} title="미니맵" onClick={() => setShowMap((v) => !v)}><LuMap /></button>
          <span className="pill-title">런대시</span>
          <span className="pill-sub">코스 01 · {ghosts.length + 1}명</span>
        </div>
        <div className="pill info-pill"><BiomeIcon /> {Math.floor(km) + 1}km 구간 · {biome.name}</div>
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
              <b>{Math.round(stPct)}</b>
            </div>
            <div className="stamina-bar">
              <div className="stamina-fill" style={{ width: `${stPct}%` }} />
              <span className="stamina-mark" style={{ left: '60%' }} />
              <span className="stamina-mark" style={{ left: '25%' }} />
            </div>
          </div>
        </div>

        <div className="hint">보급품·메달 클릭 · E 챙기기 · Space 박자 · C 응원 · P 일시정지</div>

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
            <span><LuGauge /> 현재 {curPace ? fmtPace(curPace) : '휴식'} <em>/ 목표 {fmtPace(config.paceSec)}</em></span>
            <span>목표 기록 {fmtTime(s.targetSec)}</span>
          </div>
        </div>
      </div>

      {/* 우상단 */}
      <div className="hud-tr">
        <div className="pill">
          <span className="pill-sub">목업 배속</span>
          {SPEEDS.map((v) => (
            <button key={v} className={`seg ${timeScale === v ? 'on' : ''}`} onClick={() => onTimeScale(v)}>{v}x</button>
          ))}
          <button className="icon-btn" onClick={onPause} title="일시정지 (P)">{paused ? <LuPlay /> : <LuPause />}</button>
        </div>
        {showMap && (
          <div className="panel">
            <Minimap
              me={{ dist: t.dist, color: profile.color }}
              others={ghosts.map((g) => ({ id: g.id, dist: getGhostDist(g), color: g.color, lane: g.lane }))}
              stations={stations.map((x) => ({ ...x, closed: closedStations.includes(x.id) }))}
            />
            <ol className="ranking">
              {ranking.map((r, i) => (
                <li key={r.id} className={r.me ? 'me' : ''}>
                  <span className="rank">{i + 1}</span>
                  <span className="dot" style={{ background: r.color }} />
                  <span className="rk-name">{r.nickname}</span>
                  <span className="rk-dist">{(r.dist / 1000).toFixed(2)}km</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* 좌하단: 점수 */}
      <div className="hud-bl">
        <div className="score-card">
          <div className="score">{stats.score.toLocaleString()}<small>pt</small></div>
          <div className="score-row">
            <span>콤보 <b>{stats.combo}</b></span>
            <span>최대 <b>{stats.maxCombo}</b></span>
          </div>
          <div className="score-row">
            <span>보급 <b>{stats.supplies}</b></span>
            <span>메달 <b>{stats.medals}</b></span>
            <span>응원 <b>{stats.cheersSent}</b></span>
          </div>
        </div>
      </div>

      {/* 하단 */}
      <div className="hud-bc">
        {activeStation && (
          <div className="supply-panel">
            <div className="supply-title"><LuDroplet /> 보급소 {activeStation.n} — 지나치면 끝!</div>
            <div className="supply-items">
              {activeItems.length ? (
                activeItems.map((i) => {
                  const I = ITEM_ICONS[i.type]
                  return (
                    <button key={i.id} className={`supply-btn ${i.type}`} onClick={() => onCollect(i)} disabled={t.resting}>
                      <I />
                      <span>{ITEM_TYPES[i.type].label}</span>
                      <small>체력 +{ITEM_TYPES[i.type].restore}</small>
                    </button>
                  )
                })
              ) : (
                <span className="supply-empty">다 챙겼어요</span>
              )}
            </div>
          </div>
        )}
        <RhythmBar rhythm={rhythm} judge={judge} onBeat={onBeat} cadence={cadence} />
        <div className="dock">
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
          <div className="rest-bar"><div style={{ width: `${(1 - Math.max(0, t.restLeft) / STAMINA.recoverySec) * 100}%` }} /></div>
          <div className="rest-sub">회복이 끝나면 체력 {STAMINA.recoverTo}로 다시 달려요</div>
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
