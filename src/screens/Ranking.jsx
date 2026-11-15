import { useEffect, useState } from 'react'
import { LuTrophy, LuMedal, LuTimer } from 'react-icons/lu'
import { api } from '../lib/api'
import { RANKING_BOARDS, boardValue, formatDay, periodLabel, timeUntil } from '../lib/ranking'

function RunnerName({ row, showLevel = true }) {
  return <span className="ranking-name"><i className="dot" style={{ background: row.color }} aria-hidden="true" />{row.nickname}{showLevel && <small>Lv.{row.level}</small>}{row.me && <b className="ranking-me-badge">나</b>}</span>
}

export default function Ranking({ anonymous, onRun }) {
  const [kind, setKind] = useState('week')
  const [offset, setOffset] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const board = RANKING_BOARDS[kind]
  useEffect(() => {
    let live = true
    setResult(null); setError('')
    api.ranking(kind, offset).then(value => { if (live) setResult(value) }).catch(() => { if (live) setError('랭킹을 불러오지 못했어요.') })
    return () => { live = false }
  }, [kind, offset, refresh])
  const chooseKind = (next) => { setKind(next); setOffset(0) }
  const podium = result?.items.slice(0, 3) || []
  const rest = result?.items.slice(3) || []
  return <div className="ranking-screen">
    <section className="card ranking-card">
      <div className="eyebrow">RANKING</div>
      <h2><LuTrophy /> 러너 랭킹</h2>
      <div className="ranking-boards" role="tablist" aria-label="랭킹 종류">{Object.entries(RANKING_BOARDS).map(([id, item]) => <button type="button" role="tab" key={id} aria-selected={kind === id} className={kind === id ? 'on' : ''} onClick={() => chooseKind(id)}>{item.label}</button>)}</div>
      {board.periods && <div className="ranking-tabs" role="tablist" aria-label="기간">{board.periods.map((label, value) => <button type="button" role="tab" key={label} aria-selected={offset === value} className={offset === value ? 'on' : ''} onClick={() => setOffset(value)}>{label}</button>)}</div>}
      <p className="ranking-period">{result ? <>{result.periodStart ? `${formatDay(result.periodStart)} ~ ${formatDay(result.periodEnd)} · ` : ''}참여 러너 {result.participants}명{result.resetsAt && <span><LuTimer /> 초기화까지 {timeUntil(result.resetsAt)}</span>}</> : ' '}</p>
      <p className="ranking-rule">{board.rule}</p>

      {error ? <div className="account-empty"><p>{error}</p><button className="btn ghost" onClick={() => setRefresh(n => n + 1)}>다시 불러오기</button></div>
        : !result ? <p role="status">랭킹을 불러오고 있어요…</p>
        : <>
          <div className="ranking-mine" role="status">
            {result.me ? <><strong>내 순위 {result.me.rank}위</strong><span>{boardValue(kind, result.me).main} · {boardValue(kind, result.me).sub}</span></>
              : result.excluded ? <><strong>관리자 계정은 랭킹에 오르지 않아요</strong><span>운영 계정의 기록은 모든 랭킹에서 제외돼요.</span></>
              : anonymous ? <><strong>익명 러너는 랭킹에 오르지 않아요</strong><span>정식 계정으로 달리면 랭킹에 이름을 올릴 수 있어요.</span></>
              : <><strong>{offset ? `${periodLabel(kind, offset)}에는 기록이 없어요` : '아직 랭킹 기록이 없어요'}</strong>{!offset && <button type="button" className="btn primary" onClick={onRun}>달리러 가기</button>}</>}
          </div>
          {!result.items.length ? <p className="account-empty">{offset ? `${periodLabel(kind, offset)} 기록이 없어요.` : '첫 번째 러너가 되어 보세요!'}</p> : <>
            <ol className="ranking-podium" aria-label="1위부터 3위">
              {podium.map(row => <li key={row.rank + row.nickname} className={`place-${row.rank}${row.me ? ' me' : ''}`}>
                <span className="podium-medal"><LuMedal /> {row.rank}위</span>
                <RunnerName row={row} showLevel={kind !== 'level'} />
                <strong>{boardValue(kind, row).main}</strong>
                <small>{boardValue(kind, row).sub}</small>
              </li>)}
            </ol>
            {rest.length > 0 && <ol className="ranking-list" start={4} aria-label="4위부터">
              {rest.map(row => <li key={row.rank + row.nickname} className={row.me ? 'me' : ''}>
                <span className="ranking-rank">{row.rank}</span>
                <RunnerName row={row} showLevel={kind !== 'level'} />
                <span className="ranking-km">{boardValue(kind, row).main}<small>{boardValue(kind, row).sub}</small></span>
              </li>)}
            </ol>}
            {result.participants > result.items.length && <p className="note">상위 {result.items.length}명까지 보여줘요.</p>}
          </>}
        </>}
    </section>
  </div>
}
