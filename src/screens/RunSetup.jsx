import { useMemo } from 'react'
import CharacterPreview from '../components/CharacterPreview'
import { MOCK_RUNNERS } from '../lib/mockData'
import { BIOMES } from '../three/biomes'
import { BIOME_ICONS } from '../lib/icons'
import { STAMINA } from '../lib/stamina'
import { LuDroplet } from 'react-icons/lu'
import { cadenceFor, fmtPace, fmtTime, speedKmh, totalRunSec, fmtKm } from '../lib/pace'

const DISTANCES = [1, 3, 5, 10, 21.0975, 42.195]
const DIST_LABEL = { 21.0975: '하프', 42.195: '풀' }
const PRESETS = [
  { label: '걷기', pace: 540 },
  { label: '조깅', pace: 420 },
  { label: '러닝', pace: 330 },
  { label: '레이스', pace: 270 },
]

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

export default function RunSetup({ profile, config, onChange, onStart }) {
  const { paceSec, distanceKm } = config
  const setPace = (v) => onChange({ ...config, paceSec: clamp(Math.round(v), 180, 900) })
  const setDist = (v) => onChange({ ...config, distanceKm: clamp(Number(v) || 0.5, 0.5, 100) })

  const totalSec = totalRunSec(paceSec, distanceKm)
  const eta = new Date(Date.now() + totalSec * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  const segments = useMemo(
    () => Array.from({ length: Math.ceil(distanceKm) }, (_, i) => ({ km: i, b: BIOMES[i % BIOMES.length] })).slice(0, 10),
    [distanceKm]
  )

  return (
    <div className="setup-screen">
      <div className="setup-grid">
        <section className="card preview-card">
          <div className="preview-canvas">
            <CharacterPreview color={profile.color} skin={profile.skin} hair={profile.hair} nickname={profile.nickname} />
          </div>
        </section>

        <section className="card form-card">
          <div className="eyebrow">STEP 2</div>
          <h2>오늘의 러닝</h2>

          <div className="field">
            <span>목표 페이스 <em>(1km 당)</em></span>
            <div className="pace-ctrl">
              <button type="button" onClick={() => setPace(paceSec + 5)} aria-label="느리게">−</button>
              <div className="pace-val">{fmtPace(paceSec)}<small>/km</small></div>
              <button type="button" onClick={() => setPace(paceSec - 5)} aria-label="빠르게">+</button>
            </div>
            <input type="range" min={180} max={900} step={5} value={1080 - paceSec} onChange={(e) => setPace(1080 - Number(e.target.value))} />
            <div className="presets">
              {PRESETS.map((p) => (
                <button key={p.label} type="button" className={`chip ${paceSec === p.pace ? 'on' : ''}`} onClick={() => setPace(p.pace)}>
                  {p.label} {fmtPace(p.pace)}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span>거리</span>
            <div className="presets">
              {DISTANCES.map((d) => (
                <button key={d} type="button" className={`chip ${distanceKm === d ? 'on' : ''}`} onClick={() => setDist(d)}>
                  {DIST_LABEL[d] ?? `${d}km`}
                </button>
              ))}
              <label className="custom-km">
                <input type="number" min={0.5} max={100} step={0.5} value={distanceKm} onChange={(e) => setDist(e.target.value)} />
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
              <LuDroplet /> 1km마다 보급소가 있어요. 물·탄수화물을 안 챙기면 점점 느려지고, 체력이 바닥나면 {STAMINA.recoverySec}초 쉬어야 해요.
            </p>
          </div>

          <button className="btn primary block big" onClick={onStart}>달리기 시작</button>
        </section>

        <section className="card side-card">
          <h3>코스 구간 <span className="badge">1km마다 풍경이 바뀌어요</span></h3>
          <ol className="segments">
            {segments.map(({ km, b }) => (
              <li key={km}><span className="seg-km">{km}~{Math.min(km + 1, distanceKm).toFixed(km + 1 > distanceKm ? 1 : 0)}km</span><span className="seg-name">{(() => { const I = BIOME_ICONS[b.key]; return <I /> })()}{b.name}</span></li>
            ))}
            {Math.ceil(distanceKm) > 10 && <li className="muted">… 이후 순환</li>}
          </ol>

          <h3>같이 달리는 러너 <span className="badge">목업</span></h3>
          <ul className="runners">
            {MOCK_RUNNERS.map((r) => (
              <li key={r.id}>
                <span className="dot" style={{ background: r.color }} />
                <span className="rn">{r.nickname}</span>
                <span className="rp">{fmtPace(r.paceSec)}/km</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
