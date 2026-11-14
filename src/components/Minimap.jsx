import { MINIMAP, poseAt } from '../three/track'

const dotPos = (dist, lane = 0) => {
  const { pos } = poseAt(dist, lane)
  return MINIMAP.project(pos.x, pos.z)
}

export default function Minimap({ me, others, stations = [] }) {
  const [mx, my] = dotPos(me.dist, me.lane)
  return (
    <svg className="minimap" viewBox={`0 0 ${MINIMAP.w} ${MINIMAP.h}`}>
      <path d={MINIMAP.d} fill="none" stroke="rgba(255,248,230,.25)" strokeWidth="9" strokeLinejoin="round" />
      <path d={MINIMAP.d} fill="none" stroke="rgba(255,248,230,.75)" strokeWidth="2.5" strokeDasharray="6 5" />
      {stations.map((st) => {
        const [x, y] = dotPos(st.dist, 4.9)
        return <rect key={st.id} x={x - 5} y={y - 5} width="10" height="10" rx="2" fill={st.closed ? '#8f8a7e' : '#e07b39'} stroke="#24251f" strokeWidth="2" />
      })}
      {others.map((o) => {
        const [x, y] = dotPos(o.dist, o.lane)
        return <circle key={o.id} cx={x} cy={y} r="5" fill={o.color} stroke="#24251f" strokeWidth="2" />
      })}
      <circle cx={mx} cy={my} r="10" fill="none" stroke="#fff6d5" strokeWidth="2.5" opacity=".7" />
      <circle cx={mx} cy={my} r="6.5" fill={me.color} stroke="#fff" strokeWidth="2.5" />
    </svg>
  )
}
