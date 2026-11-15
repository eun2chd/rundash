import { useEffect, useState } from 'react'
import { LuTrophy, LuMedal, LuTimer } from 'react-icons/lu'
import { api } from '../lib/api'
import { formatDay, formatKm, timeUntil } from '../lib/ranking'

const PERIODS = [[0, '이번 주'], [1, '지난주']]

function RunnerName({ row }) {
  return <span className="ranking-name"><i className="dot" style={{ background: row.color }} aria-hidden="true" />{row.nickname}<small>Lv.{row.level}</small>{row.me && <b className="ranking-me-badge">나</b>}</span>
}

export default function Ranking({ anonymous, onRun }) {
  const [offset, setOffset] = useState(0)
  const [board, setBoard] = useState(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let live = true
    setBoard(null); setError('')
    api.weeklyRanking(offset).then(value => { if (live) setBoard(value) }).catch(() => { if (live) setError('랭킹을 불러오지 못했어요.') })
    return () => { live = false }
  }, [offset, refresh])
  const podium = board?.items.slice(0, 3) || []
  const rest = board?.items.slice(3) || []
  return <div className="ranking-screen">
    <section className="card ranking-card">
      <div className="eyebrow">WEEKLY RANKING</div>
      <div className="ranking-heading">
        <h2><LuTrophy /> 주간 랭킹</h2>
        <div className="ranking-tabs" role="tablist" aria-label="랭킹 기간">{PERIODS.map(([value, label]) => <button type="button" role="tab" key={value} aria-selected={offset === value} className={offset === value ? 'on' : ''} onClick={() => setOffset(value)}>{label}</button>)}</div>
      </div>
      <p className="ranking-period">{board ? <>{formatDay(board.weekStart)} ~ {formatDay(board.weekEnd)} · 참여 러너 {board.participants}명{offset === 0 && <span><LuTimer /> 초기화까지 {timeUntil(board.resetsAt)}</span>}</> : ' '}</p>
      <p className="ranking-rule">매주 월요일 0시(한국 시간)에 새로 시작해요. 정식 계정으로 저장한 러닝 거리를 합산하고, 같은 거리라면 먼저 달성한 러너가 앞서요.</p>

      {error ? <div className="account-empty"><p>{error}</p><button className="btn ghost" onClick={() => setRefresh(n => n + 1)}>다시 불러오기</button></div>
        : !board ? <p role="status">랭킹을 불러오고 있어요…</p>
        : <>
          <div className="ranking-mine" role="status">
            {board.me ? <><strong>내 순위 {board.me.rank}위</strong><span>{formatKm(board.me.km)} · {board.me.runs}회</span></>
              : anonymous ? <><strong>익명 러너는 랭킹에 오르지 않아요</strong><span>정식 계정으로 달리면 랭킹에 이름을 올릴 수 있어요.</span></>
              : <><strong>{offset === 0 ? '아직 이번 주 기록이 없어요' : '지난주에는 기록이 없어요'}</strong>{offset === 0 && <button type="button" className="btn primary" onClick={onRun}>달리러 가기</button>}</>}
          </div>
          {!board.items.length ? <p className="account-empty">{offset === 0 ? '이번 주 첫 번째 러너가 되어 보세요!' : '지난주 기록이 없어요.'}</p> : <>
            <ol className="ranking-podium" aria-label="1위부터 3위">
              {podium.map(row => <li key={row.rank + row.nickname} className={`place-${row.rank}${row.me ? ' me' : ''}`}>
                <span className="podium-medal"><LuMedal /> {row.rank}위</span>
                <RunnerName row={row} />
                <strong>{formatKm(row.km)}</strong>
                <small>{row.runs}회 달림</small>
              </li>)}
            </ol>
            {rest.length > 0 && <ol className="ranking-list" start={4} aria-label="4위부터">
              {rest.map(row => <li key={row.rank + row.nickname} className={row.me ? 'me' : ''}>
                <span className="ranking-rank">{row.rank}</span>
                <RunnerName row={row} />
                <span className="ranking-km">{formatKm(row.km)}<small>{row.runs}회</small></span>
              </li>)}
            </ol>}
            {board.participants > board.items.length && <p className="note">상위 {board.items.length}명까지 보여줘요.</p>}
          </>}
        </>}
    </section>
  </div>
}
