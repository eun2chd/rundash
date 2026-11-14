import test from 'node:test'
import assert from 'node:assert/strict'
import { experienceFor, progressionFor, trainingFor, xpForLevel } from '../src/lib/progression.js'
import { advanceSimulation, activateBooster } from '../src/lib/simulation.js'
import { drainPerKm } from '../src/lib/stamina.js'

test('level boundaries, milestones and all three intensities grow consistently', () => {
  for (let level = 1; level <= 50; level++) {
    const xp = xpForLevel(level)
    const current = progressionFor(xp)
    assert.equal(current.level, level)
    assert.equal(current.maxStamina, 100 + (level - 1) * 3)
    if (level > 1) {
      assert.equal(progressionFor(xp - 1).level, level - 1)
      assert.ok(current.fastestPace <= progressionFor(xpForLevel(level - 1)).fastestPace)
    }
    assert.ok(trainingFor(xp, 'easy').paceSec > trainingFor(xp, 'steady').paceSec)
    assert.ok(trainingFor(xp, 'steady').paceSec > trainingFor(xp, 'challenge').paceSec)
  }
  for (const [level, pace] of [[1, 540], [5, 480], [10, 420], [20, 360], [30, 300]]) assert.equal(progressionFor(xpForLevel(level)).fastestPace, pace)
  assert.equal(progressionFor(xpForLevel(4)).boosterUnlocked, false)
  assert.equal(progressionFor(xpForLevel(5)).boosterUnlocked, true)
  assert.equal(progressionFor(xpForLevel(20)).boosterDuration, 12)
  assert.equal(progressionFor(xpForLevel(30)).boosterDuration, 15)
  assert.equal(progressionFor(1e8).level, 50)
})

test('partial distance earns XP; completion adds 20%; practice and anonymous runs earn nothing', () => {
  assert.deepEqual(experienceFor({ distanceKm: 1.5 }), { distance: 150, completion: 0, total: 150 })
  assert.equal(experienceFor({ distanceKm: 5, completed: true }).total, 600)
  assert.equal(experienceFor({ distanceKm: 5, completed: true, practice: true }).total, 0)
  assert.equal(experienceFor({ distanceKm: 5, completed: true, anonymous: true }).total, 0)
})

function runner(level = 1) {
  const config = trainingFor(xpForLevel(level), 'steady')
  return {
    ...config, elapsed: 0, dist: 0, totalM: 1000, targetSec: config.paceSec,
    speed: 1000 / config.paceSec, drain: drainPerKm(config.paceSec) * config.drainMultiplier,
    stamina: config.maxStamina, recoverTo: config.maxStamina * .4, resting: false,
    restLeft: 0, restSec: 0, exhaust: 0, paused: false, finished: false, timeScale: 1,
    boostLeft: 0, boostCooldownLeft: 0, boostUses: 0,
  }
}
const advance = (s, seconds) => { for (let i = 0; i < seconds * 10; i++) advanceSimulation(s, .1) }

test('level 5 unlocks boost; pause freezes timers; cooldown and stamina gate re-use', () => {
  assert.equal(activateBooster(runner(1)), false)
  const s = runner(5)
  const normal = runner(5)
  assert.equal(activateBooster(s), true)
  assert.equal(s.stamina, s.maxStamina - s.boosterCost)
  assert.equal(activateBooster(s), false)
  advance(s, 8); advance(normal, 8)
  assert.ok(s.dist > normal.dist * 1.49)
  assert.ok(s.boostLeft < 1e-8)
  s.paused = true
  const snapshot = { ...s }
  advance(s, 10)
  assert.deepEqual(s, snapshot)
  s.paused = false
  advance(s, 91)
  assert.equal(s.boostCooldownLeft, 0)
  assert.equal(activateBooster(s), true)
  const low = runner(5)
  low.stamina = low.boosterCost
  assert.equal(activateBooster(low), false)
})

test('level stamina affects exhaustion/recovery and a finished run cannot advance', () => {
  const s = runner(10)
  s.stamina = .0001
  advanceSimulation(s, .1)
  assert.equal(s.resting, true)
  assert.equal(s.restLeft, s.recoverySec)
  advance(s, s.recoverySec + .1)
  assert.equal(s.resting, false)
  assert.ok(s.stamina > s.maxStamina * .39)
  const finished = runner(1)
  finished.totalM = .01
  advanceSimulation(finished, .1)
  assert.equal(finished.finished, true)
  const distance = finished.dist
  advance(finished, 10)
  assert.equal(finished.dist, distance)
})
