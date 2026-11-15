// Wording for the daily check-in, from attendance_status() and finish_training_run().

export function attendanceSummary(status) {
  const { minKm, dailyXp, streakEvery, streakBonusXp } = status.rules
  // Streak the runner reaches by checking in today.
  const nextStreak = status.checkedToday ? status.streak : status.streak + 1
  const untilBonus = (streakEvery - (nextStreak % streakEvery)) % streakEvery
  const bonusToday = !status.checkedToday && untilBonus === 0
  const message = status.checkedToday
    ? `오늘 출석 완료! ${untilBonus ? `${untilBonus}일 더 이어가면 연속 보너스 +${streakBonusXp} XP` : '내일도 달려서 연속 기록을 이어가요.'}`
    : `오늘 ${minKm}km 이상 달리면 출석 +${dailyXp} XP${bonusToday ? `, ${nextStreak}일 연속 보너스 +${streakBonusXp} XP까지!` : ''}`
  return { message, nextStreak, untilBonus, bonusToday }
}

export function attendanceResultText(attendance) {
  if (!attendance) return null
  // A retried save of the run that checked in reports its XP again with new: false.
  if (attendance.new || attendance.xp > 0) return { title: `출석 체크 완료 · ${attendance.streak}일 연속`, detail: `+${attendance.xp} XP를 받았어요.` }
  if (attendance.checked) return { title: `오늘은 이미 출석했어요 · ${attendance.streak}일 연속`, detail: '내일 또 달리면 연속 기록이 이어져요.' }
  return { title: '아직 오늘 출석 전이에요', detail: '0.5km 이상 달리면 출석이 체크돼요.' }
}
