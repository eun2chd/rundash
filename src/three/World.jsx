import { useMemo } from 'react'
import * as THREE from 'three'
import { Stars } from '@react-three/drei'
import { buildRibbon, PROP_SPOTS } from './track'

const DS = THREE.DoubleSide

export default function World({ biome }) {
  const shoulder = useMemo(() => buildRibbon(-4.4, 4.4, 600, 0.03), [])
  const road = useMemo(() => buildRibbon(-3, 3, 600, 0.06), [])
  const lineL = useMemo(() => buildRibbon(2.55, 2.75, 600, 0.09), [])
  const lineR = useMemo(() => buildRibbon(-2.75, -2.55, 600, 0.09), [])
  const dark = !!biome.dark

  return (
    <>
      <color attach="background" args={[biome.sky]} />
      <fog attach="fog" args={[biome.sky, 60, dark ? 170 : 260]} />
      <hemisphereLight args={[biome.sky, biome.ground, dark ? 0.5 : 1.0]} />
      <directionalLight position={[60, 90, 40]} intensity={dark ? 0.35 : 1.5} color={dark ? '#a9b8ff' : '#fff1dc'} />
      <ambientLight intensity={dark ? 0.25 : 0.3} />
      {dark ? <Stars radius={260} depth={60} count={2500} factor={6} fade /> : <Clouds />}

      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color={biome.ground} />
      </mesh>
      <mesh geometry={shoulder}><meshStandardMaterial color={biome.shoulder} side={DS} /></mesh>
      <mesh geometry={road}><meshStandardMaterial color={biome.road} side={DS} /></mesh>
      {[lineL, lineR].map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={biome.line} emissive={dark ? biome.line : '#000000'} emissiveIntensity={dark ? 0.8 : 0} side={DS} />
        </mesh>
      ))}

      <Props biome={biome} />
    </>
  )
}

function Clouds() {
  const clouds = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        x: Math.cos(i * 2.4) * (120 + (i % 4) * 40),
        z: Math.sin(i * 2.4) * (120 + (i % 3) * 50),
        y: 45 + (i % 5) * 6,
        s: 3 + (i % 3) * 1.5,
      })),
    []
  )
  return clouds.map((c, i) => (
    <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
      {[[0, 0, 0, 1.6], [1.7, -0.3, 0.3, 1.2], [-1.6, -0.4, -0.2, 1.1], [0.5, 0.6, 0, 1.1]].map(([x, y, z, r], j) => (
        <mesh key={j} position={[x, y, z]}>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color="#ffffff" flatShading />
        </mesh>
      ))}
    </group>
  ))
}

function Props({ biome }) {
  return PROP_SPOTS.map((p, i) => (
    <group key={i} position={[p.x, 0, p.z]} rotation-y={p.rot} scale={p.s}>
      {biome.prop === 'tree' && <Tree p={p} colors={biome.foliage} />}
      {biome.prop === 'building' && (p.off < 15 ? <Lamp /> : <Building p={p} colors={biome.palette} />)}
      {biome.prop === 'palm' && (p.v < 0.15 ? <Umbrella p={p} /> : <Palm p={p} />)}
      {biome.prop === 'neon' && (p.off < 15 ? <Lamp glow /> : <NeonBuilding p={p} colors={biome.neon} />)}
    </group>
  ))
}

function Tree({ p, colors }) {
  const c = (k) => colors[Math.floor((p.v * 7 + k * 3) % colors.length)]
  if (p.v < 0.18) {
    // 덤불
    return (
      <group>
        <mesh position={[0, 0.6, 0]}><icosahedronGeometry args={[0.9, 0]} /><meshStandardMaterial color={c(0)} flatShading /></mesh>
        <mesh position={[0.8, 0.45, 0.2]}><icosahedronGeometry args={[0.6, 0]} /><meshStandardMaterial color={c(1)} flatShading /></mesh>
      </group>
    )
  }
  const h = 2.2 + p.v2 * 1.6
  return (
    <group>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[0.18, 0.3, h, 6]} />
        <meshStandardMaterial color="#6b4a2f" flatShading />
      </mesh>
      <mesh position={[0, h + 0.8, 0]}><icosahedronGeometry args={[1.6, 0]} /><meshStandardMaterial color={c(0)} flatShading /></mesh>
      <mesh position={[0.9, h + 0.2, 0.3]}><icosahedronGeometry args={[1.05, 0]} /><meshStandardMaterial color={c(1)} flatShading /></mesh>
      <mesh position={[-0.8, h + 0.5, -0.4]}><icosahedronGeometry args={[1.15, 0]} /><meshStandardMaterial color={c(2)} flatShading /></mesh>
      <mesh position={[0.1, h + 1.9, 0.1]}><icosahedronGeometry args={[0.9, 0]} /><meshStandardMaterial color={c(3)} flatShading /></mesh>
    </group>
  )
}

function Building({ p, colors }) {
  const color = colors[Math.floor(p.v * colors.length)]
  const w = 5 + p.v2 * 3
  return (
    <group>
      <mesh position={[0, p.h / 2, 0]}>
        <boxGeometry args={[w, p.h, w]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      {/* 창문 띠 */}
      {Array.from({ length: Math.floor(p.h / 3) }, (_, i) => (
        <mesh key={i} position={[0, 2 + i * 3, 0]}>
          <boxGeometry args={[w + 0.06, 0.9, w + 0.06]} />
          <meshStandardMaterial color="#7f95a8" />
        </mesh>
      ))}
      <mesh position={[0, p.h + 0.2, 0]}>
        <boxGeometry args={[w * 0.9, 0.4, w * 0.9]} />
        <meshStandardMaterial color="#8a8f96" />
      </mesh>
    </group>
  )
}

function NeonBuilding({ p, colors }) {
  const w = 5 + p.v2 * 3
  const c1 = colors[Math.floor(p.v * colors.length)]
  const c2 = colors[Math.floor(p.v2 * colors.length)]
  return (
    <group>
      <mesh position={[0, p.h / 2, 0]}>
        <boxGeometry args={[w, p.h, w]} />
        <meshStandardMaterial color="#1e2240" />
      </mesh>
      {Array.from({ length: Math.floor(p.h / 3.5) }, (_, i) => (
        <mesh key={i} position={[0, 2 + i * 3.5, 0]}>
          <boxGeometry args={[w + 0.06, 0.35, w + 0.06]} />
          <meshStandardMaterial color={i % 2 ? c1 : c2} emissive={i % 2 ? c1 : c2} emissiveIntensity={1.2} />
        </mesh>
      ))}
    </group>
  )
}

function Lamp({ glow = false }) {
  return (
    <group>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 4, 6]} />
        <meshStandardMaterial color="#3a3f47" />
      </mesh>
      <mesh position={[0, 4.1, 0]}>
        <sphereGeometry args={[0.32, 12, 10]} />
        <meshStandardMaterial color="#fff3c4" emissive="#ffd36e" emissiveIntensity={glow ? 2 : 0.4} />
      </mesh>
    </group>
  )
}

function Palm({ p }) {
  const lean = 0.15 + p.v2 * 0.25
  return (
    <group rotation-z={lean}>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[i * 0.06, 0.55 + i * 1.05, 0]} rotation-z={-i * 0.04}>
          <cylinderGeometry args={[0.2 - i * 0.02, 0.25 - i * 0.02, 1.1, 7]} />
          <meshStandardMaterial color={i % 2 ? '#a07a4f' : '#8c6a43'} flatShading />
        </mesh>
      ))}
      <group position={[0.3, 5.6, 0]}>
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} rotation={[0, (i / 7) * Math.PI * 2, 0.55]} position={[0, 0, 0]}>
            <boxGeometry args={[0.5, 0.06, 2.8]} />
            <meshStandardMaterial color={i % 2 ? '#3f9b4a' : '#58b25a'} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function Umbrella({ p }) {
  const c = ['#ef6f6c', '#56cbf9', '#f7d154'][Math.floor(p.v2 * 3)]
  return (
    <group>
      <mesh position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2.6, 6]} />
        <meshStandardMaterial color="#eeeeee" />
      </mesh>
      <mesh position={[0, 2.6, 0]}>
        <coneGeometry args={[1.8, 0.7, 8]} />
        <meshStandardMaterial color={c} flatShading />
      </mesh>
    </group>
  )
}
