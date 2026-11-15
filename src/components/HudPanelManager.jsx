import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { LuX } from 'react-icons/lu'

export const HUD_PANELS = [
  ['pace', '현재 페이스'], ['stamina', '체력'], ['records', '거리·시간 기록'],
  ['info', '코스·성장·보급소 안내'], ['score', '러닝 점수'], ['activity', '활동 상태 선택'],
  ['cloud', '구름 말풍선'], ['map', '미니맵'], ['group', '함께 달리는 그룹'],
  ['music', '음악 패널'], ['weather', '코스 날씨'], ['presence', '접속 중인 러너'],
  ['chat', '러너 라운지'], ['supply', '보급 선택'], ['rhythm', '리듬 러닝'],
  ['controls', '하단 조작 버튼'], ['hints', '단축키 안내'], ['notifications', '알림'], ['recovery', '회복 상태'],
  ...(import.meta.env.DEV ? [['debug', '개발 도구']] : []),
]

export default function HudPanelManager({ visible, onToggle, onAll, onClose }) {
  const ref = useRef()
  const titleId = useId()
  useEffect(() => {
    const previous = document.activeElement
    const dialog = ref.current
    dialog.showModal()
    return () => { dialog.close(); if (previous?.isConnected) previous.focus() }
  }, [])
  return createPortal(<dialog ref={ref} className="hud-panel-manager" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose() }} onKeyDown={event => event.stopPropagation()}>
    <header><div><h2 id={titleId}>화면 관리</h2><p>보고 싶은 상태창만 켜두세요.</p></div><button type="button" className="icon-btn" aria-label="화면 관리 닫기" onClick={onClose}><LuX /></button></header>
    <div className="hud-panel-actions"><button type="button" onClick={() => onAll(true)}>모두 보이기</button><button type="button" onClick={() => onAll(false)}>모두 숨기기</button></div>
    <div className="hud-panel-options">{HUD_PANELS.map(([id, label]) => <label key={id}><span>{label}</span><input type="checkbox" checked={visible(id)} onChange={() => onToggle(id)} /></label>)}</div>
    <p className="hud-panel-note">숨겨도 러닝과 음악 재생은 계속돼요. 나가기·화면 관리·친구 버튼은 항상 남아 있어요.</p>
    <button type="button" className="btn primary" onClick={onClose}>완료</button>
  </dialog>, document.body)
}
