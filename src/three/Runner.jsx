import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { poseAt } from './track'
import { CHEER_ICONS } from '../lib/icons'

const tmp = { pos: new THREE.Vector3(), tan: new THREE.Vector3() }
const camPos = new THREE.Vector3()

/**
 * 치비 스타일 러너 캐릭터 (프리미티브 조합)
 * getDistance(): 코스 위 누적 거리(m) — 이 값으로 위치와 팔다리 스윙이 결정됨
 */
export default function Runner({
  getDistance,
  lane = 0,
  color = '#f08a5d',
  skin = '#f6d1b0',
  hair = null,
  nickname,
  isMe = false,
  inPlace = false,
  hologram = false,
  cheer,
  cheerKey,
  getAction, // () => ({ kneel: bool, tired: 0~1 })
}) {
  const root = useRef()
  const bob = useRef()
  const lArm = useRef()
  const rArm = useRef()
  const lLeg = useRef()
  const rLeg = useRef()
  const tag = useRef()
  const head = useRef()
  const kneelT = useRef(0)

  useFrame(({ camera }, dt) => {
    const d = getDistance()
    if (!inPlace) {
      poseAt(d, lane, tmp)
      root.current.position.set(tmp.pos.x, 0, tmp.pos.z)
      root.current.rotation.y = Math.atan2(tmp.tan.x, tmp.tan.z)
    }
    const act = getAction ? getAction() : null
    const tired = act?.tired || 0
    kneelT.current += ((act?.kneel ? 1 : 0) - kneelT.current) * (1 - Math.exp(-dt * 6))
    const k = kneelT.current
    const mix = (a, b) => a + (b - a) * k
    const breathe = Math.sin(performance.now() / 260) * 0.03 * (k + tired)

    const ph = (d / 1.0) * Math.PI
    const s = Math.sin(ph)
    const legAmp = 0.9 * (1 - tired * 0.35)
    const armAmp = 1.0 * (1 - tired * 0.45)
    // 달리기 ↔ 무릎 꿇기 블렌딩
    lLeg.current.rotation.x = mix(s * legAmp, -1.1)
    rLeg.current.rotation.x = mix(-s * legAmp, 1.2)
    lArm.current.rotation.x = mix(-s * armAmp + tired * 0.3, -0.95)
    rArm.current.rotation.x = mix(s * armAmp + tired * 0.3, -0.45)
    bob.current.position.y = mix(Math.abs(Math.cos(ph)) * 0.08 * (1 - tired * 0.5), -0.3 + breathe)
    bob.current.rotation.x = mix(0.1 + tired * 0.18, 0.28)
    head.current.rotation.x = mix(tired * 0.2 + breathe, 0.4 + breathe)

    // 멀리 있는 러너의 닉네임은 흐리게
    if (tag.current) {
      root.current.getWorldPosition(camPos)
      const dist = camPos.distanceTo(camera.position)
      tag.current.style.opacity = dist > 60 ? 0 : dist > 35 ? 0.5 : 1
    }
  })

  const CheerIcon = cheer ? CHEER_ICONS[cheer] : null
  const holo = color
  const M = (c, extra = {}) =>
    hologram ? (
      <meshStandardMaterial color={holo} emissive={holo} emissiveIntensity={0.7} transparent opacity={0.32} depthWrite={false} />
    ) : (
      <meshStandardMaterial color={c} roughness={0.75} {...extra} />
    )

  return (
    <group ref={root}>
      {/* 바닥 그림자 / 내 캐릭터 표시 링 */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.1}>
        <circleGeometry args={[0.45, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      {isMe && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.11}>
          <ringGeometry args={[0.55, 0.65, 32]} />
          <meshBasicMaterial color="#fff6d5" transparent opacity={0.9} depthWrite={false} />
        </mesh>
      )}

      <group ref={bob}>
        {/* 다리 */}
        {[[-0.13, lLeg], [0.13, rLeg]].map(([x, ref], i) => (
          <group key={i} ref={ref} position={[x, 0.55, 0]}>
            <mesh position-y={-0.22}>
              <capsuleGeometry args={[0.1, 0.24, 4, 10]} />
              {M('#e4e7ea')}
            </mesh>
            <mesh position={[0, -0.47, 0.05]} scale={[1, 0.6, 1.4]}>
              <sphereGeometry args={[0.11, 12, 10]} />
              {M('#3d3a36')}
            </mesh>
          </group>
        ))}

        {/* 몸통 */}
        <mesh position-y={0.86}>
          <capsuleGeometry args={[0.28, 0.28, 6, 16]} />
          {M(color)}
        </mesh>
        <mesh position-y={0.62}>
          <torusGeometry args={[0.27, 0.035, 8, 24]} />
          {M('#3d3a36')}
        </mesh>

        {/* 팔 */}
        {[[-0.34, lArm], [0.34, rArm]].map(([x, ref], i) => (
          <group key={i} ref={ref} position={[x, 1.06, 0]}>
            <mesh position-y={-0.18} rotation-z={x < 0 ? -0.12 : 0.12}>
              <capsuleGeometry args={[0.085, 0.26, 4, 10]} />
              {M(color)}
            </mesh>
            <mesh position={[x < 0 ? -0.04 : 0.04, -0.4, 0]}>
              <sphereGeometry args={[0.09, 12, 10]} />
              {M(skin)}
            </mesh>
          </group>
        ))}

        {/* 머리 */}
        <group ref={head} position-y={1.6}>
          <mesh>
            <sphereGeometry args={[0.42, 28, 22]} />
            {M(skin)}
          </mesh>
          {hair && !hologram && (
            <mesh position-y={0.03} rotation-x={-0.25}>
              <sphereGeometry args={[0.435, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
              <meshStandardMaterial color={hair} roughness={0.9} />
            </mesh>
          )}
          {/* 헤어밴드 */}
          <mesh position-y={0.17} rotation-x={Math.PI / 2 - 0.25}>
            <torusGeometry args={[0.39, 0.045, 8, 32]} />
            {M(color)}
          </mesh>
          {!hologram && (
            <>
              {[-0.14, 0.14].map((x) => (
                <mesh key={x} position={[x, 0.0, 0.39]}>
                  <sphereGeometry args={[0.045, 10, 8]} />
                  <meshBasicMaterial color="#2a2622" />
                </mesh>
              ))}
              {[-0.25, 0.25].map((x) => (
                <mesh key={x} position={[x, -0.1, 0.33]} scale={[1, 0.6, 0.5]}>
                  <sphereGeometry args={[0.06, 10, 8]} />
                  <meshBasicMaterial color="#f2a39a" transparent opacity={0.7} />
                </mesh>
              ))}
            </>
          )}
        </group>
      </group>

      {(nickname || CheerIcon) && (
        <Html position={[0, 2.35, 0]} center distanceFactor={9} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div ref={tag} className="tag-wrap">
            {CheerIcon && (
              <div key={cheerKey} className="cheer-pop">
                <CheerIcon />
              </div>
            )}
            {nickname && (
              <div className={`nametag ${isMe ? 'me' : ''}`}>
                <span className="dot" style={{ background: color }} />
                {nickname}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}
