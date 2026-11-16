import { getSettings, MAX_LEVEL } from './settings.js'
import { customDrain } from './pacePlans.js'
export const INTENSITIES = getSettings().intensities
export const MILESTONES = [
  { level: 5, title: '부스터 해금', description: '8초 동안 속도 50% 증가' },
  { level: 10, title: '빠른 회복', description: '최대 페이스 7분/km · 회복력 향상' },
  { level: 20, title: '롱 부스터', description: '부스터 12초 · 최대 페이스 6분/km' },
  { level: 30, title: '마스터 러너', description: '부스터 15초 · 최대 페이스 5분/km' },
  { level: 60, title: '부스터 강화', description: '부스터 18초' },
  { level: 80, title: 'AUTO 러닝', description: '보급·메달·리듬 러닝 자동 수행 · 부스터 20초' },
  { level: 100, title: '성장 완료', description: '최대 체력 397 달성' },
]
export { MAX_LEVEL }
// Cumulative XP needed to reach a level, read from the level table in settings.
export const xpForLevel = (level, rules = getSettings()) => {
  const index = Math.max(1, Math.min(rules.levels.length, level)) - 1
  return Number(rules.levels[index]?.xp) || 0
}
export const autoUnlocked = (level, rules = getSettings()) => Number(level) >= (Number(rules.autoLevel) || MAX_LEVEL + 1)
export function progressionFor(xp = 0) {
  xp = Math.max(0, Math.floor(Number(xp) || 0))
  let level = 1
  const rules = getSettings(), top = rules.levels.length
  while (level < top && xp >= xpForLevel(level + 1)) level++
  const inLevel = xp - xpForLevel(level)
  const needed = level === top ? 0 : xpForLevel(level + 1) - xpForLevel(level)
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
    autoUnlocked: autoUnlocked(level, rules),
    nextUnlock: next ? { level: next.level, title: row.boost ? '부스터 강화' : '부스터 해금', description: `${next.boost}초 가속 · 체력 ${next.stamina}` } : null,
  }
}
export function trainingFor(xp, intensity = 'steady', anonymous = false, customPace = null) {
  const rules = getSettings()
  const growth = anonymous ? { level: null, maxStamina: rules.anonymousStamina, recoverySec: rules.anonymousRecovery, fastestPace: rules.anonymousPace, boosterUnlocked: false } : progressionFor(xp)
  if (intensity === 'custom' && !anonymous && customPace) {
    const paceSec = Math.max(growth.fastestPace, customPace)
    return { ...growth, intensity: 'custom', intensityLabel: '내 페이스', paceSec, drainMultiplier: customDrain(paceSec, growth.fastestPace) }
  }
  const effort = INTENSITIES.find((item) => item.id === intensity) || INTENSITIES[1]
  return { ...growth, intensity: effort.id, intensityLabel: effort.label, paceSec: growth.fastestPace + effort.extraPace, drainMultiplier: effort.drain }
}
// XP range for a distance. The server rolls a random XP per km between xpPerKmMin and xpPerKmMax,
// so the client can only show the range (and its midpoint) before the run is saved. The score
// bonus is added on top by the server and is not part of this estimate.
export function experienceFor({ distanceKm, completed, practice = false, anonymous = false }, rules = getSettings()) {
  if (practice || anonymous) return { min: 0, max: 0, total: 0 }
  const km = Math.max(0, Number(distanceKm) || 0), bonus = completed ? 1 + (Number(rules.completionBonus) || 0) : 1
  const low = Number(rules.xpPerKmMin) || 0, high = Math.max(low, Number(rules.xpPerKmMax) || 0)
  const min = Math.floor(km * low * bonus), max = Math.floor(km * high * bonus)
  return { min, max, total: Math.floor(km * (low + high) / 2 * bonus) }
}
export const xpRangeText = ({ min, max }) => min === max ? `${min.toLocaleString()}` : `${min.toLocaleString()}~${max.toLocaleString()}`

// Level thresholds for a rules object (live settings or an unsaved admin draft): cumulative XP
// to reach each level, XP needed from the previous level, and roughly how many completed km
// that takes at the average per-km XP plus the completion bonus (score bonus not included).
export function levelXpTable(rules = getSettings()) {
  const average = ((Number(rules.xpPerKmMin) || 0) + (Number(rules.xpPerKmMax) || 0)) / 2
  const perKm = average * (1 + (Number(rules.completionBonus) || 0))
  let previous = 0
  return rules.levels.map((level, index) => {
    const xp = Number(level.xp) || 0
    const row = { level: index + 1, xp, gap: xp - previous, km: perKm > 0 ? xp / perKm : null }
    previous = xp
    return row
  })
}
