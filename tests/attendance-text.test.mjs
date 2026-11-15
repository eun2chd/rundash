import test from 'node:test'
import assert from 'node:assert/strict'
import { attendanceResultText, attendanceSummary } from '../src/lib/attendance.js'

const rules = { minKm: 0.5, dailyXp: 50, streakEvery: 7, streakBonusXp: 300 }

test('setup card wording counts down to the streak bonus', () => {
  assert.equal(attendanceSummary({ rules, checkedToday: false, streak: 0 }).message, '오늘 0.5km 이상 달리면 출석 +50 XP')
  const bonus = attendanceSummary({ rules, checkedToday: false, streak: 6 })
  assert.equal(bonus.bonusToday, true)
  assert.match(bonus.message, /7일 연속 보너스 \+300 XP/)
  assert.equal(attendanceSummary({ rules, checkedToday: true, streak: 3 }).untilBonus, 4)
  assert.match(attendanceSummary({ rules, checkedToday: true, streak: 7 }).message, /내일도 달려서/)
})

test('result wording separates new, repeated and missed check-ins', () => {
  assert.equal(attendanceResultText(null), null)
  assert.deepEqual(attendanceResultText({ checked: true, new: true, streak: 2, xp: 50 }), { title: '출석 체크 완료 · 2일 연속', detail: '+50 XP를 받았어요.' })
  assert.match(attendanceResultText({ checked: true, new: false, streak: 2, xp: 50 }).title, /출석 체크 완료/)
  assert.match(attendanceResultText({ checked: true, new: false, streak: 2, xp: 0 }).title, /이미 출석/)
  assert.match(attendanceResultText({ checked: false, new: false, streak: 0, xp: 0 }).title, /출석 전/)
})
