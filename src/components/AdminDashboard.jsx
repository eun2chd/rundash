import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, BarChart, LineChart, PieChart, Pie, Cell, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { LuMessageCircle, LuFlag, LuTimerOff, LuDatabase, LuRefreshCw, LuUserPlus, LuFootprints, LuMilestone, LuActivity, LuCalendarCheck, LuMessagesSquare, LuGauge, LuClock, LuTrophy, LuTarget, LuSparkles, LuRepeat, LuBot } from 'react-icons/lu'
import { api } from '../lib/api'
import { num } from '../lib/format'
import { fmtPace, fmtTime } from '../lib/pace'

const C = { olive: '#5f6b3c', oliveD: '#48522c', accent: '#e07b39', sky: '#4f95b5', lavender: '#8a72c4', sand: '#c9a24a', ink: '#212121', grid: '#d9d4c7' }
const INTENSITY = [['easy', '가볍게', C.sky], ['steady', '꾸준히', C.olive], ['challenge', '도전하기', C.accent], ['custom', '내 페이스', C.lavender]]
const shortDay = day => { const [, m, d] = String(day).split('-'); return `${Number(m)}/${Number(d)}` }
const paceText = sec => sec ? `${fmtPace(sec)}/km` : '기록 없음'
const axis = { tick: { fill: C.ink, fontSize: 12 }, stroke: C.ink }
const tooltip = { contentStyle: { borderRadius: 10, border: `1px solid ${C.oliveD}`, color: C.ink, fontSize: 13 }, labelStyle: { color: C.ink, fontWeight: 700 } }

function Kpi({ icon: Icon, label, value, unit, note, tone }) {
  return <section className={`dash-kpi${tone ? ' ' + tone : ''}`}>
    <span className="dash-kpi-label"><Icon aria-hidden="true" />{label}</span>
    <strong>{value}{unit && <small>{unit}</small>}</strong>
    {note && <span className="dash-kpi-note">{note}</span>}
  </section>
}

function Panel({ title, children, wide }) {
  return <section className={`dash-panel${wide ? ' wide' : ''}`}><h3>{title}</h3><div className="dash-chart">{children}</div></section>
}

// Admin overview: waiting work, today, live state, 14-day trends and how runners are spread.
export default function AdminDashboard({ onNavigate }) {
  const [board, setBoard] = useState(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let live = true
    setLoading(true); setError('')
    api.adminDashboard().then(value => { if (live) setBoard(value) })
      .catch(err => { if (live) setError(err.message || '대시보드를 불러오지 못했어요.') })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [refresh])
  if (!board) return error ? <div className="account-empty"><p role="alert">{error}</p><button className="btn ghost" onClick={() => setRefresh(v => v + 1)}>다시 불러오기</button></div> : <p role="status">대시보드를 불러오고 있어요…</p>

  const { today, now, pending, totals, averages, purge } = board
  const daily = board.daily.map(row => ({ ...row, label: shortDay(row.day), km: Number(row.km), xp: Number(row.xp), avgKm: row.avgKm === null ? null : Number(row.avgKm), avgPaceSec: row.avgPaceSec === null ? null : Number(row.avgPaceSec) }))
  const intensity = INTENSITY.map(([key, label, color]) => ({ name: label, value: board.intensity[key] || 0, color })).filter(row => row.value > 0)
  const purgeText = !purge.available ? '확인 불가' : !purge.status ? '실행 기록 없음' : purge.status === 'succeeded' ? '정상' : '실패'
  const purgeOk = purge.available && purge.status === 'succeeded'
  return <div className={`admin-dashboard${loading ? ' loading' : ''}`} aria-busy={loading}>
    <div className="dash-toolbar"><span>{new Date(board.generatedAt).toLocaleString('ko-KR')} 기준 · 테스트 계정 제외</span><button type="button" className="btn ghost" disabled={loading} onClick={() => setRefresh(v => v + 1)}><LuRefreshCw aria-hidden="true" /> 새로고침</button></div>

    <h3 className="dash-heading">처리할 일</h3>
    <div className="dash-alerts">
      <button type="button" className={`dash-alert${pending.support ? ' warn' : ''}`} onClick={() => onNavigate('support')}><LuMessageCircle aria-hidden="true" /><span>새 문의</span><strong>{num(pending.support)}건</strong><small>검토 중 {num(pending.supportReviewing)}건</small></button>
      <button type="button" className={`dash-alert${pending.reports ? ' warn' : ''}`} onClick={() => onNavigate('reports')}><LuFlag aria-hidden="true" /><span>채팅 신고 대기</span><strong>{num(pending.reports)}건</strong><small>메시지 기준</small></button>
      <div className={`dash-alert${now.staleSessions ? ' warn' : ''}`}><LuTimerOff aria-hidden="true" /><span>24시간 넘게 안 끝난 러닝</span><strong>{num(now.staleSessions)}건</strong><small>창을 닫고 떠난 세션</small></div>
      <div className={`dash-alert${purgeOk ? '' : ' warn'}`}><LuDatabase aria-hidden="true" /><span>야간 데이터 정리</span><strong>{purgeText}</strong><small>{purge.at ? new Date(purge.at).toLocaleString('ko-KR') : '매일 03:17 실행'}</small></div>
    </div>

    <h3 className="dash-heading">오늘</h3>
    <div className="dash-kpis">
      <Kpi icon={LuActivity} label="지금 달리는 러너" value={num(now.running)} unit="명" note={`일시정지 ${num(now.paused)}명 · 같이 달리기 ${num(now.groups)}팀`} tone="live" />
      <Kpi icon={LuUserPlus} label="신규 가입" value={num(today.signups)} unit="명" note={`익명 체험 ${num(today.anonymous)}명`} />
      <Kpi icon={LuFootprints} label="저장된 러닝" value={num(today.runs)} unit="회" note={`완주 ${num(today.completed)}회 · 체험 처리 ${num(today.practice)}회`} />
      <Kpi icon={LuMilestone} label="달린 거리" value={num(today.km, 1)} unit="km" note={`지급 경험치 ${num(today.xp)} XP`} />
      <Kpi icon={LuCalendarCheck} label="출석" value={num(today.attendance)} unit="명" />
      <Kpi icon={LuMessagesSquare} label="채팅 메시지" value={num(today.messages)} unit="개" />
    </div>

    <h3 className="dash-heading">러너 평균 · 최근 14일</h3>
    <div className="dash-kpis">
      <Kpi icon={LuGauge} label="평균 페이스" value={averages.paceSec ? fmtPace(averages.paceSec) : '-'} unit="/km" note="전체 시간 ÷ 전체 거리" />
      <Kpi icon={LuMilestone} label="평균 거리" value={num(averages.km || 0, 2)} unit="km" note={`러닝 ${num(averages.runs)}회 기준`} />
      <Kpi icon={LuClock} label="평균 러닝 시간" value={averages.elapsedSec ? fmtTime(averages.elapsedSec) : '-'} />
      <Kpi icon={LuTarget} label="완주율" value={num(averages.completionRate || 0, 1)} unit="%" />
      <Kpi icon={LuTrophy} label="평균 점수" value={num(averages.score || 0)} unit="pt" />
      <Kpi icon={LuSparkles} label="러닝당 경험치" value={num(averages.xp || 0)} unit="XP" />
      <Kpi icon={LuRepeat} label="러너당 러닝" value={num(averages.runsPerRunner || 0, 1)} unit="회" note={`참여 러너 ${num(averages.runners)}명`} />
      <Kpi icon={LuBot} label="AUTO 사용 가능" value={num(totals.autoRunners)} unit="명" note="Lv.80 이상" />
    </div>

    <div className="dash-grid">
      <Panel title="일별 러닝 수와 거리" wide>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="label" {...axis} />
            <YAxis yAxisId="runs" allowDecimals={false} {...axis} width={40} />
            <YAxis yAxisId="km" orientation="right" {...axis} width={48} tickFormatter={v => num(v)} />
            <Tooltip {...tooltip} formatter={(value, name) => name === '거리(km)' ? [`${num(value, 2)} km`, name] : [`${num(value)}회`, name]} />
            <Legend wrapperStyle={{ color: C.ink, fontSize: 13 }} />
            <Bar yAxisId="runs" dataKey="runs" name="러닝 수" fill={C.olive} radius={[4, 4, 0, 0]} />
            <Bar yAxisId="runs" dataKey="completed" name="완주" fill={C.sand} radius={[4, 4, 0, 0]} />
            <Line yAxisId="km" type="monotone" dataKey="km" name="거리(km)" stroke={C.accent} strokeWidth={2.5} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="일별 평균 페이스">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={daily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="label" {...axis} />
            <YAxis reversed domain={['dataMin - 30', 'dataMax + 30']} {...axis} width={52} tickFormatter={v => fmtPace(v)} />
            <Tooltip {...tooltip} formatter={value => [paceText(value), '평균 페이스']} />
            <Line type="monotone" dataKey="avgPaceSec" name="평균 페이스" stroke={C.oliveD} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="일별 평균 거리">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="label" {...axis} />
            <YAxis {...axis} width={40} />
            <Tooltip {...tooltip} formatter={value => [`${num(value || 0, 2)} km`, '평균 거리']} />
            <Bar dataKey="avgKm" name="평균 거리" fill={C.sky} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="일별 가입 · 출석">
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="label" {...axis} />
            <YAxis allowDecimals={false} {...axis} width={40} />
            <Tooltip {...tooltip} formatter={(value, name) => [`${num(value)}명`, name]} />
            <Legend wrapperStyle={{ color: C.ink, fontSize: 13 }} />
            <Bar dataKey="signups" name="회원 가입" stackId="join" fill={C.olive} />
            <Bar dataKey="anonymous" name="익명 체험" stackId="join" fill={C.sand} radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="attendance" name="출석" stroke={C.accent} strokeWidth={2.5} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="일별 지급 경험치">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="label" {...axis} />
            <YAxis {...axis} width={56} tickFormatter={v => num(v)} />
            <Tooltip {...tooltip} formatter={value => [`${num(value)} XP`, '지급 경험치']} />
            <Bar dataKey="xp" name="지급 경험치" fill={C.lavender} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="시간대별 러닝 · 최근 7일" wide>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={board.hours.map(row => ({ ...row, label: `${row.hour}시` }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="label" {...axis} interval={1} />
            <YAxis allowDecimals={false} {...axis} width={40} />
            <Tooltip {...tooltip} formatter={value => [`${num(value)}회`, '러닝']} />
            <Bar dataKey="runs" name="러닝" fill={C.olive} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="러닝 강도 · 최근 7일">
        {intensity.length ? <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={intensity} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}>
              {intensity.map(row => <Cell key={row.name} fill={row.color} />)}
            </Pie>
            <Tooltip {...tooltip} formatter={(value, name) => [`${num(value)}회`, name]} />
          </PieChart>
        </ResponsiveContainer> : <p className="dash-empty">최근 7일 러닝이 없어요.</p>}
      </Panel>
      <Panel title="레벨 분포">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={board.levels} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} horizontal={false} />
            <XAxis type="number" allowDecimals={false} {...axis} />
            <YAxis type="category" dataKey="label" {...axis} width={76} />
            <Tooltip {...tooltip} formatter={value => [`${num(value)}명`, '러너']} />
            <Bar dataKey="runners" name="러너" fill={C.accent} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="거리 분포 · 최근 14일">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={board.distances} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="label" {...axis} />
            <YAxis allowDecimals={false} {...axis} width={40} />
            <Tooltip {...tooltip} formatter={value => [`${num(value)}회`, '러닝']} />
            <Bar dataKey="runs" name="러닝" fill={C.sky} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="페이스 분포 · 최근 14일 (분/km)">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={board.paces} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="label" {...axis} />
            <YAxis allowDecimals={false} {...axis} width={40} />
            <Tooltip {...tooltip} formatter={value => [`${num(value)}회`, '러닝']} />
            <Bar dataKey="runs" name="러닝" fill={C.oliveD} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>

    <div className="dash-grid">
      <section className="dash-panel">
        <h3>이번 주 거리 상위 러너 · 최근 7일</h3>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">순위</th><th scope="col">닉네임</th><th scope="col">거리</th><th scope="col">러닝</th><th scope="col">평균 페이스</th></tr></thead>
          <tbody>{board.topRunners.map((row, index) => <tr key={row.nickname}><td className="numeric-cell">{index + 1}</td><td>{row.nickname}</td><td className="numeric-cell">{num(row.km, 2)} km</td><td className="numeric-cell">{num(row.runs)}회</td><td className="numeric-cell">{paceText(row.paceSec)}</td></tr>)}
          {!board.topRunners.length && <tr><td colSpan={5} className="empty-cell">최근 7일 러닝이 없어요.</td></tr>}</tbody></table></div>
      </section>
      <section className="dash-panel">
        <h3>누적 현황</h3>
        <div className="admin-table-wrap"><table className="admin-table"><tbody>
          <tr><th scope="row">회원 계정</th><td className="numeric-cell">{num(totals.members)}명</td></tr>
          <tr><th scope="row">익명 러너</th><td className="numeric-cell">{num(totals.anonymous)}명</td></tr>
          <tr><th scope="row">러너를 만든 계정</th><td className="numeric-cell">{num(totals.runners)}명</td></tr>
          <tr><th scope="row">이용 정지</th><td className="numeric-cell">{num(totals.suspended)}명</td></tr>
          <tr><th scope="row">누적 러닝</th><td className="numeric-cell">{num(totals.runs)}회</td></tr>
          <tr><th scope="row">누적 거리</th><td className="numeric-cell">{num(totals.km, 2)} km</td></tr>
        </tbody></table></div>
      </section>
    </div>
  </div>
}
