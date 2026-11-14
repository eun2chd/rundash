import { useEffect, useRef } from 'react'
import { LuMusic } from 'react-icons/lu'
import { RHYTHM_WINDOWS, rhythmFrame } from '../lib/rhythm'

export default function RhythmBar({ rhythm, judge, onBeat, cadence, disabled }) {
  const marker = useRef()
  const track = useRef()
  useEffect(() => {
    let raf
    const loop = () => {
      const frame = rhythmFrame(rhythm.current)
      if (marker.current) marker.current.style.left = `${frame.phase * 100}%`
      track.current?.classList.toggle('hot', frame.hot && !disabled)
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [rhythm, disabled])
  return <section className="rhythm" aria-label="리듬 러닝">
    <div className="rhythm-head"><strong><LuMusic /> 리듬 러닝</strong><span>중앙에서 Space · {cadence} spm</span></div>
    <p className="sr-only">움직이는 커서가 중앙 초록 구간에 들어오면 Space 또는 터치 버튼을 눌러주세요.</p>
    <div className="rhythm-track" ref={track} aria-hidden="true">
      <div className="rhythm-zone good-zone" style={{ width: `${RHYTHM_WINDOWS.good * 2 / rhythm.current.period * 100}%` }} />
      <div className="rhythm-zone perfect-zone" style={{ width: `${RHYTHM_WINDOWS.perfect * 2 / rhythm.current.period * 100}%` }} />
      <span className="rhythm-center-line" />
      <div className="rhythm-marker" ref={marker} />
    </div>
    <div className="rhythm-feedback" role="status"><span className={judge ? `judge-${judge.res.toLowerCase()}` : ''}>{disabled ? '일시정지 / 회복 중' : judge ? `${judge.res}${judge.points ? ` +${judge.points}pt` : ' · 다음 박자에 다시!'}` : '중앙의 밝은 구간은 PERFECT'}</span><button type="button" className="rhythm-hit" onClick={onBeat} disabled={disabled}>Space / 터치</button></div>
  </section>
}
