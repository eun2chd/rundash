import { useEffect, useRef } from 'react'
import { LuMusic } from 'react-icons/lu'
import { RHYTHM_WINDOWS, rhythmFrame } from '../lib/rhythm'

export default function RhythmBar({ rhythm, judge, onBeat, cadence = 168, disabled, demo = false }) {
  const marker = useRef()
  const track = useRef()
  const result = judge?.res.toLowerCase()
  const period = demo ? (4 * 60) / cadence : rhythm.current.period
  useEffect(() => {
    if (demo) return
    let raf
    const loop = () => {
      const frame = rhythmFrame(rhythm.current)
      if (marker.current) marker.current.style.left = `${frame.phase * 100}%`
      track.current?.classList.toggle('hot', frame.hot && !disabled)
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [rhythm, disabled, demo])

  const timingTrack = <div className="rhythm-track" ref={track} aria-hidden="true" style={demo ? { '--rhythm-period': `${period}s` } : undefined}>
    <div className="rhythm-zone good-zone" style={{ width: `${RHYTHM_WINDOWS.good * 2 / period * 100}%` }} />
    <div className="rhythm-zone perfect-zone" style={{ width: `${RHYTHM_WINDOWS.perfect * 2 / period * 100}%` }} />
    <span className="rhythm-center-line" />
    <div className="rhythm-marker" ref={marker} />
  </div>

  if (demo) return <div className="rhythm-demo" role="img" aria-label="리듬 바 예시. 바깥 회색 구간은 MISS, 연두색 구간은 GOOD, 중앙의 진한 초록 구간은 PERFECT예요.">{timingTrack}</div>

  return <section className="rhythm" aria-label="리듬 러닝">
    {judge && !disabled && <div key={judge.at} className={`rhythm-fx rhythm-fx-${result}`} aria-hidden="true">
      <div className="rhythm-fx-flash" />
      <div className="rhythm-fx-burst">
        <span className="rhythm-fx-ring" />
        {result !== 'miss' && Array.from({ length: result === 'perfect' ? 10 : 6 }, (_, i) => <i key={i} style={{ '--angle': `${i * 360 / (result === 'perfect' ? 10 : 6)}deg` }} />)}
        <strong>{result === 'perfect' ? '✦ PERFECT ✦' : result === 'good' ? '✓ GOOD' : 'MISS'}</strong>
        {judge.combo > 1 && <small>{judge.combo} COMBO</small>}
        {judge.boosted && <small>리듬 부스트! +5%</small>}
      </div>
    </div>}
    <div className="rhythm-head"><strong><LuMusic /> 리듬 러닝</strong><span>중앙에서 Space · {cadence} spm</span></div>
    <p className="sr-only">움직이는 커서가 중앙 초록 구간에 들어오면 Space 또는 터치 버튼을 눌러주세요.</p>
    {timingTrack}
    <div className="rhythm-feedback" role="status"><span key={judge?.at} className={judge && !disabled ? `rhythm-judge judge-${result}` : ''}>{disabled ? '일시정지 / 회복 중' : judge ? `${judge.res}${judge.points ? ` +${judge.points}pt` : ' · 다음 박자에 다시!'}` : '중앙의 진한 초록 구간은 PERFECT'}</span><button type="button" className="rhythm-hit" onClick={onBeat} disabled={disabled}>Space / 터치</button></div>
  </section>
}
