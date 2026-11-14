import test from 'node:test'
import assert from 'node:assert/strict'
import { rhythmFrame, judgeRhythm } from '../src/lib/rhythm.js'
import { mergeMessages, presenceCounts, presenceMembers } from '../src/lib/chat.js'

const stats = () => ({ score: 0, combo: 0, maxCombo: 0, perfect: 0, good: 0 })
test('the visible center is PERFECT, the surrounding zone GOOD, and edges MISS', () => {
  const score = stats()
  const rhythm = { elapsed: .8, period: 1.6, lastIdx: -1 }
  assert.equal(rhythmFrame(rhythm).phase, .5)
  assert.equal(judgeRhythm(rhythm, score).res, 'PERFECT')
  assert.equal(score.score, 5)
  assert.equal(judgeRhythm(rhythm, score), null)
  rhythm.elapsed = 2.4 + .15
  assert.equal(rhythmFrame(rhythm).hot, true)
  assert.equal(judgeRhythm(rhythm, score).res, 'GOOD')
  assert.equal(score.combo, 2)
  assert.equal(score.score, 7)
  rhythm.elapsed = 3.21
  assert.equal(rhythmFrame(rhythm).hot, false)
  assert.equal(judgeRhythm(rhythm, score).res, 'MISS')
  assert.equal(score.combo, 0)
  assert.equal(score.maxCombo, 2)
  assert.equal(score.score, 7)
})

test('reconnect and history load merge messages without duplicates or chronology loss', () => {
  const row = (id, second) => ({ id, created_at: `2026-11-14T10:00:${String(second).padStart(2,'0')}Z` })
  const merged = mergeMessages([row('c', 3), row('b', 2)], [row('a', 1), row('b', 2)])
  assert.deepEqual(merged.map((message) => message.id), ['a','b','c'])
  const many = Array.from({ length: 110 }, (_, i) => ({ id: String(i), created_at: new Date(1000 * i).toISOString() }))
  assert.equal(mergeMessages([], many).length, 100)
  assert.equal(mergeMessages([], many)[0].id, '10')
})

test('presence counts accounts once across tabs and separates paused runners', () => {
  assert.deepEqual(presenceCounts({ alice: [{ status: 'running' }, { status: 'paused' }], bob: [{ status: 'paused' }], stale: [] }), { online: 2, running: 1 })
  assert.deepEqual(presenceCounts({}), { online: 0, running: 0 })
})

test('presence roster deduplicates tabs, prefers running status and never exposes raw IDs as nicknames', () => {
  const members = presenceMembers({
    alice: [{ nickname: '앨리스', status: 'paused' }, { nickname: '앨리스', status: 'running' }],
    bob: [{ nickname: '친구러너', status: 'paused' }],
    missing: [{}], stale: [], malformed: null,
  })
  assert.equal(members.length, 3)
  assert.deepEqual(members[0], { id: 'alice', nickname: '앨리스', status: 'running' })
  assert.equal(members[1].status, 'paused')
  assert.equal(members[2].nickname, '러너')
  assert.deepEqual(presenceMembers({}), [])
})