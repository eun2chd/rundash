import { speedMultFor } from './stamina.js'
import { getSettings } from './settings.js'

export function activateBooster(s) {
  if (!s.boosterUnlocked || s.paused || s.finished || s.resting || s.boostCooldownLeft > 0 || s.stamina <= s.boosterCost) return false
  s.stamina -= s.boosterCost
  s.boostLeft = s.boosterDuration
  s.boostCooldownLeft = s.boosterDuration + s.boosterCooldown
  s.boostUses++
  return true
}

export function advanceSimulation(s, dt) {
  if (s.paused || s.finished) return
  const step = Math.min(Math.max(0, dt), .1) * s.timeScale
  s.elapsed += step
  const boostSeconds = Math.min(s.boostLeft, step)
  s.boostLeft = Math.max(0, s.boostLeft - step)
  s.boostCooldownLeft = Math.max(0, s.boostCooldownLeft - step)
  if (s.resting) {
    s.boostLeft = 0
    s.restLeft = Math.max(0, s.restLeft - step)
    s.restSec += step
    s.speedMult = 0
    s.stamina = s.recoverTo * (1 - s.restLeft / s.recoverySec)
    if (s.restLeft <= 0) { s.resting = false; s.stamina = s.recoverTo }
    return
  }
  const multiplier = speedMultFor(s.stamina, s.maxStamina)
  const boostBonus = getSettings().boostMultiplier - 1
  s.speedMult = multiplier * (boostSeconds > 0 ? 1 + boostBonus : 1)
  const dd = Math.min(s.totalM - s.dist, s.speed * multiplier * (step + boostSeconds * boostBonus))
  s.dist += dd
  s.stamina = Math.max(0, s.stamina - dd / 1000 * s.drain)
  if (s.dist >= s.totalM) s.finished = true
  else if (s.stamina <= 0) {
    s.resting = true; s.restLeft = s.recoverySec; s.exhaust++; s.boostLeft = 0
  }
}
