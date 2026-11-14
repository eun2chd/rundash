// Fictional course weather, shared by every runner on the same five-minute UTC slot.
// No location permission, external weather API, or API key is required.
export const WEATHER_INTERVAL_MS = 5 * 60 * 1000
export const WEATHER_TYPES = [
  { id: 'clear', label: '맑음', weight: 30, temperature: [19, 27], humidity: [35, 55], drainMultiplier: 1, precipitation: null, intensity: 'none', tone: 'clear' },
  { id: 'cloudy', label: '흐림', weight: 20, temperature: [13, 24], humidity: [45, 70], drainMultiplier: 1, precipitation: null, intensity: 'none', tone: 'cloudy' },
  { id: 'rain', label: '가벼운 비', weight: 15, temperature: [12, 24], humidity: [75, 90], drainMultiplier: 1, precipitation: 'rain', intensity: 'light', tone: 'rain' },
  { id: 'snow', label: '가벼운 눈', weight: 10, temperature: [-3, 1], humidity: [65, 85], drainMultiplier: 1, precipitation: 'snow', intensity: 'light', tone: 'snow' },
  { id: 'heat', label: '폭염', weight: 8, temperature: [35, 41], humidity: [55, 80], drainMultiplier: 1.4, precipitation: null, intensity: 'none', tone: 'heat' },
  { id: 'cold', label: '혹한', weight: 6, temperature: [-15, -8], humidity: [30, 55], drainMultiplier: 1.35, precipitation: null, intensity: 'none', tone: 'cold' },
  { id: 'heavy_rain', label: '폭우', weight: 7, temperature: [16, 25], humidity: [90, 99], drainMultiplier: 1.3, precipitation: 'rain', intensity: 'heavy', tone: 'rain' },
  { id: 'blizzard', label: '폭설', weight: 4, temperature: [-12, -4], humidity: [85, 98], drainMultiplier: 1.45, precipitation: 'snow', intensity: 'heavy', tone: 'snow' },
]

function randomFor(seed) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
const cache = new Map()
export function weatherAt(timestamp) {
  const epoch = Math.floor((Number.isFinite(timestamp) ? timestamp : 0) / WEATHER_INTERVAL_MS)
  if (cache.has(epoch)) return cache.get(epoch)
  const random = randomFor(epoch ^ 0x52da17b3)
  let roll = random() * 100
  const type = WEATHER_TYPES.find(value => (roll -= value.weight) < 0) || WEATHER_TYPES[0]
  const between = ([min,max]) => Math.round(min + random() * (max-min))
  const weather = Object.freeze({ ...type, epoch, temperature: between(type.temperature), humidity: between(type.humidity), startsAt: epoch * WEATHER_INTERVAL_MS, changesAt: (epoch+1) * WEATHER_INTERVAL_MS })
  if (cache.size >= 32) cache.delete(cache.keys().next().value)
  cache.set(epoch, weather)
  return weather
}

export function weatherDrainAt(timestamp) {
  return Number.isFinite(timestamp) ? weatherAt(timestamp).drainMultiplier : 1
}
