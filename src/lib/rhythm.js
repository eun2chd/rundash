export const RHYTHM_WINDOWS = { perfect: .09, good: .2 }

export function rhythmFrame(rhythm) {
  const elapsed = Math.max(0, rhythm.elapsed || 0)
  const phase = (elapsed % rhythm.period) / rhythm.period
  const offset = Math.abs(phase - .5) * rhythm.period
  return { phase, offset, cycle: Math.floor(elapsed / rhythm.period), hot: offset <= RHYTHM_WINDOWS.good }
}

export function judgeRhythm(rhythm, stats) {
  const frame = rhythmFrame(rhythm)
  if (frame.cycle === rhythm.lastIdx) return null
  rhythm.lastIdx = frame.cycle
  let res = 'MISS'
  let points = 0
  if (frame.offset <= RHYTHM_WINDOWS.perfect + 1e-9) { res = 'PERFECT'; points = 5; stats.perfect++ }
  else if (frame.offset <= RHYTHM_WINDOWS.good + 1e-9) { res = 'GOOD'; points = 2; stats.good++ }
  stats.combo = points ? stats.combo + 1 : 0
  stats.maxCombo = Math.max(stats.maxCombo, stats.combo)
  stats.score += points
  return { res, points, combo: stats.combo }
}
