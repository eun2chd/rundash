export const DEFAULT_SETTINGS = {
  xpBase: 100, xpStep: 20, xpPerKm: 100, completionBonus: .2,
  anonymousMaxKm: 10, maxDistanceKm: 100,
  anonymousPace: 540, anonymousStamina: 100, anonymousRecovery: 60,
  boostCooldown: 90, boostCost: 12, boostMultiplier: 1.5,
  staminaDrain: 30, staminaBasePace: 360, recoverRatio: .4,
  stationFirstM: 600, stationEveryM: 1000, stationGrabBeforeM: 40, stationGrabAfterM: 8,
  waterRestore: 15, gelRestore: 25, supplyPoints: 5, medalPoints: 50,
  rhythmPerfect: .09, rhythmGood: .2, perfectPoints: 5, goodPoints: 2,
  comboCap: 10, comboBonus: .1, cheerPoints: 15,
  cheerRadius: 18, medalFirstM: 200, medalIntervalMin: 250, medalIntervalJitter: 250,
  chatMaxLength: 300, chatInterval: 2,
  intensities: [
    { id: 'easy', label: '가볍게', description: '오래, 편안하게', extraPace: 150, drain: .75 },
    { id: 'steady', label: '꾸준히', description: '균형 잡힌 기본 훈련', extraPace: 60, drain: 1 },
    { id: 'challenge', label: '도전하기', description: '가장 빠르게, 보급은 필수', extraPace: 0, drain: 1.35 },
  ],
  levels: Array.from({ length: 50 }, (_, i) => {
    const level = i + 1
    return { level, pace: level <= 5 ? 540 - i * 15 : level <= 10 ? 480 - (level - 5) * 12 : level <= 30 ? 420 - (level - 10) * 6 : 300,
      stamina: 100 + i * 3, recovery: Math.max(30, 60 - i), boost: level < 5 ? 0 : level >= 30 ? 15 : level >= 20 ? 12 : 8 }
  }),
}
let current = structuredClone(DEFAULT_SETTINGS)
export const getSettings = () => current
export function configureSettings(value) {
  const next = structuredClone(value || DEFAULT_SETTINGS)
  current.intensities.splice(0, 3, ...next.intensities)
  current.levels.splice(0, 50, ...next.levels)
  const { intensities, levels, ...scalars } = next
  Object.assign(current, scalars)
}

// Bounds are also enforced by the server. These fields are editable by administrators.
export const SETTING_FIELDS = [
  ['경험치', 'xpBase', '첫 레벨업 필요 XP', 1, 100000, 1], ['경험치', 'xpStep', '레벨별 필요 XP 증가 계수', 0, 10000, 1],
  ['경험치', 'xpPerKm', '1km당 경험치', 0, 10000, 1], ['경험치', 'completionBonus', '완주 보너스 비율', 0, 5, .05],
  ['러닝', 'maxDistanceKm', '회원 최대 거리 km', .5, 100, .5], ['러닝', 'anonymousMaxKm', '익명 최대 거리 km', .5, 10, .5],
  ['익명 러너', 'anonymousPace', '기본 최대 페이스 초/km', 180, 1800, 1], ['익명 러너', 'anonymousStamina', '기본 체력', 10, 1000, 1], ['익명 러너', 'anonymousRecovery', '회복 시간 초', 5, 300, 1],
  ['부스터', 'boostCooldown', '재충전 초', 1, 600, 1], ['부스터', 'boostCost', '소모 체력', 1, 100, 1], ['부스터', 'boostMultiplier', '속도 배율', 1, 3, .1],
  ['체력', 'staminaDrain', '기본 1km 소모 체력', 1, 200, 1], ['체력', 'staminaBasePace', '소모 기준 페이스 초/km', 180, 1800, 1], ['체력', 'recoverRatio', '탈진 후 체력 회복 비율', .1, 1, .05],
  ['보급소', 'stationFirstM', '첫 보급소 m', 100, 5000, 10], ['보급소', 'stationEveryM', '보급소 간격 m', 100, 10000, 10], ['보급소', 'stationGrabBeforeM', '보급 가능 전방 m', 5, 100, 1], ['보급소', 'stationGrabAfterM', '보급 가능 후방 m', 1, 50, 1],
  ['보급소', 'waterRestore', '물 회복량', 1, 200, 1], ['보급소', 'gelRestore', '젤 회복량', 1, 200, 1], ['점수', 'supplyPoints', '보급품 점수', 0, 1000, 1], ['점수', 'medalPoints', '메달 점수', 0, 1000, 1],
  ['리듬', 'rhythmPerfect', 'PERFECT 판정 초', .01, .2, .01], ['리듬', 'rhythmGood', 'GOOD 판정 초', .02, .4, .01], ['리듬', 'perfectPoints', 'PERFECT 점수', 1, 100, 1], ['리듬', 'goodPoints', 'GOOD 점수', 1, 100, 1],
  ['리듬', 'comboCap', '최대 보너스 콤보', 1, 50, 1], ['리듬', 'comboBonus', '콤보당 점수 비율', 0, 1, .05], ['점수', 'cheerPoints', '응원 점수', 0, 1000, 1],
  ['점수', 'cheerRadius', '응원 가능 거리 m', 5, 100, 1],
  ['코스', 'medalFirstM', '첫 메달 거리 m', 50, 5000, 10], ['코스', 'medalIntervalMin', '메달 최소 간격 m', 50, 5000, 10], ['코스', 'medalIntervalJitter', '메달 추가 무작위 간격 m', 0, 5000, 10],
  ['채팅', 'chatMaxLength', '메시지 최대 글자 수', 10, 300, 1], ['채팅', 'chatInterval', '메시지 전송 간격 초', 1, 60, 1],
]
