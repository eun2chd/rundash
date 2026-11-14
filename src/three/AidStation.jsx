import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { LuDroplet } from 'react-icons/lu'
import { poseAt } from './track'
import { STATION_LANE } from '../lib/mockData'

// 코스 옆 보급소 텐트 + 테이블 (보급품은 Collectible onTable 로 위에 올라감)
export default function AidStation({ station, getMyDist, closed }) {
  const ref = useRef()
  const light = useRef()
  const distance = useRef()
  const sign = useRef()
  const { pos, rotY } = useMemo(() => {
    const p = poseAt(station.dist, STATION_LANE, { pos: new THREE.Vector3(), tan: new THREE.Vector3() })
    return { pos: p.pos.clone(), rotY: Math.atan2(p.tan.x, p.tan.z) }
  }, [station.dist])

  useFrame(() => {
    const gap = station.dist - getMyDist()
    ref.current.visible = gap > -40 && gap < 170
    if (sign.current) sign.current.style.display = ref.current.visible ? 'flex' : 'none'
    const near = gap <= 40 && gap >= -8 && !closed
    if (light.current) light.current.material.emissiveIntensity = near ? 1.4 : .12
    if (distance.current) distance.current.textContent = closed ? '통과' : near ? '지금 보급 가능' : `${Math.max(0, Math.round(gap))}m 앞`
  })

  const roof = closed ? '#817b70' : '#5f6b3c'
  return (
    <group ref={ref} position={[pos.x, 0, pos.z]} rotation-y={rotY}>
      <mesh position={[0, .06, 0]}><boxGeometry args={[2.9, .12, 4.25]} /><meshStandardMaterial color="#d9d0bc" roughness={.9} /></mesh>
      <mesh position={[1.45, .13, 0]}><boxGeometry args={[.1, .025, 4.25]} /><meshStandardMaterial color="#e07b39" /></mesh>
      <mesh position={[-1.19, 1.35, 0]}><boxGeometry args={[.065, 1.7, 3.55]} /><meshStandardMaterial color={roof} /></mesh>
      {[.8, 1.85].map((y) => <mesh key={y} position={[-1.145, y, 0]}><boxGeometry args={[.015, .08, 3.5]} /><meshStandardMaterial color="#fff8e6" /></mesh>)}
      {/* 테이블 */}
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[1.2, 0.12, 3.35]} />
        <meshStandardMaterial color="#f4f1e8" />
      </mesh>
      <mesh position={[.6, .57, 0]}><boxGeometry args={[.045, .4, 3.3]} /><meshStandardMaterial color="#fff8e6" /></mesh>
      <mesh position={[.63, .6, 0]}><boxGeometry args={[.015, .08, 3.3]} /><meshStandardMaterial color="#e07b39" /></mesh>
      {[[-0.38, -1.45], [0.38, -1.45], [-0.38, 1.45], [0.38, 1.45]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.4, z]}>
          <boxGeometry args={[0.06, 0.8, 0.06]} />
          <meshStandardMaterial color="#8a8578" />
        </mesh>
      ))}
      {/* 텐트 */}
      {[[-1.25, -1.85], [1.25, -1.85], [-1.25, 1.85], [1.25, 1.85]].map(([x, z], i) => (
        <mesh key={i} position={[x, 1.4, z]}>
          <cylinderGeometry args={[0.045, 0.055, 2.8, 10]} />
          <meshStandardMaterial color="#fff8e6" metalness={.3} />
        </mesh>
      ))}
      {[-1, 1].map((side) => <mesh key={side} position={[side * .76, 2.98, 0]} rotation-z={-side * .22}><boxGeometry args={[1.7, .12, 4.4]} /><meshStandardMaterial color={roof} roughness={.8} /></mesh>)}
      {/* 도로 쪽 배너 (+x 가 도로 방향) */}
      <mesh position={[1.3, 2.58, 0]}>
        <boxGeometry args={[0.06, 0.45, 4.25]} />
        <meshStandardMaterial color={roof} />
      </mesh>
      {[-1.75, 1.75].map((z) => <mesh key={z} position={[1.34, 2.58, z]}><boxGeometry args={[.025, .45, .16]} /><meshStandardMaterial color="#e07b39" /></mesh>)}
      <mesh ref={light} position={[1.35, 2.58, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[.085, .085, .02, 16]} /><meshStandardMaterial color={closed ? '#817b70' : '#d4ec9f'} emissive={closed ? '#000000' : '#b9d27a'} /></mesh>
      {[-1.65, 1.65].map((z) => <group key={z} position={[1.65, 0, z]}>
        <mesh position-y={.08}><boxGeometry args={[.42, .08, .42]} /><meshStandardMaterial color="#303a35" /></mesh>
        <mesh position-y={.34}><coneGeometry args={[.15, .5, 12]} /><meshStandardMaterial color="#e07b39" /></mesh>
        <mesh position-y={.37}><cylinderGeometry args={[.08, .11, .08, 12]} /><meshStandardMaterial color="#fff8e6" /></mesh>
      </group>)}
      {[-1, 1].map((side) => <group key={side} position={[-.82, .45, side * 1.1]}>
        <mesh><boxGeometry args={[.48, .65, .62]} /><meshStandardMaterial color={side < 0 ? '#6fb7d6' : '#e8c547'} /></mesh>
        <mesh position-y={.35}><boxGeometry args={[.5, .065, .65]} /><meshStandardMaterial color="#fff8e6" /></mesh>
        <mesh position={[.26, .05, 0]}><boxGeometry args={[.045, .12, .2]} /><meshStandardMaterial color="#fff8e6" /></mesh>
      </group>)}
      <Html position={[0, 3.65, 0]} center distanceFactor={12} zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={sign} className={`station-sign ${closed ? 'closed' : ''}`}>
          <span className="station-number">{String(station.n).padStart(2, '0')}</span><div><strong><LuDroplet /> RUN DASH 보급소</strong><span ref={distance}>{closed ? '통과' : '물 +15 · 젤 +25'}</span></div>
        </div>
      </Html>
    </group>
  )
}
