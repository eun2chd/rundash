import test from 'node:test'
import assert from 'node:assert/strict'
import { formatDay, formatKm, timeUntil } from '../src/lib/ranking.js'
import { monthGrid, shiftMonth } from '../src/lib/attendance.js'

test('ranking dates and countdown', () => {
  assert.equal(formatDay('2026-11-09'), '11.9 (월)')
  assert.equal(formatDay('2026-11-15'), '11.15 (일)')
  const now = Date.parse('2026-11-15T00:00:00Z')
  assert.equal(timeUntil('2026-11-16T15:30:00Z', now), '1일 15시간')
  assert.equal(timeUntil('2026-11-15T02:05:00Z', now), '2시간 5분')
  assert.equal(timeUntil('2026-11-14T00:00:00Z', now), '0분')
  assert.equal(formatKm(5.5), '5.50km')
})

test('month grid starts on Sunday and pads to full weeks', () => {
  const november = monthGrid(2026, 11)
  assert.equal(november[0], '2026-11-01')
  assert.equal(november.length % 7, 0)
  assert.equal(november.filter(Boolean).length, 30)
  const february = monthGrid(2027, 2)
  assert.equal(february.indexOf('2027-02-01'), 1)
  assert.equal(february.filter(Boolean).at(-1), '2027-02-28')
  assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 })
  assert.deepEqual(shiftMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 })
})

test('board values and period labels', async () => {
  const { boardValue, periodLabel } = await import('../src/lib/ranking.js')
  assert.deepEqual(boardValue('week', { km: 5.5, runs: 2 }), { main: '5.50km', sub: '2회 달림' })
  assert.deepEqual(boardValue('level', { level: 12, xp: 15400 }), { main: 'Lv.12', sub: '15,400 XP' })
  assert.equal(periodLabel('month', 1), '지난달')
  assert.equal(periodLabel('total', 0), '')
})
