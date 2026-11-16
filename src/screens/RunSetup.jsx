import { useEffect, useState } from 'react'
import CharacterPreview from '../components/CharacterPreview'
import { ACTIVITIES, ACTIVITY_GROUPS, getActivity } from '../lib/activities'
import ActivityBubble from '../components/ActivityBubble'
import GrowthCard from '../components/GrowthCard'
import AttendanceCard from '../components/AttendanceCard'
import { INTENSITIES, experienceFor, trainingFor, xpRangeText } from '../lib/progression'
import CoursePreview from '../components/CoursePreview'
import { getSettings } from '../lib/settings'
import { LuDroplet, LuLock, LuPlus, LuPlay } from 'react-icons/lu'
import PacePickerDialog from '../components/PacePickerDialog'
import { effortLabel } from '../lib/pacePlans'
import { cadenceFor, fmtPace, fmtTime, speedKmh, totalRunSec, fmtKm } from '../lib/pace'

const DISTANCES = [1, 3, 5, 10, 21.0975, 42.195]
const DIST_LABEL = { 21.0975: '하프', 42.195: '풀' }

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

export default function RunSetup({ profile, config, xp = 0, anonymous = false, starting = false, onChange, onStart, onOpenAttendance, resumeOffer, onResume }) {
  const [activityGroup, setActivityGroup] = useState(() => getActivity(config.activity).group)
  const { distanceKm } = config
  const maxDistance = anonymous ? getSettings().anonymousMaxKm : getSettings().maxDistanceKm
  useEffect(() => { if (distanceKm > maxDistance) onChange({ ...config, distanceKm: maxDistance }) }, [distanceKm, maxDistance])
  const [picking, setPicking] = useState(false)
  const training = trainingFor(xp, config.intensity, anonymous, config.customPace)
  const { paceSec } = training
  const setDist = (v) => onChange({ ...config, distanceKm: clamp(Number(v) || 0.5, 0.5, maxDistance) })

  const totalSec = totalRunSec(paceSec, distanceKm)
  const eta = new Date(Date.now() + totalSec * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="setup-screen">
      <div className="setup-grid">
        <section className="card preview-card">
          <div className="preview-canvas">
            <CharacterPreview color={profile.color} skin={profile.skin} hair={profile.hair} outfit={profile.outfit} nickname={profile.nickname} activity={config.showActivity !== false ? config.activity || 'rest' : undefined} />
          </div>
        </section>

        <section className="card form-card">
          <div className="eyebrow">STEP 2</div>
          <h2>오늘의 러닝</h2>
          {resumeOffer && <section className="resume-card" aria-label="이어갈 수 있는 러닝">
            <div><strong>달리던 러닝이 있어요</strong><span>{((resumeOffer.payload?.sim.dist || 0) / 1000).toFixed(2)} / {resumeOffer.session.target_km} km · {resumeOffer.payload?.sim.paused ? '일시정지 중' : '달리는 중'}</span></div>
            <button type="button" className="btn primary" disabled={starting} onClick={onResume}><LuPlay /> 이어서 달리기</button>
            <small>새 러닝을 시작하면 이전 러닝은 이어갈 수 없어요.</small>
          </section>}
          <GrowthCard xp={xp} anonymous={anonymous} />
          <AttendanceCard anonymous={anonymous} onOpenCalendar={onOpenAttendance} />

          <div className="field">
            <span>{anonymous ? '기본 페이스' : '러닝 강도'}</span>
            <div className="intensity-options">
              {INTENSITIES.map((effort) => <button type="button" key={effort.id} className={`intensity-option ${training.intensity === effort.id ? 'on' : ''}`} aria-pressed={training.intensity === effort.id} disabled={starting} onClick={() => onChange({ ...config, intensity: effort.id })}><strong>{effort.label}</strong><span>{fmtPace(trainingFor(xp, effort.id, anonymous).paceSec)} /km</span><small>{effort.description}</small></button>)}
              {anonymous
                ? <button type="button" className="intensity-option custom-pace locked" disabled><strong><LuLock /> 내 페이스</strong><span>회원 전용</span><small>정식 계정은 레벨에 맞춰 직접 골라요</small></button>
                : <button type="button" className={`intensity-option custom-pace ${training.intensity === 'custom' ? 'on' : ''}`} aria-pressed={training.intensity === 'custom'} aria-haspopup="dialog" disabled={starting} onClick={() => setPicking(true)}>
                  <strong>{training.intensity === 'custom' ? '내 페이스' : <><LuPlus /> 내 페이스</>}</strong>
                  <span>{training.intensity === 'custom' ? `${fmtPace(paceSec)} /km` : '직접 고르기'}</span>
                  <small>{training.intensity === 'custom' ? `${effortLabel(training.drainMultiplier)} · 눌러서 바꾸기` : '레벨이 오를수록 더 많은 페이스'}</small>
                </button>}
            </div>
            <small>{anonymous ? '기본 페이스 3가지 중 선택해요. 익명 러너는 레벨과 성장, 부스터가 없어요.' : `Lv.${training.level} 기준 페이스예요. 레벨이 오르면 같은 강도에서도 빨라지고, 고를 수 있는 페이스도 늘어나요.`}</small>
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

          <div className="calc">
            <div className="calc-formula">
              {fmtPace(paceSec)}/km × {fmtKm(distanceKm)}km =
            </div>
            <div className="calc-total">{fmtTime(totalSec)}</div>
            <div className="calc-grid">
              <div><span>평균 속도</span><b>{speedKmh(paceSec).toFixed(1)} km/h</b></div>
              <div><span>케이던스</span><b>~{cadenceFor(paceSec)} spm</b></div>
              <div><span>도착 예정</span><b>{eta}</b></div>
            </div>
            <p className="calc-note">
              <LuDroplet /> {getSettings().stationEveryM / 1000}km마다 보급소가 있어요. 체력이 바닥나면 {training.recoverySec}초 회복해요. 실제 시간은 {anonymous ? '보급·휴식' : '보급·휴식·부스터'}에 따라 달라져요.
            </p>
          </div>

          <p className="xp-estimate">{anonymous ? '익명 체험은 경험치가 저장되지 않아요.' : `완주 예상 +${xpRangeText(experienceFor({ distanceKm, completed: true }))} XP + 점수 보너스 · 중간에 멈춰도 달린 만큼 성장해요.`}</p>
          <button className="btn primary block big" disabled={starting} onClick={onStart}>{starting ? '러닝 준비 중…' : '달리기 시작'}</button>
        </section>

        <section className="card side-card">
          <CoursePreview distanceKm={distanceKm} />

          <section className="activity-picker" aria-labelledby="activity-title">
            <div className="eyebrow">WHILE MY RUNNER RUNS</div>
            <h3 id="activity-title">현재 무엇을 하고 있나요?</h3>
            <p>러너가 달리는 동안, 나의 상태를 띄워보세요.</p>
            <button type="button" className="chip activity-visibility" aria-pressed={config.showActivity !== false} onClick={() => onChange({ ...config, showActivity: config.showActivity === false })}>{config.showActivity === false ? '구름 말풍선 보이기' : '구름 말풍선 숨기기'}</button>
            <div className="activity-groups" aria-label="활동 카테고리">{ACTIVITY_GROUPS.map((group) => <button type="button" key={group.id} className={`activity-group ${activityGroup === group.id ? 'on' : ''}`} aria-pressed={activityGroup === group.id} onClick={() => setActivityGroup(group.id)}>{group.label}</button>)}</div>
            <div className="activity-options">
              {ACTIVITIES.filter((activity) => activity.group === activityGroup).map((activity) => <button type="button" key={activity.id} className={`activity-option ${(config.activity || 'rest') === activity.id ? 'on' : ''}`} aria-pressed={(config.activity || 'rest') === activity.id} onClick={() => onChange({ ...config, activity: activity.id })}>{activity.label}<span aria-hidden="true">{(config.activity || 'rest') === activity.id ? '✓' : '+'}</span></button>)}
            </div>
            {config.showActivity !== false && <div className="activity-sample"><ActivityBubble activity={config.activity || 'rest'} /></div>}
          </section>
        </section>
      </div>
    </div>
  )
}
