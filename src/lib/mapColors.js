export const RUNNER_MAP_COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#2dd4bf', '#60a5fa', '#e879f9', '#4ade80', '#818cf8']
export const SELF_MAP_COLOR = '#f8fafc'
export const STATION_MAP_COLOR = '#f59e0b'

const hash = value => {
  let result = 2166136261
  for (const character of String(value)) result = Math.imul(result ^ character.charCodeAt(0), 16777619) >>> 0
  return result
}

// A map-specific palette stays distinct from supply stations and avatar outfits.
// Resolve collisions within the displayed roster, independent of network ordering.
export function runnerMapColors(runners) {
  const assigned = new Map()
  const used = new Set()
  const ids = [...new Set(runners.map(runner => String(runner.id)))].sort()
  for (const id of ids) {
    const preferred = hash(id) % RUNNER_MAP_COLORS.length
    let index = preferred
    for (let offset = 0; offset < RUNNER_MAP_COLORS.length; offset++) {
      const candidate = (preferred + offset) % RUNNER_MAP_COLORS.length
      if (!used.has(candidate)) { index = candidate; break }
    }
    used.add(index)
    assigned.set(id, RUNNER_MAP_COLORS[index])
  }
  return assigned
}
