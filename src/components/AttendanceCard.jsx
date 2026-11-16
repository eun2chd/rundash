import { useEffect, useState } from 'react'
import { LuCalendarCheck, LuFlame } from 'react-icons/lu'
import { api } from '../lib/api'
import { attendanceSummary } from '../lib/attendance'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// Member-only daily check-in card. Hidden when the attendance migration is missing.
export default function AttendanceCard({ anonymous = false, onOpenCalendar, className = '' }) {
  const [status, setStatus] = useState(null)
  useEffect(() => {
    if (anonymous) return
    let live = true
    api.attendanceStatus().then(value => { if (live) setStatus(value) }).catch(() => {})
    return () => { live = false }
  }, [anonymous])
  if (anonymous || !status) return null
  const summary = attendanceSummary(status)
  return <section className={`attendance-card${className ? " " + className : ""}`} aria-label="출석 체크">
    <div className="attendance-heading">
      <strong><LuCalendarCheck /> 출석 체크</strong>
      <span className="attendance-streak"><LuFlame />{status.streak}일 연속</span>
    </div>
    <ol className="attendance-week" aria-label="최근 7일 출석">
      {status.week.map(({ day, checked }) => <li key={day} className={checked ? 'on' : ''} aria-label={`${day} ${checked ? '출석' : '미출석'}`}>
        <span>{WEEKDAYS[new Date(`${day}T00:00:00`).getDay()]}</span><i aria-hidden="true">{checked ? '✓' : ''}</i>
      </li>)}
    </ol>
    <p className="attendance-message">{summary.message}</p>
    {onOpenCalendar && <button type="button" className="link attendance-calendar-link" onClick={onOpenCalendar}>출석 달력 보기 →</button>}
  </section>
}
