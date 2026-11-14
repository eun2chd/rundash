import { advanceSimulation } from './simulation.js'

// Rendering can stop in a background tab. Account for elapsed time in bounded
// simulation steps so exhaustion/recovery and booster expiry remain consistent.
export function advanceElapsed(sim, seconds, rhythm) {
  if (!Number.isFinite(seconds) || seconds <= 0 || sim.paused || sim.finished) return
  let remaining = Math.min(seconds, 7 * 24 * 3600)
  while (remaining > 1e-8 && !sim.finished) {
    const step = Math.min(0.1, remaining)
    if (rhythm && !sim.resting) rhythm.elapsed += step
    advanceSimulation(sim, step)
    remaining -= step
  }
}

export function checkpointKey(userId) { return `rundash:active-run:${userId}` }

export function readLocalCheckpoint(userId) {
  try { return JSON.parse(localStorage.getItem(checkpointKey(userId)) || 'null') }
  catch { return null }
}

export function clearLocalCheckpoint(userId) {
  try { localStorage.removeItem(checkpointKey(userId)) } catch { /* storage may be disabled */ }
}

export function validCheckpoint(data, runId) {
  if (!data || data.runId !== runId || data.version !== 1 || !Number.isFinite(data.savedAt)) return false
  const s = data.sim
  return !!s && ['elapsed', 'dist', 'stamina', 'restLeft', 'restSec', 'exhaust', 'boostLeft', 'boostCooldownLeft', 'boostUses'].every(k => Number.isFinite(s[k]) && s[k] >= 0)
    && typeof s.paused === 'boolean' && typeof s.resting === 'boolean' && typeof s.finished === 'boolean'
    && Array.isArray(data.items) && Array.isArray(data.stations) && Array.isArray(data.closedStations)
    && data.items.length <= 5000 && data.stations.length <= 500 && !!data.stats
}

export function restoreSimulation(base, checkpoint, now = Date.now()) {
  if (!validCheckpoint(checkpoint, checkpoint?.runId)) return base
  const keys = ['elapsed','dist','stamina','restLeft','restSec','exhaust','boostLeft','boostCooldownLeft','boostUses','paused','resting','finished','practice']
  const restored = { ...base }
  for (const key of keys) if (checkpoint.sim[key] !== undefined) restored[key] = checkpoint.sim[key]
  restored.dist = Math.min(base.totalM, restored.dist)
  restored.stamina = Math.min(base.maxStamina, restored.stamina)
  restored.finished = restored.finished || restored.dist >= base.totalM
  restored.practice = !!(base.practice || restored.practice)
  // New mounts always use real time; a development practice run stays practice.
  restored.timeScale = 1
  advanceElapsed(restored, Math.max(0, (now - checkpoint.savedAt) / 1000))
  return restored
}
