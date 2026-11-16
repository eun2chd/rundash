import test from 'node:test'
import assert from 'node:assert/strict'
import { nearbyMapStations } from '../src/lib/minimapStations.js'

test('long runs do not project every future aid station onto the same lap', () => {
  const stations = Array.from({ length: 50 }, (_, i) => ({ id: `s${i + 1}`, dist: 600 + i * 1000 }))
  const nearby = nearbyMapStations(stations, 7100, 650)
  assert.deepEqual(nearby.map(st => st.dist), [7600])
  assert.deepEqual(nearbyMapStations(stations, 7700, 650), [])
})
test('recently passed station stays briefly, distant past and future laps are excluded', () => {
  const stations = [950, 980, 1100, 1560, 1600].map(dist => ({ dist }))
  assert.deepEqual(nearbyMapStations(stations, 1000, 600).map(st => st.dist), [980, 1100])
})
