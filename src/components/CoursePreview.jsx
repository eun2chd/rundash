import { LuFlag, LuDroplet, LuMap } from 'react-icons/lu'
import { BIOMES } from '../three/biomes'
import { BIOME_ICONS } from '../lib/icons'
import { STAMINA } from '../lib/stamina'
import { fmtKm } from '../lib/pace'
import { num } from '../lib/format'

const COURSE_STYLE = {
  park: { color: '#5f6b3c', bg: '#e8eddf', description: '초록빛 나무 사이, 가볍게 출발' },
  autumn: { color: '#a05228', bg: '#f4e5d5', description: '따뜻한 단풍 아래 나만의 호흡' },
  city: { color: '#40576d', bg: '#e5ebf0', description: '도심의 리듬에 맞춰 한 걸음 더' },
  beach: { color: '#276b78', bg: '#e1eef0', description: '바닷바람과 함께 페이스 유지' },
  night: { color: '#5d4b85', bg: '#eae5f2', description: '반짝이는 야경 속 마무리' },
}
// compact: the home widget (a tall, narrow card) shows the course top to bottom: start, each
// km of scenery with its aid station, then the finish.
export default function CoursePreview({ distanceKm, compact = false }) {
  const visibleKm = Math.min(distanceKm, 10)
  const segments = Array.from({ length: Math.ceil(visibleKm) }, (_, km) => ({ km, end: Math.min(km + 1, distanceKm), biome: BIOMES[km % BIOMES.length] }))
  const stationCount = Math.max(0, Math.ceil((distanceKm * 1000 - 80 - STAMINA.stationFirstM) / STAMINA.stationEveryM))
  return <section className={`course-preview${compact ? " compact" : ""}`} aria-label="러닝 코스 구간">
    <div className="course-heading"><div><span className="eyebrow">TODAY'S ROUTE</span><h3><LuMap /> 오늘 달릴 코스</h3></div><span className="course-distance">{fmtKm(distanceKm)}<small>km</small></span></div>
    <div className="course-facts"><span>{Math.min(Math.ceil(distanceKm), 5)}가지 풍경</span><span>보급소 {stationCount}곳</span><span>1km마다 전환</span></div>
    {!compact && <div className="course-strip" aria-hidden="true">{segments.map(({ km, end, biome }) => <span key={km} style={{ background: COURSE_STYLE[biome.key].color, flex: end - km }} />)}</div>}
    {!compact && <div className="course-axis"><span>START · 0km</span><span>{distanceKm > 10 ? '첫 10km 미리보기' : `FINISH · ${fmtKm(distanceKm)}km`}</span></div>}
    {compact ? <div className="course-vertical-scroll" role="region" aria-label="구간별 풍경" tabIndex={0}>
      <ol className="course-vertical">
        <li className="course-vertical-start"><span className="course-vertical-dot" aria-hidden="true" /><strong>START</strong><span>0km</span></li>
        {segments.map(({ km, end, biome }) => { const Icon = BIOME_ICONS[biome.key]; const theme = COURSE_STYLE[biome.key]; const station = km + .6 < distanceKm - .08
          return <li key={km} style={{ '--course-color': theme.color, '--course-bg': theme.bg }}>
            <span className="course-vertical-icon" aria-hidden="true"><Icon /></span>
            <strong>{biome.name}</strong>
            <span>{km}~{fmtKm(end)}km</span>
            {station && <em><LuDroplet aria-hidden="true" /> {num(km + .6, 1)}km 보급</em>}
          </li> })}
        {distanceKm > 10 && <li className="course-vertical-more"><span className="course-vertical-dot" aria-hidden="true" /><span>10km 이후에도 5가지 풍경이 이어져요</span></li>}
        <li className="course-vertical-finish"><span className="course-vertical-dot" aria-hidden="true"><LuFlag /></span><strong>FINISH</strong><span>{fmtKm(distanceKm)}km</span></li>
      </ol>
    </div> : <>
    <ol className="course-timeline">{segments.map(({ km, end, biome }) => {
      const Icon = BIOME_ICONS[biome.key]
      const theme = COURSE_STYLE[biome.key]
      const stationKm = km + .6
      const hasStation = stationKm < distanceKm - .08
      return <li key={km} style={{ '--course-color': theme.color, '--course-bg': theme.bg }}>
        <div className="course-node"><Icon /></div><div className="course-segment"><div className="course-segment-heading"><strong>{biome.name}</strong><span>{km}~{fmtKm(end)}km</span></div><p>{theme.description}</p>{hasStation && <span className="course-aid"><LuDroplet /> {num(stationKm, 1)}km · 물 / 에너지 젤</span>}</div>
      </li>
    })}</ol>
    {distanceKm > 10 && <p className="course-repeat">10km 이후에도 5가지 풍경이 순서대로 이어져요.</p>}
    </>}
    {!compact && <div className="course-finish"><span><LuFlag /></span><div><strong>{fmtKm(distanceKm)}km · 나만의 완주</strong><p>한 걸음씩, 끝까지 가보는 거예요.</p></div></div>}
  </section>
}
