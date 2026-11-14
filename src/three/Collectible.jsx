import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { poseAt } from './track'
import { ITEM_TYPES } from '../lib/mockData'

// 클릭해서 줍는 아이템. onTable: 보급소 테이블 위 보급품
export default function Collectible({ item, getMyDist, onCollect, onTable = false }) {
  const outer = useRef()
  const inner = useRef()
  const t = ITEM_TYPES[item.type]
  const pos = useMemo(
    () => poseAt(item.dist, item.lane, { pos: new THREE.Vector3(), tan: new THREE.Vector3() }).pos.clone(),
    [item.dist, item.lane]
  )

  useFrame(({ clock }) => {
    const gap = item.dist - getMyDist()
    outer.current.visible = gap > -10 && gap < 120
    const k = clock.elapsedTime
    if (onTable) {
      inner.current.rotation.y = k * 0.8
      inner.current.position.y = 1.12 + Math.sin(k * 2 + item.dist) * 0.04
      inner.current.scale.setScalar(gap < 40 && gap > -8 ? 0.95 : 0.75)
    } else {
      inner.current.rotation.y = k * 2.2
      inner.current.position.y = 1.2 + Math.sin(k * 3 + item.dist) * 0.15
      inner.current.scale.setScalar(gap < 60 ? 1.15 : 0.9)
    }
  })

  const handle = (e) => {
    e.stopPropagation()
    if (!outer.current.visible) return
    onCollect(item)
  }

  return (
    <group ref={outer} position={[pos.x, 0, pos.z]}>
      {!onTable && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.12}>
          <ringGeometry args={[0.55, 0.8, 28]} />
          <meshBasicMaterial color={t.color} transparent opacity={0.55} depthWrite={false} />
        </mesh>
      )}
      <group
        ref={inner}
        onClick={handle}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        {item.type === 'water' && (
          <>
            <mesh><cylinderGeometry args={[0.18, 0.18, 0.5, 14]} /><meshStandardMaterial color={t.color} emissive={t.color} emissiveIntensity={0.35} /></mesh>
            <mesh position-y={0.3}><cylinderGeometry args={[0.08, 0.08, 0.1, 10]} /><meshStandardMaterial color="#ffffff" /></mesh>
          </>
        )}
        {item.type === 'gel' && (
          <>
            <mesh rotation-z={0.2}><boxGeometry args={[0.32, 0.46, 0.08]} /><meshStandardMaterial color={t.color} emissive="#f0a500" emissiveIntensity={0.45} /></mesh>
            <mesh position-y={0.28} rotation-z={0.2}><boxGeometry args={[0.12, 0.1, 0.06]} /><meshStandardMaterial color="#3d3a36" /></mesh>
          </>
        )}
        {item.type === 'medal' && (
          <>
            <mesh rotation-x={Math.PI / 2}><cylinderGeometry args={[0.36, 0.36, 0.08, 24]} /><meshStandardMaterial color={t.color} emissive="#c47d12" emissiveIntensity={0.5} metalness={0.4} roughness={0.35} /></mesh>
            <mesh position-y={0.5}><boxGeometry args={[0.18, 0.45, 0.04]} /><meshStandardMaterial color="#d9534f" /></mesh>
          </>
        )}
        {/* 클릭 판정 확장 */}
        <mesh>
          <sphereGeometry args={[onTable ? 0.42 : 1.3, 8, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}
