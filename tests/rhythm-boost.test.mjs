import test from 'node:test'
import assert from 'node:assert/strict'
import { applyRhythmBoost } from '../src/lib/rhythmBoost.js'
import { advanceSimulation } from '../src/lib/simulation.js'

const state = () => ({ elapsed: 0, dist: 0, totalM: 1000, speed: 3, stamina: 100, maxStamina: 100, drain: 0, timeScale: 1, boostLeft: 0, boostCooldownLeft: 0 })

test('weighted hits trigger at five, carry surplus and refresh without stacking', () => {
  const s = state()
  for (let i = 0; i < 2; i++) assert.equal(applyRhythmBoost(s, 'PERFECT'), false)
  assert.equal(applyRhythmBoost(s, 'PERFECT'), true)
  assert.equal(s.rhythmCharge, 1)
  assert.equal(s.rhythmBoostLeft, 3)
  s.rhythmBoostLeft = 1
  for (let i = 0; i < 4; i++) applyRhythmBoost(s, 'GOOD')
  assert.equal(s.rhythmBoostLeft, 3)
  assert.equal(s.rhythmCharge, 0)
})

test('miss resets charge but retains boost; pause freezes and expiry eases to normal', () => {
  const s = state(), normal = state()
  s.rhythmBoostLeft = 3; s.rhythmCharge = 4
  applyRhythmBoost(s, 'MISS')
  assert.equal(s.rhythmCharge, 0)
  assert.equal(s.rhythmBoostLeft, 3)
  s.paused = true; advanceSimulation(s, .1)
  assert.equal(s.rhythmBoostLeft, 3)
  s.paused = false
  advanceSimulation(s, .1); advanceSimulation(normal, .1)
  assert.ok(Math.abs(s.dist / normal.dist - 1.05) < 1e-9)
  for (let i = 0; i < 24; i++) advanceSimulation(s, .1)
  const speeds = []
  for (let i = 0; i < 6; i++) { advanceSimulation(s, .1); speeds.push(s.speedMult) }
  assert.ok(speeds.every((speed, i) => i === 0 || speed <= speeds[i - 1]))
  assert.equal(s.rhythmBoostLeft, 0)
  assert.equal(s.speedMult, 1)
})

test('resting clears boost and blocks activation', () => {
  const s = { ...state(), resting: true, restLeft: 10, recoverySec: 10, recoverTo: 40, restSec: 0, rhythmBoostLeft: 3 }
  assert.equal(applyRhythmBoost(s, 'PERFECT'), false)
  advanceSimulation(s, .1)
  assert.equal(s.rhythmBoostLeft, 0)
  assert.equal(s.dist, 0)
})
