import { useEffect, useState } from 'react'
import { LuCalendarCheck, LuChevronLeft, LuChevronRight, LuFlame, LuFootprints } from 'react-icons/lu'
import { api } from '../lib/api'
import { attendanceSummary, monthGrid, shiftMonth } from '../lib/attendance'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
// Attendance launched in November 2026; there is nothing to show before that.
const FIRST_MONTH = { year: 2026, month: 11 }
const monthIndex = ({ year, month }) => year * 12 + month

export default function Attendance({ onRun }) {
  const [status, setStatus] = useState(null)
  const [view, setView] = useState(null)
  const [month, setMonth] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    api.attendanceStatus().then(value => {
      if (!live) return
      setStatus(value)
      const [year, monthNumber] = value.today.split('-').map(Number)
      setView({ year, month: monthNumber })
    }).catch(() => { if (live) setError('출석 정보를 불러오지 못했어요.') })
    return () => { live = false }
  }, [])
  useEffect(() => {
    if (!view) return
    let live = true
    setMonth(null)
    api.attendanceMonth(view.year, view.month).then(value => { if (live) setMonth(value) }).catch(() => { if (live) setError('출석 달력을 불러오지 못했어요.') })
    return () => { live = false }
  }, [view?.year, view?.month])
  if (error) return <div className="attendance-screen"><section className="card"><p className="error" role="alert">{error}</p></section></div>
  if (!status || !view) return <div className="attendance-screen"><section className="card"><p role="status">출석 달력을 불러오고 있어요…</p></section></div>
  const thisMonth = (() => { const [year, monthNumber] = status.today.split('-').map(Number); return { year, month: monthNumber } })()
  const stamps = new Map((month?.days || []).map(row => [row.day, row]))
  const monthXp = (month?.days || []).reduce((sum, row) => sum + row.xp, 0)
  const { streakEvery } = status.rules
  return <div className="attendance-screen">
    <section className="card attendance-page">
      <div className="eyebrow">ATTENDANCE</div>
      <h2><LuCalendarCheck /> 출석 달력</h2>
      <div className="attendance-summary">
        <div><span>현재 연속</span><b><LuFlame /> {status.streak}일</b></div>
        <div><span>이번 달 출석</span><b>{month ? `${month.days.length}일` : '…'}</b></div>
        <div><span>최장 연속</span><b>{month ? `${month.longestStreak}일` : '…'}</b></div>
        <div><span>이번 달 출석 XP</span><b>{month ? `+${monthXp.toLocaleString()}` : '…'}</b></div>
      </div>
      <p className="attendance-message">{attendanceSummary(status).message}</p>

      <div className="calendar-nav">
        <button type="button" className="icon-btn" aria-label="이전 달" disabled={monthIndex(view) <= monthIndex(FIRST_MONTH)} onClick={() => setView(shiftMonth(view, -1))}><LuChevronLeft /></button>
        <h3>{view.year}년 {view.month}월</h3>
        <button type="button" className="icon-btn" aria-label="다음 달" disabled={monthIndex(view) >= monthIndex(thisMonth)} onClick={() => setView(shiftMonth(view, 1))}><LuChevronRight /></button>
      </div>
      <div className="calendar" role="grid" aria-label={`${view.year}년 ${view.month}월 출석`} aria-busy={!month}>
        {WEEKDAYS.map(day => <span className="calendar-weekday" role="columnheader" key={day}>{day}</span>)}
        {monthGrid(view.year, view.month).map((day, index) => {
          if (!day) return <span key={`blank-${index}`} className="calendar-day blank" aria-hidden="true" />
          const stamp = stamps.get(day)
          const bonus = stamp && stamp.streak % streakEvery === 0
          const className = ['calendar-day', stamp && 'stamped', bonus && 'bonus', day === status.today && 'today', day > status.today && 'future'].filter(Boolean).join(' ')
          return <span key={day} role="gridcell" className={className} aria-label={`${Number(day.slice(8))}일${stamp ? ` 출석, ${stamp.streak}일 연속, +${stamp.xp} XP` : ''}${day === status.today ? ', 오늘' : ''}`}>
            <span className="calendar-date">{Number(day.slice(8))}</span>
            {stamp && <span className="calendar-stamp" aria-hidden="true"><LuFootprints />{bonus && <em>+{stamp.xp}</em>}</span>}
          </span>
        })}
      </div>
      <p className="note">하루에 0.5km 이상 달려 기록을 저장하면 도장이 찍혀요. {streakEvery}일 연속마다 보너스 도장을 받아요.</p>
      {!status.checkedToday && <button type="button" className="btn primary block" onClick={onRun}>오늘 출석하러 달리기</button>}
    </section>
  </div>
}
