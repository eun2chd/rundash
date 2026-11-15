import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { LuUser, LuX } from 'react-icons/lu'
import { OUTFIT_CATEGORIES, normalizeOutfit } from '../lib/outfit'
import { fmtPace, fmtTime } from '../lib/pace'

const number = value => typeof value === 'number' && Number.isFinite(value)
export default function RunnerDetails({ member, connected, photo, loadPhoto, onClose }) {
  const dialog = useRef()
  const titleId = useId()
  const r = member.runner
  const outfit = r?.outfit ? normalizeOutfit(r.outfit) : null
  useEffect(() => {
    const previous = document.activeElement
    const element = dialog.current
    element.showModal()
    return () => { element.close(); if (previous?.isConnected) previous.focus() }
  }, [])
  useEffect(() => { loadPhoto(member.id) }, [loadPhoto, member.id])
  const pace = r && number(r.speed) && r.speed > 0 && member.status === 'running' && !r.resting && !r.finished ? fmtPace(1000 / r.speed) : '휴식 / 정지'
  return createPortal(<dialog ref={dialog} className="runner-details" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose() }} onKeyDown={event => event.stopPropagation()}>
    <header><span className="eyebrow">RUNNER PROFILE</span><button type="button" className="icon-btn" aria-label="러너 정보 닫기" onClick={onClose} autoFocus><LuX /></button></header>
    <div className="runner-details-person">{photo ? <img src={photo} alt={`${member.nickname} 프로필 사진`} /> : <span className="account-avatar"><LuUser /></span>}<div><h2 id={titleId}>{member.nickname}</h2><p>{!connected ? '접속 종료 · 마지막 정보' : member.status === 'running' ? r?.resting ? '체력 회복 중' : '달리는 중' : '쉬는 중'}{r && (r.anonymous ? ' · 익명 러너' : number(r.level) ? ` · Lv.${r.level}` : '')}</p></div></div>
    {r ? <>
      <dl className="runner-details-stats">
        {[
          ['현재 페이스', pace], ['기준 페이스', number(r.paceSec) ? fmtPace(r.paceSec) : '확인 중'],
          ['달린 거리', number(r.distance) ? `${(r.distance / 1000).toFixed(2)} km` : '확인 중'], ['목표 거리', number(r.targetKm) ? `${r.targetKm} km` : '확인 중'],
          ['달린 시간', number(r.elapsed) ? fmtTime(r.elapsed) : '확인 중'], ['체력', number(r.stamina) && number(r.maxStamina) ? `${Math.round(r.stamina)} / ${r.maxStamina}` : '확인 중'],
          ['러닝 강도', r.intensity || '확인 중'], ['부스트', [r.booster ? '부스터 사용 중' : '', r.rhythmBoost ? '리듬 +5%' : ''].filter(Boolean).join(' · ') || '기본'],
          ['코스 날씨', r.weatherLabel || '확인 중'], ['날씨 영향', number(r.weatherDrain) ? `체력 소모 ${r.weatherDrain > 0 ? `+${r.weatherDrain}%` : '기본'}` : '확인 중'],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <p className="runner-details-note">현재 페이스는 체력·부스트를 반영해 약 3초마다 갱신돼요. 날씨는 체력 소모에 영향을 줍니다.</p>
      <h3>착용 장비</h3>
      {outfit ? <ul className="runner-details-gear">{OUTFIT_CATEGORIES.map(category => <li key={category.id}><span>{category.label}</span><strong>{category.color && <i style={{ background: outfit[category.color] }} />}{category.options.find(([id]) => id === outfit[category.id])?.[1].replace('벗기', '미착용')}</strong></li>)}</ul> : <p>장비 정보를 확인하고 있어요.</p>}
    </> : <p className="runner-details-note">이 러너의 상세 정보가 아직 공유되지 않았어요. 상대방이 최신 화면으로 접속하면 표시됩니다.</p>}
    <button type="button" className="btn primary" onClick={onClose}>닫기</button>
  </dialog>, document.body)
}
