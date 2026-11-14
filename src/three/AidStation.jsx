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
  const { pos, rotY } = useMemo(() => {
    const p = poseAt(station.dist, STATION_LANE, { pos: new THREE.Vector3(), tan: new THREE.Vector3() })
    return { pos: p.pos.clone(), rotY: Math.atan2(p.tan.x, p.tan.z) }
  }, [station.dist])

  useFrame(() => {
    const gap = station.dist - getMyDist()
    ref.current.visible = gap > -40 && gap < 170
  })

  const roof = closed ? '#9d978a' : '#e07b39'
  return (
    <group ref={ref} position={[pos.x, 0, pos.z]} rotation-y={rotY}>
      {/* 테이블 */}
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[0.9, 0.08, 3.2]} />
        <meshStandardMaterial color="#f4f1e8" />
      </mesh>
      {[[-0.38, -1.45], [0.38, -1.45], [-0.38, 1.45], [0.38, 1.45]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.4, z]}>
          <boxGeometry args={[0.06, 0.8, 0.06]} />
          <meshStandardMaterial color="#8a8578" />
        </mesh>
      ))}
      {/* 텐트 */}
      {[[-1.1, -1.8], [1.1, -1.8], [-1.1, 1.8], [1.1, 1.8]].map(([x, z], i) => (
        <mesh key={i} position={[x, 1.25, z]}>
          <cylinderGeometry args={[0.05, 0.05, 2.5, 6]} />
          <meshStandardMaterial color="#d8d3c6" />
        </mesh>
      ))}
      <mesh position={[0, 2.95, 0]} rotation-y={Math.PI / 4} scale={[1, 1, 1.6]}>
        <coneGeometry args={[2.3, 1.0, 4]} />
        <meshStandardMaterial color={roof} flatShading />
      </mesh>
      {/* 도로 쪽 배너 (+x 가 도로 방향) */}
      <mesh position={[1.12, 2.25, 0]}>
        <boxGeometry args={[0.04, 0.45, 3.6]} />
        <meshStandardMaterial color={closed ? '#bdb7aa' : '#fff8e6'} />
      </mesh>
      <Html position={[0, 3.9, 0]} center distanceFactor={14} zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`station-sign ${closed ? 'closed' : ''}`}>
          <LuDroplet />
          보급소 {station.n}
          {closed ? ' · 종료' : ''}
        </div>
      </Html>
    </group>
  )
}
