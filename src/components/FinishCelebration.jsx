import { useMemo, useState } from 'react'
import { LuFlag, LuTrophy } from 'react-icons/lu'
import { fmtTime } from '../lib/pace'
import { num } from '../lib/format'

const CONFETTI_COLORS = ['#e07b39', '#5f6b3c', '#f4c95d', '#fff8e6', '#7cb7a3']

// Shown over the 3D course when the runner crosses the line. The run is saved only when
// the runner opens the results (or leaves through a menu), so they can enjoy the moment first.
export default function FinishCelebration({ distanceKm, elapsedSec, onResults }) {
  const [minimized, setMinimized] = useState(false)
  const [busy, setBusy] = useState(false)
  const pieces = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    left: `${(i * 37) % 100}%`, delay: `${(i % 12) * 0.12}s`, duration: `${2.4 + (i % 5) * 0.35}s`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], rotate: `${(i * 47) % 360}deg`,
  })), [])
  const open = () => { if (busy) return; setBusy(true); onResults() }
  return <>
    <div className="finish-confetti" aria-hidden="true">{pieces.map((piece, i) => <i key={i} style={{ left: piece.left, animationDelay: piece.delay, animationDuration: piece.duration, background: piece.color, rotate: piece.rotate }} />)}</div>
    {minimized
      ? <button type="button" className="btn primary finish-results-pill" disabled={busy} onClick={open}><LuFlag /> {busy ? '저장 중…' : '결과 보기'}</button>
      : <section className="finish-card" role="dialog" aria-modal="false" aria-labelledby="finish-title">
        <div className="finish-trophy" aria-hidden="true"><LuTrophy /></div>
        <div className="eyebrow">FINISH</div>
        <h2 id="finish-title">완주했어요!</h2>
        <p className="finish-stats"><b>{num(distanceKm, 2)}km</b> · {fmtTime(elapsedSec)}</p>
        <p>결과 화면으로 이동해서 경험치와 기록을 확인할까요?</p>
        <div className="finish-actions">
          <button type="button" className="btn ghost" disabled={busy} onClick={() => setMinimized(true)}>조금 더 즐기기</button>
          <button type="button" className="btn primary" disabled={busy} onClick={open}>{busy ? '기록 저장 중…' : '결과 보기'}</button>
        </div>
        <small>결과를 열거나 다른 메뉴로 이동할 때 기록이 저장돼요.</small>
      </section>}
  </>
}
