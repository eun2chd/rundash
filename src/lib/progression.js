export const INTENSITIES = [
  { id: 'easy', label: '가볍게', description: '오래, 편안하게', extraPace: 150, drain: .75 },
  { id: 'steady', label: '꾸준히', description: '균형 잡힌 기본 훈련', extraPace: 60, drain: 1 },
  { id: 'challenge', label: '도전하기', description: '가장 빠르게, 보급은 필수', extraPace: 0, drain: 1.35 },
]
export const MILESTONES = [
  { level: 5, title: '부스터 해금', description: '8초 동안 속도 50% 증가' },
  { level: 10, title: '빠른 회복', description: '최대 페이스 7분/km · 회복력 향상' },
  { level: 20, title: '롱 부스터', description: '부스터 12초 · 최대 페이스 6분/km' },
  { level: 30, title: '마스터 러너', description: '부스터 15초 · 최대 페이스 5분/km' },
  { level: 50, title: '성장 완료', description: '최대 체력 247 달성' },
]
export const MAX_LEVEL = 50
export const xpForLevel = (level) => {
  const n = Math.max(0, Math.min(MAX_LEVEL, level) - 1)
  return 100 * n + 20 * n * (n - 1)
}
export function progressionFor(xp = 0) {
  xp = Math.max(0, Math.floor(Number(xp) || 0))
  let level = 1
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++
  const inLevel = xp - xpForLevel(level)
  const needed = level === MAX_LEVEL ? 0 : xpForLevel(level + 1) - xpForLevel(level)
  const fastest = level <= 5 ? 540 - (level - 1) * 15
    : level <= 10 ? 480 - (level - 5) * 12
      : level <= 30 ? 420 - (level - 10) * 6 : 300
  return {
    xp, level, inLevel, needed, remaining: Math.max(0, needed - inLevel),
    progress: needed ? Math.min(1, inLevel / needed) : 1,
    fastestPace: fastest, maxStamina: 100 + (level - 1) * 3,
    recoverySec: Math.max(30, 60 - (level - 1)),
    boosterUnlocked: level >= 5,
    boosterDuration: level >= 30 ? 15 : level >= 20 ? 12 : 8,
    boosterCooldown: 90, boosterCost: 12,
    nextUnlock: MILESTONES.find((milestone) => milestone.level > level) || null,
  }
}
export function trainingFor(xp, intensity = 'steady') {
  const growth = progressionFor(xp)
  const effort = INTENSITIES.find((item) => item.id === intensity) || INTENSITIES[1]
  return { ...growth, intensity: effort.id, intensityLabel: effort.label, paceSec: growth.fastestPace + effort.extraPace, drainMultiplier: effort.drain }
}
export function experienceFor({ distanceKm, completed, practice = false, anonymous = false }) {
  if (practice || anonymous) return { distance: 0, completion: 0, total: 0 }
  const distance = Math.floor(Math.max(0, Number(distanceKm) || 0) * 100)
  const completion = completed ? Math.floor(distance * .2) : 0
  return { distance, completion, total: distance + completion }
}
