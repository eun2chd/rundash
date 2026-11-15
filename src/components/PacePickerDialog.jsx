import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LuLock, LuMinus, LuPlus, LuX } from 'react-icons/lu'
import { fmtPace, fmtTime, fmtKm } from '../lib/pace'
import { progressionFor } from '../lib/progression'
import { FREE_PACE_LEVEL, PACE_PRESETS, PACE_STEP, SLOWEST_PACE, clampPace, customDrain, effortLabel, unlockLevelFor, validCustomPace } from '../lib/pacePlans'

export default function PacePickerDialog({ xp, distanceKm, value, onSelect, onClose }) {
  const ref = useRef(null)
  const titleId = useId()
  const { level, fastestPace } = progressionFor(xp)
  const freeUnlocked = level >= FREE_PACE_LEVEL
  // Start from the saved pace, else the unlocked preset nearest the "steady" pace.
  const [pace, setPace] = useState(() => validCustomPace(value, level) ? value
    : PACE_PRESETS.filter(p => validCustomPace(p, level)).reduce((best, p) => Math.abs(p - fastestPace - 60) < Math.abs(best - fastestPace - 60) ? p : best))
  useEffect(() => {
    const element = ref.current
    element.showModal()
    return () => element.close()
  }, [])
  const nudge = (delta) => setPace(current => clampPace(current + delta, level))
  const drain = customDrain(pace, fastestPace)
  return createPortal(<dialog ref={ref} className="confirm-dialog pace-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="share-dialog-head"><h2 id={titleId}>내 페이스 고르기</h2><button type="button" className="icon-btn" aria-label="닫기" onClick={onClose}><LuX /></button></div>
    <p className="pace-dialog-sub">Lv.{level} · 지금 가장 빠른 페이스 <b>{fmtPace(fastestPace)}/km</b></p>

    <h3 className="pace-section-title">레벨별 페이스</h3>
    <div className="pace-presets" role="radiogroup" aria-label="레벨별 페이스">
      {PACE_PRESETS.map(preset => {
        const unlocked = validCustomPace(preset, level)
        const needed = unlockLevelFor(preset)
        return <button type="button" role="radio" key={preset} aria-checked={pace === preset} disabled={!unlocked} className={`pace-preset${pace === preset ? ' on' : ''}${unlocked ? '' : ' locked'}`} onClick={() => setPace(preset)}>
          <strong>{fmtPace(preset)}</strong>
          {unlocked ? <small>{effortLabel(customDrain(preset, fastestPace))}</small> : <small><LuLock /> Lv.{needed ?? '?'}부터</small>}
        </button>
      })}
    </div>

    <h3 className="pace-section-title">자유 설정</h3>
    {freeUnlocked ? <div className="pace-free">
      <div className="pace-stepper">
        <button type="button" className="icon-btn" aria-label={`${PACE_STEP}초 빠르게`} disabled={pace <= fastestPace} onClick={() => nudge(-PACE_STEP)}><LuMinus /></button>
        <output aria-live="polite">{fmtPace(pace)}<small>/km</small></output>
        <button type="button" className="icon-btn" aria-label={`${PACE_STEP}초 느리게`} disabled={pace >= SLOWEST_PACE} onClick={() => nudge(PACE_STEP)}><LuPlus /></button>
      </div>
      <input type="range" aria-label="페이스" min={fastestPace} max={SLOWEST_PACE} step={PACE_STEP} value={pace} onChange={e => setPace(clampPace(Number(e.target.value), level))} style={{ direction: 'rtl' }} />
      <div className="pace-range-labels"><span>느리게 {fmtPace(SLOWEST_PACE)}</span><span>빠르게 {fmtPace(fastestPace)}</span></div>
    </div> : <div className="pace-free locked"><LuLock /><p><b>Lv.{FREE_PACE_LEVEL}부터</b> 원하는 페이스를 {PACE_STEP}초 단위로 직접 정할 수 있어요. 지금은 Lv.{level}이에요.</p></div>}

    <div className="pace-summary">
      <div><span>선택한 페이스</span><b>{fmtPace(pace)}/km</b></div>
      <div><span>{fmtKm(distanceKm)}km 예상</span><b>{fmtTime(pace * distanceKm)}</b></div>
      <div><span>체력 소모</span><b>{effortLabel(drain)}</b></div>
    </div>
    <div className="confirm-actions">
      <button type="button" className="btn ghost" onClick={onClose}>취소</button>
      <button type="button" className="btn primary" disabled={!validCustomPace(pace, level)} onClick={() => onSelect(pace)}>이 페이스로 정하기</button>
    </div>
  </dialog>, document.body)
}
