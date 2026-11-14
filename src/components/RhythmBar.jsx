import { useEffect, useRef } from 'react'

// 박자 게임: 마커가 오른쪽 끝(=박자)에 닿을 때 Space / 탭
export default function RhythmBar({ rhythm, judge, onBeat, cadence }) {
  const marker = useRef()
  const track = useRef()
  useEffect(() => {
    let raf
    const loop = () => {
      const r = rhythm.current
      const p = (((performance.now() - r.start) / 1000) % r.period) / r.period
      if (marker.current) marker.current.style.left = `${p * 100}%`
      if (track.current) track.current.classList.toggle('hot', p > 0.9 || p < 0.06)
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [rhythm])

  return (
    <div className="rhythm">
      <div className="rhythm-head">
        <span>리듬 러닝</span>
        <span className="muted">{cadence} spm · 박자에 맞춰 Space</span>
      </div>
      <div className="rhythm-track" ref={track} onPointerDown={onBeat}>
        <div className="rhythm-zone right" />
        <div className="rhythm-zone left" />
        <div className="rhythm-marker" ref={marker} />
      </div>
      {judge && (
        <div key={judge.at} className={`judge judge-${judge.res.toLowerCase()}`}>
          {judge.res}
          {judge.combo > 1 && judge.res !== 'MISS' ? ` · ${judge.combo} 콤보` : ''}
        </div>
      )}
    </div>
  )
}
