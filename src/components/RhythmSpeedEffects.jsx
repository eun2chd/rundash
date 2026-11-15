import { useEffect, useRef } from 'react'

export default function RhythmSpeedEffects({ sim }) {
  const root = useRef()
  const remaining = useRef()
  useEffect(() => {
    let raf
    const update = () => {
      const s = sim.current
      const left = s.rhythmBoostLeft || 0
      const active = left > 0 && !s.paused && !s.resting && !s.finished
      root.current.style.opacity = active ? Math.min(1, left / .5) : 0
      root.current.dataset.active = String(active)
      remaining.current.textContent = `${left.toFixed(1)}s`
      raf = requestAnimationFrame(update)
    }
    update()
    return () => cancelAnimationFrame(raf)
  }, [sim])
  return <div ref={root} className="rhythm-speed-effects" aria-hidden="true">
    <div className="rhythm-speed-rays">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ '--ray-angle': `${i * 360 / 22}deg`, '--ray-delay': `${-(i % 7) * .09}s`, '--ray-length': `${50 + i % 4 * 24}px` }} />)}</div>
    <div className="rhythm-speed-badge"><strong>⚡ 리듬 부스트</strong><span>속도 +5% · <b ref={remaining} /></span></div>
  </div>
}
