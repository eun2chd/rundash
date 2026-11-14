import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { poseAt } from './track'

const tmp = { pos: new THREE.Vector3(), tan: new THREE.Vector3() }

// 캐릭터 뒤에서 따라가는 3인칭 카메라 (방향만 부드럽게 보간 → 배속이 커도 뒤처지지 않음)
export default function CameraRig({ getDistance, zoom = 1 }) {
  const st = useRef({ tan: null, look: new THREE.Vector3() })
  useFrame(({ camera }, dt) => {
    poseAt(getDistance(), 0, tmp)
    const s = st.current
    if (!s.tan) s.tan = tmp.tan.clone()
    else s.tan.lerp(tmp.tan, 1 - Math.exp(-dt * 3)).normalize()
    const back = 7.5 * zoom
    camera.position.set(tmp.pos.x - s.tan.x * back, 3.2 * zoom + 0.4, tmp.pos.z - s.tan.z * back)
    s.look.set(tmp.pos.x + s.tan.x * 6, 1.4, tmp.pos.z + s.tan.z * 6)
    camera.lookAt(s.look)
  })
  return null
}
