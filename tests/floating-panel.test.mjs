import test from 'node:test'
import assert from 'node:assert/strict'
import { clampPanel } from '../src/lib/floatingPanel.js'

test('dragged position stays inside screen and survives viewport shrink', () => {
  const size = { width: 320, height: 430 }
  assert.deepEqual(clampPanel({ x: 500, y: 200 }, size, { width: 1200, height: 800 }), { x: 500, y: 200 })
  assert.deepEqual(clampPanel({ x: -50, y: -100 }, size, { width: 1200, height: 800 }), { x: 8, y: 8 })
  assert.deepEqual(clampPanel({ x: 900, y: 600 }, size, { width: 390, height: 700 }), { x: 62, y: 262 })
})
test('invalid coordinates and unusually small screens remain recoverable', () => {
  assert.deepEqual(clampPanel({ x: NaN, y: Infinity }, { width: 320, height: 430 }, { width: 250, height: 300 }), { x: 8, y: 8 })
})
