// ─── 체력 시스템 ───
// 달린 거리만큼 체력이 줄고, 체력이 낮을수록 느려짐.
// 0 이 되면 탈진 → 무릎 꿇고 recoverySec 동안 회복해야 다시 달릴 수 있음.
export const STAMINA = {
  max: 100,
  drainPerKmBase: 30, // 6'00"/km 기준 1km 당 소모량
  basePace: 360,
  recoverySec: 60, // 탈진 시 필요한 회복 시간(러닝 시간 기준 초)
  recoverTo: 40, // 회복 후 체력
  stationEveryM: 1000, // 보급소 간격
  stationFirstM: 600,
  stationGrabBeforeM: 40, // 보급소 앞 몇 m 부터 챙길 수 있나
  stationGrabAfterM: 8, // 지나친 뒤 몇 m 까지 (이후엔 끝)
}

export const drainPerKm = (paceSec) => STAMINA.drainPerKmBase * Math.pow(STAMINA.basePace / paceSec, 1.2)

// 체력 → 속도 배율
export function speedMultFor(st) {
  if (st >= 60) return 1
  if (st >= 25) return 0.75 + ((st - 25) / 35) * 0.25
  return 0.5 + (st / 25) * 0.25
}

// 체력 → 지친 정도(애니메이션용 0~1)
export const tiredFor = (st) => (st >= 60 ? 0 : Math.min(1, (60 - st) / 60))

export function staminaState(st, resting) {
  if (resting) return { label: '탈진 · 회복 중', tone: 'bad' }
  if (st >= 60) return { label: '좋음', tone: 'good' }
  if (st >= 25) return { label: '지침', tone: 'warn' }
  return { label: '한계', tone: 'bad' }
}
