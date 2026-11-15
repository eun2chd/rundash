import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { poseAt } from './track'

export const FINISH_VISIBLE_M = 300

function checkerTexture(columns, rows, label) {
  const canvas = document.createElement('canvas')
  canvas.width = 512; canvas.height = Math.round(512 * rows / columns)
  const ctx = canvas.getContext('2d')
  const size = canvas.width / columns
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    ctx.fillStyle = (x + y) % 2 ? '#1f201a' : '#fff8e6'
    ctx.fillRect(x * size, y * size, size, size)
  }
  if (label) {
    ctx.fillStyle = 'rgba(224, 123, 57, .94)'
    ctx.fillRect(canvas.width * .2, canvas.height * .14, canvas.width * .6, canvas.height * .72)
    ctx.fillStyle = '#fff8e6'
    ctx.font = `900 ${Math.round(canvas.height * .5)}px 'Pretendard Variable', Pretendard, sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 2)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

// Finish arch and chequered line at the target distance, shown from 300m out.
export default function FinishLine({ distance, getMyDist }) {
  const group = useRef()
  const sign = useRef()
  const label = useRef()
  const { pos, rotY, banner, floor } = useMemo(() => {
    const p = poseAt(distance, 0, { pos: new THREE.Vector3(), tan: new THREE.Vector3() })
    return { pos: p.pos.clone(), rotY: Math.atan2(p.tan.x, p.tan.z), banner: checkerTexture(16, 2, 'FINISH'), floor: checkerTexture(12, 2) }
  }, [distance])

  useFrame(() => {
    const gap = distance - getMyDist()
    group.current.visible = gap > -40 && gap < FINISH_VISIBLE_M + 20
    if (sign.current) sign.current.style.display = group.current.visible && gap > 2 ? 'flex' : 'none'
    if (label.current) label.current.textContent = `결승선까지 ${Math.max(0, Math.round(gap))}m`
  })

  return <group ref={group} position={pos} rotation-y={rotY} visible={false}>
    <mesh rotation-x={-Math.PI / 2} position-y={0.07}>
      <planeGeometry args={[6, 1]} />
      <meshStandardMaterial map={floor} roughness={0.9} />
    </mesh>
    {[-3.5, 3.5].map(x => <mesh key={x} position={[x, 2.7, 0]}>
      <cylinderGeometry args={[0.18, 0.22, 5.4, 12]} />
      <meshStandardMaterial color="#5f6b3c" />
    </mesh>)}
    <mesh position={[0, 5.0, 0]}>
      <boxGeometry args={[7.6, 1.5, 0.2]} />
      {[0, 1, 2, 3].map(i => <meshStandardMaterial key={i} attach={`material-${i}`} color="#48522c" />)}
      <meshStandardMaterial attach="material-4" map={banner} emissive="#ffffff" emissiveMap={banner} emissiveIntensity={0.25} />
      <meshStandardMaterial attach="material-5" map={banner} emissive="#ffffff" emissiveMap={banner} emissiveIntensity={0.25} />
    </mesh>
    {[-3.5, 3.5].map(x => <mesh key={`flag-${x}`} position={[x, 6.05, 0]}>
      <coneGeometry args={[0.32, 0.6, 4]} />
      <meshStandardMaterial color="#e07b39" />
    </mesh>)}
    <Html position={[0, 6.9, 0]} center distanceFactor={40} zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
      <div ref={sign} className="finish-sign"><span ref={label}>결승선까지</span></div>
    </Html>
  </group>
}
