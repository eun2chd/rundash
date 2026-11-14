import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { poseAt } from './track'

// One draw call for the whole local rain/snow volume, regardless of particle count.
export default function WeatherEffects({ weather, getDistance }) {
  const group = useRef()
  const rain = weather.precipitation === 'rain'
  const count = weather.intensity === 'heavy' ? (rain ? 500 : 320) : (rain ? 180 : 120)
  const scratch = useMemo(() => ({ pos: new THREE.Vector3(), tan: new THREE.Vector3() }), [])
  const reducedMotion = useRef(false)
  const { geometry, coordinates } = useMemo(() => {
    const coordinates = new Float32Array(count * (rain ? 6 : 3))
    for (let i=0;i<count;i++) {
      const offset = i * (rain ? 6 : 3)
      coordinates[offset] = Math.random()*32-16
      coordinates[offset+1] = Math.random()*18
      coordinates[offset+2] = Math.random()*32-16
      if (rain) { coordinates[offset+3]=coordinates[offset]-.14; coordinates[offset+4]=coordinates[offset+1]+.9; coordinates[offset+5]=coordinates[offset+2] }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(coordinates,3).setUsage(THREE.DynamicDrawUsage))
    return { geometry, coordinates }
  }, [count,rain])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => { reducedMotion.current = media.matches }
    sync(); media.addEventListener('change',sync)
    return () => media.removeEventListener('change',sync)
  }, [])
  useFrame((_,delta) => {
    poseAt(getDistance(),0,scratch)
    group.current.position.set(scratch.pos.x,0,scratch.pos.z)
    if (reducedMotion.current) return
    const dt = Math.min(delta,.05)
    for (let i=0;i<count;i++) {
      const offset = i*(rain ? 6 : 3)
      coordinates[offset+1] -= dt*(rain ? 17 : 2.2)
      if (coordinates[offset+1]<0) coordinates[offset+1]=18
      if (rain) { coordinates[offset+3]=coordinates[offset]-.14; coordinates[offset+4]=coordinates[offset+1]+.9; coordinates[offset+5]=coordinates[offset+2] }
    }
    geometry.attributes.position.needsUpdate=true
  })
  return <group ref={group}>{rain ? <lineSegments geometry={geometry} frustumCulled={false}><lineBasicMaterial color="#c4dfed" transparent opacity={weather.intensity==='heavy'?.65:.45} depthWrite={false} /></lineSegments> : <points geometry={geometry} frustumCulled={false}><pointsMaterial color="#fff" size={.15} transparent opacity={.85} depthWrite={false} sizeAttenuation /></points>}</group>
}
