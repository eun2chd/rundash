import { getSettings } from './settings.js'
export const INTENSITIES = getSettings().intensities
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
  return getSettings().xpBase * n + getSettings().xpStep * n * (n - 1)
}
export function progressionFor(xp = 0) {
  xp = Math.max(0, Math.floor(Number(xp) || 0))
  let level = 1
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++
  const inLevel = xp - xpForLevel(level)
  const needed = level === MAX_LEVEL ? 0 : xpForLevel(level + 1) - xpForLevel(level)
  const rules = getSettings()
  const row = rules.levels[level - 1]
  const next = rules.levels.find(item => item.level > level && (item.boost > row.boost || (!row.boost && item.boost)))
  return {
    xp, level, inLevel, needed, remaining: Math.max(0, needed - inLevel),
    progress: needed ? Math.min(1, inLevel / needed) : 1,
    fastestPace: row.pace, maxStamina: row.stamina,
    recoverySec: row.recovery,
    boosterUnlocked: row.boost > 0,
    boosterDuration: row.boost,
    boosterCooldown: rules.boostCooldown, boosterCost: rules.boostCost,
    nextUnlock: next ? { level: next.level, title: row.boost ? '부스터 강화' : '부스터 해금', description: `${next.boost}초 가속 · 체력 ${next.stamina}` } : null,
  }
}
export function trainingFor(xp, intensity = 'steady', anonymous = false) {
  const rules = getSettings()
  const growth = anonymous ? { level: null, maxStamina: rules.anonymousStamina, recoverySec: rules.anonymousRecovery, fastestPace: rules.anonymousPace, boosterUnlocked: false } : progressionFor(xp)
  const effort = INTENSITIES.find((item) => item.id === intensity) || INTENSITIES[1]
  return { ...growth, intensity: effort.id, intensityLabel: effort.label, paceSec: growth.fastestPace + effort.extraPace, drainMultiplier: effort.drain }
}
export function experienceFor({ distanceKm, completed, practice = false, anonymous = false }) {
  if (practice || anonymous) return { distance: 0, completion: 0, total: 0 }
  const distance = Math.floor(Math.max(0, Number(distanceKm) || 0) * getSettings().xpPerKm)
  const completion = completed ? Math.floor(distance * getSettings().completionBonus) : 0
  return { distance, completion, total: distance + completion }
}
