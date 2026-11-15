export const RHYTHM_BOOST = { threshold: 5, duration: 3, bonus: .05 }

export function applyRhythmBoost(sim, result) {
  if (sim.paused || sim.finished || sim.resting) return false
  if (result === 'MISS') { sim.rhythmCharge = 0; return false }
  sim.rhythmCharge = (sim.rhythmCharge || 0) + (result === 'PERFECT' ? 2 : 1)
  if (sim.rhythmCharge < RHYTHM_BOOST.threshold) return false
  sim.rhythmCharge -= RHYTHM_BOOST.threshold
  sim.rhythmBoostLeft = RHYTHM_BOOST.duration
  return true
}

export function advanceRhythmBoost(sim, step) {
  const left = sim.rhythmBoostLeft || 0
  sim.rhythmBoostLeft = Math.max(0, left - step)
  // Ease out during the final half-second, reaching normal speed at expiry.
  const start = RHYTHM_BOOST.bonus * Math.min(1, left / .5)
  const end = RHYTHM_BOOST.bonus * Math.min(1, sim.rhythmBoostLeft / .5)
  return (start + end) / 2
}
