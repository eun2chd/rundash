import test from 'node:test'
import assert from 'node:assert/strict'
import { shareCardContent } from '../src/lib/shareCard.js'

const profile = { nickname: 'Alice' }
const now = new Date(2026, 10, 5)
const base = { distanceKm: 5, elapsedSec: 1800, paceSec: 360, score: 1234, completed: true }

test('member card shows level, reward, level up and formatted stats', () => {
  const content = shareCardContent({ profile, persisted: true, now, result: { ...base, growth: { reason: 'training', xpEarned: 600, xpBefore: 0, xpAfter: 600, levelBefore: 3, levelAfter: 5 } } })
  assert.equal(content.nickname, 'Alice')
  assert.equal(content.level, 'Lv.5')
  assert.equal(content.headline, '완주했어요!')
  assert.equal(content.distance, '5.00')
  assert.deepEqual(content.stats, [['시간', '30:00'], ['평균 페이스', `6'00"/km`], ['점수', '1,234pt']])
  assert.equal(content.reward, '+600 XP')
  assert.equal(content.levelUp, 'LEVEL UP Lv.3 → Lv.5')
  assert.equal(content.date, '2026.11.05')
  assert.match(content.shareText, /5\.00km 완주했어요/)
})

test('anonymous and practice runs never advertise XP or levels', () => {
  const anonymous = shareCardContent({ profile, persisted: false, now, result: { ...base, completed: false, growth: { xpEarned: 0, reason: 'anonymous' } } })
  assert.equal(anonymous.level, '익명 체험')
  assert.equal(anonymous.reward, '')
  assert.equal(anonymous.levelUp, '')
  assert.equal(anonymous.headline, '오늘도 달렸어요')
  const practice = shareCardContent({ profile, persisted: true, now, result: { ...base, growth: { reason: 'practice', xpEarned: 0, xpAfter: 300, levelBefore: 2, levelAfter: 2 } } })
  assert.equal(practice.level, '')
  assert.equal(practice.reward, '')
})

test('zero distance avoids a meaningless pace', () => {
  const content = shareCardContent({ profile: null, persisted: false, now, result: { distanceKm: 0, elapsedSec: 5, paceSec: Infinity, score: 0, completed: false } })
  assert.equal(content.nickname, '러너')
  assert.equal(content.stats[1][1], '없음')
})
