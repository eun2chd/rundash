import { MINIMAP, TRACK_LENGTH, poseAt } from '../three/track'
import { nearbyMapStations } from '../lib/minimapStations'
import { runnerMapColors, SELF_MAP_COLOR, STATION_MAP_COLOR } from '../lib/mapColors'

const dotPos = (dist, lane = 0) => {
  const { pos } = poseAt(dist, lane)
  return MINIMAP.project(pos.x, pos.z)
}

export default function Minimap({ me, others, stations = [] }) {
  const [mx, my] = dotPos(me.dist, me.lane)
  const colors = runnerMapColors(others)
  const visibleStations = nearbyMapStations(stations, me.dist, TRACK_LENGTH)
  const nextStation = stations.filter(st => !st.closed && st.dist >= me.dist).sort((a, b) => a.dist - b.dist)[0]
  return <div className="minimap-content">
    <div className="minimap-scope">주변 한 바퀴 · 약 {Math.round(TRACK_LENGTH)}m</div>
    <svg className="minimap" role="img" aria-label={`내 위치와 다른 러너 ${others.length}명, 보급소 위치`} viewBox={`0 0 ${MINIMAP.w} ${MINIMAP.h}`}>
      <path d={MINIMAP.d} fill="none" stroke="rgba(255,248,230,.25)" strokeWidth="9" strokeLinejoin="round" />
      <path d={MINIMAP.d} fill="none" stroke="rgba(255,248,230,.75)" strokeWidth="2.5" strokeDasharray="6 5" />
      {visibleStations.map(st => {
        const [x, y] = dotPos(st.dist, 4.9)
        return <rect key={st.id} x={x-5} y={y-5} width="10" height="10" rx="1" fill={st.closed ? '#8f8a7e' : STATION_MAP_COLOR} stroke="#24251f" strokeWidth="2"><title>{st.closed ? '지나온 ' : ''}보급소 {st.n || ''} · {Math.round(st.dist - me.dist)}m</title></rect>
      })}
      {others.map(runner => {
        const [x, y] = dotPos(runner.dist, runner.lane)
        return <circle key={runner.id} cx={x} cy={y} r="6" fill={colors.get(String(runner.id))} stroke="#17212b" strokeWidth="2"><title>{runner.nickname || '러너'}</title></circle>
      })}
      <circle cx={mx} cy={my} r="11" fill="none" stroke={SELF_MAP_COLOR} strokeWidth="2.5" opacity=".85" />
      <circle cx={mx} cy={my} r="6.5" fill={SELF_MAP_COLOR} stroke="#17212b" strokeWidth="2.5"><title>내 위치</title></circle>
    </svg>
    <p className="minimap-next-station">{nextStation ? `다음 보급소 ${nextStation.n} · ${Math.max(0, Math.round(nextStation.dist - me.dist))}m 앞${visibleStations.some(st => st.id === nextStation.id) ? '' : ' (지도 범위 밖)'}` : '앞으로 남은 보급소 없음'}</p>
    <div className="minimap-legend" aria-label="지도 표시 안내">
      <span><i className="map-key map-key-self" />나</span>
      <span><i className="map-key map-key-runner" />다른 러너</span>
      <span><i className="map-key map-key-station" />보급소</span>
    </div>
    {!!others.length && <ul className="minimap-runners" aria-label="러너별 지도 색상">{others.map(runner => <li key={runner.id}><i className="map-key" style={{ background: colors.get(String(runner.id)) }} /><span>{runner.nickname || '러너'}</span></li>)}</ul>}
  </div>
}
