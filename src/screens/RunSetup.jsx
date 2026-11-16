import { useEffect, useState } from 'react'
import CharacterPreview from '../components/CharacterPreview'
import { getActivity } from '../lib/activities'
import ActivityDialog from '../components/ActivityDialog'
import GrowthCard from '../components/GrowthCard'
import { INTENSITIES, experienceFor, trainingFor, xpRangeText } from '../lib/progression'
import CoursePreview from '../components/CoursePreview'
import { getSettings } from '../lib/settings'
import { LuDroplet, LuLock, LuPlus, LuPlay, LuFootprints, LuClock, LuGauge, LuSparkles, LuMessageCircle, LuChevronRight } from 'react-icons/lu'
import PacePickerDialog from '../components/PacePickerDialog'
import { effortLabel } from '../lib/pacePlans'
import { cadenceFor, fmtPace, fmtTime, speedKmh, totalRunSec, fmtKm } from '../lib/pace'
import { num } from '../lib/format'

const DISTANCES = [1, 3, 5, 10, 21.0975, 42.195]
const DIST_LABEL = { 21.0975: '하프', 42.195: '풀' }

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// Home after login. Left: my runner (character, level, status bubble). Right: one main action
// card (resume or start today's run) on top, the run settings under it, then a compact course
// summary. The status bubble is picked in a dialog; attendance lives on its own screen. The page scrolls as a whole; no inner scroll areas.
export default function RunSetup({ profile, config, xp = 0, anonymous = false, starting = false, onChange, onStart, onOpenAttendance, resumeOffer, onResume }) {
  const [pickingActivity, setPickingActivity] = useState(false)
  const { distanceKm } = config
  const maxDistance = anonymous ? getSettings().anonymousMaxKm : getSettings().maxDistanceKm
  useEffect(() => { if (distanceKm > maxDistance) onChange({ ...config, distanceKm: maxDistance }) }, [distanceKm, maxDistance])
  const [picking, setPicking] = useState(false)
  const training = trainingFor(xp, config.intensity, anonymous, config.customPace)
  const { paceSec } = training
  const setDist = (v) => onChange({ ...config, distanceKm: clamp(Number(v) || 0.5, 0.5, maxDistance) })

  const totalSec = totalRunSec(paceSec, distanceKm)
  const eta = new Date(Date.now() + totalSec * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  const xpText = anonymous ? '저장 안 됨' : `+${xpRangeText(experienceFor({ distanceKm, completed: true }))} XP`
  const intensityLabel = training.intensity === 'custom' ? '내 페이스' : INTENSITIES.find(effort => effort.id === training.intensity)?.label
  const resumeKm = (resumeOffer?.payload?.sim.dist || 0) / 1000
  const resumeTarget = Number(resumeOffer?.session.target_km) || 0
  const resumeProgress = resumeTarget ? Math.min(1, resumeKm / resumeTarget) : 0
  const activity = config.activity || 'rest'
  const bubbleOn = config.showActivity !== false

  return (
    <div className="setup-screen home-screen">
      <div className="home-grid">
        <aside className="card home-runner" aria-label="나의 러너">
          <div className="home-runner-stage">
            <CharacterPreview color={profile.color} skin={profile.skin} hair={profile.hair} outfit={profile.outfit} nickname={profile.nickname} activity={bubbleOn ? activity : undefined} />
          </div>
          <div className="home-runner-body">
            <GrowthCard xp={xp} anonymous={anonymous} />
            {anonymous && <p className="home-anonymous-note">익명 체험 중이에요. 정식 계정으로 로그인하면 레벨과 기록이 저장돼요.</p>}
            <button type="button" className="home-activity" aria-haspopup="dialog" onClick={() => setPickingActivity(true)}><LuMessageCircle aria-hidden="true" /><span>내 상태 말풍선 · <b>{getActivity(activity).label}</b>{bubbleOn ? '' : ' (숨김)'}</span><LuChevronRight aria-hidden="true" /></button>
            {pickingActivity && <ActivityDialog activity={activity} visible={bubbleOn} onChange={change => onChange({ ...config, ...change })} onClose={() => setPickingActivity(false)} />}
          </div>
        </aside>

        <div className="home-main">
          {resumeOffer ? <section className="card home-hero resume" aria-label="이어갈 수 있는 러닝">
            <div className="home-hero-heading"><span className="eyebrow">CONTINUE</span><h2><LuFootprints aria-hidden="true" /> 달리던 러닝이 있어요</h2></div>
            <div className="home-hero-body">
              <div>
                <div className="home-hero-progress">
                  <strong>{num(resumeKm, 2)}<small> / {num(resumeTarget)} km</small></strong>
                  <span>{resumeOffer.payload?.sim.paused ? '일시정지 중' : '달리는 중'} · {Math.round(resumeProgress * 100)}%</span>
                </div>
                <div className="home-hero-track" role="progressbar" aria-label="달린 거리" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(resumeProgress * 100)}><span style={{ width: `${resumeProgress * 100}%` }} /></div>
              </div>
              <button type="button" className="btn primary block big home-hero-action" disabled={starting} onClick={onResume}><LuPlay aria-hidden="true" /> 이어서 달리기</button>
            </div>
          </section> : <section className="card home-hero" aria-label="오늘의 러닝">
            <div className="home-hero-heading"><span className="eyebrow">TODAY'S RUN</span><h2><LuFootprints aria-hidden="true" /> 오늘의 러닝</h2></div>
            <div className="home-hero-body">
              <div className="home-hero-summary">
                <div><span>거리</span><b>{fmtKm(distanceKm)} km</b><small>도착 예정 {eta}</small></div>
                <div><span><LuGauge aria-hidden="true" /> {intensityLabel}</span><b>{fmtPace(paceSec)} /km</b><small>{speedKmh(paceSec).toFixed(1)} km/h · ~{cadenceFor(paceSec)} spm</small></div>
                <div><span><LuClock aria-hidden="true" /> 예상 시간</span><b>{fmtTime(totalSec)}</b><small>보급·휴식에 따라 달라져요</small></div>
                <div><span><LuSparkles aria-hidden="true" /> 완주 경험치</span><b>{xpText}</b><small>{anonymous ? '익명 체험은 저장 안 돼요' : '+ 점수 보너스'}</small></div>
              </div>
              <button className="btn primary block big home-hero-action" disabled={starting} onClick={onStart}><LuPlay aria-hidden="true" /> {starting ? '러닝 준비 중…' : '달리기 시작'}</button>
            </div>
          </section>}

          <div className="home-lower">
            <section className="card home-settings" aria-labelledby="home-settings-title">
              <div className="home-section-heading"><h3 id="home-settings-title">러닝 설정</h3>{resumeOffer && <span className="home-settings-warn">새로 시작하면 달리던 러닝은 이어갈 수 없어요</span>}</div>
              <div className="field">
                <span>{anonymous ? '기본 페이스' : `러닝 강도 · Lv.${training.level ?? '-'} 기준`}</span>
                <div className="intensity-options">
                  {INTENSITIES.map((effort) => <button type="button" key={effort.id} className={`intensity-option ${training.intensity === effort.id ? 'on' : ''}`} aria-pressed={training.intensity === effort.id} disabled={starting} onClick={() => onChange({ ...config, intensity: effort.id })}><strong>{effort.label}</strong><span>{fmtPace(trainingFor(xp, effort.id, anonymous).paceSec)} /km</span><small>{effort.description}</small></button>)}
                  {anonymous
                    ? <button type="button" className="intensity-option custom-pace locked" disabled><strong><LuLock /> 내 페이스</strong><span>회원 전용</span><small>정식 계정은 직접 골라요</small></button>
                    : <button type="button" className={`intensity-option custom-pace ${training.intensity === 'custom' ? 'on' : ''}`} aria-pressed={training.intensity === 'custom'} aria-haspopup="dialog" disabled={starting} onClick={() => setPicking(true)}>
                      <strong>{training.intensity === 'custom' ? '내 페이스' : <><LuPlus /> 내 페이스</>}</strong>
                      <span>{training.intensity === 'custom' ? `${fmtPace(paceSec)} /km` : '직접 고르기'}</span>
                      <small>{training.intensity === 'custom' ? `${effortLabel(training.drainMultiplier)} · 눌러서 바꾸기` : '레벨이 오르면 더 많이'}</small>
                    </button>}
                </div>
                {picking && <PacePickerDialog xp={xp} distanceKm={distanceKm} value={config.customPace} onClose={() => setPicking(false)} onSelect={(pace) => { onChange({ ...config, intensity: 'custom', customPace: pace }); setPicking(false) }} />}
              </div>
              <div className="field">
                <span>거리</span>
                <div className="presets">
                  {DISTANCES.filter(d => d <= maxDistance).map((d) => (
                    <button key={d} type="button" className={`chip ${distanceKm === d ? 'on' : ''}`} onClick={() => setDist(d)}>
                      {DIST_LABEL[d] ?? `${d}km`}
                    </button>
                  ))}
                  <label className="custom-km">
                    <input type="number" min={0.5} max={maxDistance} step={0.5} value={distanceKm} onChange={(e) => setDist(e.target.value)} />
                    km
                  </label>
                </div>
              </div>
              <p className="calc-note home-note"><LuDroplet /> {num(getSettings().stationEveryM / 1000)}km마다 보급소 · 체력이 바닥나면 {training.recoverySec}초 회복{anonymous ? '' : ' · 중간에 멈춰도 달린 만큼 성장'}</p>
              {resumeOffer && <button className="btn ghost block home-new-run" disabled={starting} onClick={onStart}>{starting ? '러닝 준비 중…' : '새 러닝 시작'}</button>}
            </section>

            <section className="card home-widget"><CoursePreview distanceKm={distanceKm} compact /></section>
          </div>
        </div>
      </div>
    </div>
  )
}
