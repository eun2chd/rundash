import { LuFlag, LuDroplet, LuMap } from 'react-icons/lu'
import { BIOMES } from '../three/biomes'
import { BIOME_ICONS } from '../lib/icons'
import { STAMINA } from '../lib/stamina'
import { fmtKm } from '../lib/pace'

const COURSE_STYLE = {
  park: { color: '#5f6b3c', bg: '#e8eddf', description: '초록빛 나무 사이, 가볍게 출발' },
  autumn: { color: '#a05228', bg: '#f4e5d5', description: '따뜻한 단풍 아래 나만의 호흡' },
  city: { color: '#40576d', bg: '#e5ebf0', description: '도심의 리듬에 맞춰 한 걸음 더' },
  beach: { color: '#276b78', bg: '#e1eef0', description: '바닷바람과 함께 페이스 유지' },
  night: { color: '#5d4b85', bg: '#eae5f2', description: '반짝이는 야경 속 마무리' },
}
export default function CoursePreview({ distanceKm }) {
  const visibleKm = Math.min(distanceKm, 10)
  const segments = Array.from({ length: Math.ceil(visibleKm) }, (_, km) => ({ km, end: Math.min(km + 1, distanceKm), biome: BIOMES[km % BIOMES.length] }))
  const stationCount = Math.max(0, Math.ceil((distanceKm * 1000 - 80 - STAMINA.stationFirstM) / STAMINA.stationEveryM))
  return <section className="course-preview" aria-label="러닝 코스 구간">
    <div className="course-heading"><div><span className="eyebrow">TODAY'S ROUTE</span><h3><LuMap /> 오늘 달릴 코스</h3></div><span className="course-distance">{fmtKm(distanceKm)}<small>km</small></span></div>
    <div className="course-facts"><span>{Math.min(Math.ceil(distanceKm), 5)}가지 풍경</span><span>보급소 {stationCount}곳</span><span>1km마다 전환</span></div>
    <div className="course-strip" aria-hidden="true">{segments.map(({ km, end, biome }) => <span key={km} style={{ background: COURSE_STYLE[biome.key].color, flex: end - km }} />)}</div>
    <div className="course-axis"><span>START · 0km</span><span>{distanceKm > 10 ? '첫 10km 미리보기' : `FINISH · ${fmtKm(distanceKm)}km`}</span></div>
    <ol className="course-timeline">{segments.map(({ km, end, biome }) => {
      const Icon = BIOME_ICONS[biome.key]
      const theme = COURSE_STYLE[biome.key]
      const stationKm = km + .6
      const hasStation = stationKm < distanceKm - .08
      return <li key={km} style={{ '--course-color': theme.color, '--course-bg': theme.bg }}>
        <div className="course-node"><Icon /></div><div className="course-segment"><div className="course-segment-heading"><strong>{biome.name}</strong><span>{km}~{fmtKm(end)}km</span></div><p>{theme.description}</p>{hasStation && <span className="course-aid"><LuDroplet /> {stationKm.toFixed(1)}km · 물 / 에너지 젤</span>}</div>
      </li>
    })}</ol>
    {distanceKm > 10 && <p className="course-repeat">10km 이후에도 5가지 풍경이 순서대로 이어져요.</p>}
    <div className="course-finish"><span><LuFlag /></span><div><strong>{fmtKm(distanceKm)}km · 나만의 완주</strong><p>한 걸음씩, 끝까지 가보는 거예요.</p></div></div>
  </section>
}
