import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import Runner from '../three/Runner'

const easeOutBack = (x) => {
  const c1 = 1.70158, c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

function PreviewFraming({ activity }) {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height)
    const tangent = Math.tan(camera.fov * Math.PI / 360)
    const height = activity ? 3.5 : 3.05
    const distance = Math.max(height / (2 * tangent), (activity ? 2.3 : 1.8) / (2 * tangent * aspect))
    const center = activity ? 1.4 : 1.25
    const horizontal = activity ? .2 : 0
    camera.position.set(horizontal, center + .15, distance)
    camera.lookAt(horizontal, center, 0)
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height, activity])
  return null
}

function Turntable({ popKey, children }) {
  const g = useRef()
  const t0 = useRef(0)
  useEffect(() => { if (popKey) t0.current = performance.now() }, [popKey])
  useFrame((_, dt) => {
    g.current.rotation.y += dt * 0.5
    if (popKey) {
      const k = Math.min(1, (performance.now() - t0.current) / 700)
      g.current.scale.setScalar(0.2 + 0.8 * easeOutBack(k))
    }
  })
  return <group ref={g}>{children}</group>
}

function Burst({ popKey, color }) {
  const m = useRef()
  const t0 = useRef(0)
  useEffect(() => { if (popKey) t0.current = performance.now() }, [popKey])
  useFrame(() => {
    const k = popKey ? (performance.now() - t0.current) / 900 : 1
    const v = Math.min(1, k)
    m.current.scale.setScalar(0.5 + v * 2.5)
    m.current.material.opacity = (1 - v) * 0.8
  })
  return (
    <mesh ref={m} rotation-x={-Math.PI / 2} position-y={0.05}>
      <ringGeometry args={[0.6, 0.72, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

export default function CharacterPreview({ color, skin, hair, outfit, nickname, activity, revealed = true, popKey = 0, running = true, bg = '#2a2b24' }) {
  const getDistance = () => (running ? (performance.now() / 1000) * 1.6 : 0)
  return (
    <Canvas
      camera={{ position: [0, 1.5, 4.4], fov: 36 }}
      dpr={[1, 2]}
      onCreated={({ camera }) => camera.lookAt(0, 1.05, 0)}
    >
      <color attach="background" args={[bg]} />
      <PreviewFraming activity={activity} />
      <hemisphereLight args={['#fff4e0', '#4a4a3a', 1.1]} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <pointLight position={[-2.5, 2, -1.5]} color={color} intensity={6} distance={7} />
      <Turntable popKey={popKey}>
        <Runner
          inPlace
          getDistance={getDistance}
          color={color}
          skin={skin}
          hair={hair}
          outfit={outfit}
          activity={activity}
          hologram={!revealed}
          nickname={revealed ? nickname : null}
          isMe
        />
      </Turntable>
      <Burst popKey={popKey} color={color} />
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.3, 48]} />
        <meshStandardMaterial color="#3a3b32" />
      </mesh>
    </Canvas>
  )
}
