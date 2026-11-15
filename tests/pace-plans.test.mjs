import test from 'node:test'
import assert from 'node:assert/strict'
import { FREE_PACE_LEVEL, PACE_PRESETS, clampPace, customDrain, effortLabel, fastestPaceAt, unlockLevelFor, validCustomPace } from '../src/lib/pacePlans.js'
import { trainingFor, xpForLevel } from '../src/lib/progression.js'

test('presets unlock at the first level fast enough for them', () => {
  assert.deepEqual(PACE_PRESETS.map(pace => unlockLevelFor(pace)), [1, 1, 1, 1, 3, 5, 8, 10, 15, 20, 25, 30])
  assert.equal(fastestPaceAt(20), 360)
})

test('custom pace validity matches the server rules', () => {
  assert.equal(validCustomPace(540, 1), true)
  assert.equal(validCustomPace(510, 1), false)
  assert.equal(validCustomPace(545, 1), false)
  assert.equal(validCustomPace(905, 30), false)
  assert.equal(validCustomPace(365, FREE_PACE_LEVEL), true)
  assert.equal(validCustomPace(355, FREE_PACE_LEVEL), false)
  assert.equal(validCustomPace(362, FREE_PACE_LEVEL), false)
  assert.equal(clampPace(352, 20), 360)
  assert.equal(clampPace(998, 20), 900)
  assert.equal(clampPace(377, 20), 375)
})

test('drain follows the intensity curve and trainingFor uses it', () => {
  assert.equal(customDrain(540, 540), 1.35)
  assert.equal(customDrain(600, 540), 1)
  assert.equal(customDrain(690, 540), .75)
  assert.equal(customDrain(900, 540), .75)
  assert.ok(Math.abs(customDrain(570, 540) - 1.175) < 1e-9)
  assert.equal(effortLabel(1.35), '힘들게')
  assert.equal(effortLabel(1), '보통')
  assert.equal(effortLabel(.75), '편안하게')
  const custom = trainingFor(xpForLevel(20), 'custom', false, 400)
  assert.equal(custom.paceSec, 400); assert.equal(custom.intensity, 'custom')
  assert.equal(trainingFor(0, 'custom', false, 300).paceSec, 540)
  assert.equal(trainingFor(0, 'custom', true, 600).intensity, 'steady')
})
