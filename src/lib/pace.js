// 페이스/시간 계산 유틸
export const toPaceSec = (min, sec) => min * 60 + sec
export const speedMps = (paceSec) => 1000 / paceSec // m/s
export const speedKmh = (paceSec) => 3600 / paceSec
export const totalRunSec = (paceSec, km) => Math.round(paceSec * km)

// 페이스 기반 대략적인 케이던스(분당 걸음수)
export const cadenceFor = (paceSec) =>
  Math.round(Math.min(185, Math.max(150, 200 - paceSec / 12)))

const pad = (n) => String(n).padStart(2, '0')

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export function fmtPace(paceSec) {
  const rounded = Math.max(0, Math.round(paceSec))
  const m = Math.floor(rounded / 60)
  const s = rounded % 60
  return `${m}'${pad(s)}"`
}

export function fmtKm(km) {
  return Number.isInteger(km) ? `${km}` : km.toFixed(km < 10 ? 2 : 1)
}
