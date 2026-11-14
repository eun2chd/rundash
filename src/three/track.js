import * as THREE from 'three'

// ─── 러닝 코스(닫힌 루프) ─── 1 unit = 1m
const N = 14
const pts = []
for (let i = 0; i < N; i++) {
  const a = (i / N) * Math.PI * 2
  const r = 78 + 18 * Math.sin(a * 3) + 8 * Math.cos(a * 2)
  pts.push(new THREE.Vector3(Math.cos(a) * r * 1.25, 0, Math.sin(a) * r))
}
export const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal')
export const TRACK_LENGTH = curve.getLength()

const wrapU = (dist) => (((dist % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH) / TRACK_LENGTH

// 거리(dist) → 위치/진행방향. lane: 진행방향 기준 좌우 오프셋(m)
export function poseAt(dist, lane = 0, out = { pos: new THREE.Vector3(), tan: new THREE.Vector3() }) {
  const u = wrapU(dist)
  curve.getPointAt(u, out.pos)
  curve.getTangentAt(u, out.tan)
  out.pos.x += -out.tan.z * lane
  out.pos.z += out.tan.x * lane
  return out
}

// 루프 위 두 거리 사이의 최단 차이 (-L/2 ~ L/2)
export function loopGap(a, b) {
  let g = (((a - b) % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH
  if (g > TRACK_LENGTH / 2) g -= TRACK_LENGTH
  return g
}

// 코스 중심선 기준 [a, b] 오프셋 띠 지오메트리 (도로, 차선 등)
export function buildRibbon(a, b, seg = 600, y = 0) {
  const pos = []
  const idx = []
  const p = new THREE.Vector3()
  const t = new THREE.Vector3()
  for (let i = 0; i <= seg; i++) {
    const u = (i % seg) / seg
    curve.getPointAt(u, p)
    curve.getTangentAt(u, t)
    const nx = -t.z
    const nz = t.x
    pos.push(p.x + nx * a, y, p.z + nz * a, p.x + nx * b, y, p.z + nz * b)
    if (i < seg) {
      const k = i * 2
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

// 코스 주변 소품 배치 위치 (고정 시드)
const SAMPLES = Array.from({ length: 300 }, (_, i) => curve.getPointAt(i / 300))
const distToTrack = (x, z) => {
  let m = Infinity
  for (const s of SAMPLES) m = Math.min(m, Math.hypot(s.x - x, s.z - z))
  return m
}

export const PROP_SPOTS = (() => {
  const r = rng(42)
  const out = []
  const p = new THREE.Vector3()
  const t = new THREE.Vector3()
  const COUNT = 150
  for (let i = 0; i < COUNT; i++) {
    const u = ((i + r() * 0.7) / COUNT) % 1
    curve.getPointAt(u, p)
    curve.getTangentAt(u, t)
    const side = r() < 0.5 ? -1 : 1
    const off = 8 + Math.pow(r(), 1.4) * 45
    const x = p.x - t.z * side * off
    const z = p.z + t.x * side * off
    const d = distToTrack(x, z)
    if (d < 7) continue
    out.push({ x, z, off: d, s: 0.8 + r() * 0.7, rot: r() * Math.PI * 2, h: 6 + r() * 22, v: r(), v2: r() })
  }
  return out
})()

// 미니맵용 SVG path
export const MINIMAP = (() => {
  const xs = SAMPLES.map((s) => s.x)
  const zs = SAMPLES.map((s) => s.z)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minZ = Math.min(...zs), maxZ = Math.max(...zs)
  const pad = 8
  const w = maxX - minX + pad * 2
  const h = maxZ - minZ + pad * 2
  const project = (x, z) => [x - minX + pad, z - minZ + pad]
  const d = SAMPLES.map((s, i) => {
    const [x, y] = project(s.x, s.z)
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ') + ' Z'
  return { d, w, h, project }
})()
