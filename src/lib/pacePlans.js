import { getSettings } from './settings.js'

// Mirrors public.custom_pace_rules() and valid_custom_pace() in 202611140017_custom_pace.sql.
export const PACE_PRESETS = [720, 660, 600, 540, 510, 480, 450, 420, 390, 360, 330, 300]
export const FREE_PACE_LEVEL = 20
export const SLOWEST_PACE = 900
export const PACE_STEP = 5

export const fastestPaceAt = (level, rules = getSettings()) => rules.levels[Math.max(1, Math.min(rules.levels.length, level)) - 1].pace

// First level whose fastest pace reaches this pace; null if no level does.
export function unlockLevelFor(pace, rules = getSettings()) {
  return rules.levels.find(row => row.pace <= pace)?.level ?? null
}

export function validCustomPace(pace, level, rules = getSettings()) {
  return Number.isInteger(pace) && pace >= fastestPaceAt(level, rules) && pace <= SLOWEST_PACE && pace % PACE_STEP === 0
    && (level >= FREE_PACE_LEVEL || PACE_PRESETS.includes(pace))
}

// Stamina drain for a custom pace, interpolated between the intensities by how far the
// pace sits above the level's fastest pace (the challenge pace drains the most).
export function customDrain(pace, fastest, intensities = getSettings().intensities) {
  const points = [...intensities].sort((a, b) => a.extraPace - b.extraPace)
  const extra = pace - fastest
  if (extra <= points[0].extraPace) return points[0].drain
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]]
    if (extra <= b.extraPace) return a.drain + (b.drain - a.drain) * (extra - a.extraPace) / (b.extraPace - a.extraPace)
  }
  return points.at(-1).drain
}

export function effortLabel(drain) {
  return drain >= 1.2 ? '힘들게' : drain >= .9 ? '보통' : '편안하게'
}

export function clampPace(pace, level, rules = getSettings()) {
  const stepped = Math.round(pace / PACE_STEP) * PACE_STEP
  return Math.min(SLOWEST_PACE, Math.max(fastestPaceAt(level, rules), stepped))
}
