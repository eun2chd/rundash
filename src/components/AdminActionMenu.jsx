import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LuBan, LuChevronDown, LuEye, LuKeyRound, LuRotateCcw, LuShieldCheck, LuShieldOff, LuSparkles, LuTrash2 } from 'react-icons/lu'

const MENU_WIDTH = 220

// Member row actions as an aligned menu instead of a native select (whose open list is drawn
// by the OS and cannot be laid out). Rendered in a portal so the scrolling table cannot clip it.
export default function AdminActionMenu({ member, isSelf = false, disabled, onSelect }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState(null)
  const button = useRef(null)
  const menu = useRef(null)
  const menuId = useId()
  const name = member.nickname || member.email || '익명 러너'
  // The signed-in admin's own row cannot be suspended, deleted or demoted from here.
  const self = isSelf ? '나' : ''
  const items = [
    { value: 'details', label: '상세 보기', Icon: LuEye },
    { value: 'xp', label: '경험치 조정', Icon: LuSparkles, blocked: !member.nickname ? '러너 생성 전' : member.active_run_id ? '러닝 중' : '' },
    member.admin
      ? { value: 'revoke-admin', label: '관리자 해제', Icon: LuShieldOff, blocked: self }
      : { value: 'grant-admin', label: '관리자로 지정', Icon: LuShieldCheck, blocked: member.is_anonymous || !member.email ? '회원만' : member.suspended ? '정지 중' : '' },
    { value: 'reset-password', label: '비밀번호 초기화', Icon: LuKeyRound, blocked: self || (member.is_anonymous || !member.email ? '이메일 없음' : member.admin ? '관리자' : '') },
    member.suspended
      ? { value: 'restore', label: '이용 복원', Icon: LuRotateCcw, blocked: self || (member.admin ? '관리자' : '') }
      : { value: 'suspend', label: '이용 정지', Icon: LuBan, blocked: self || (member.admin ? '관리자' : ''), danger: true },
    { value: 'delete', label: '계정 삭제', Icon: LuTrash2, blocked: self || (member.admin ? '관리자' : ''), danger: true, divider: true },
  ]
  const place = () => {
    const rect = button.current.getBoundingClientRect()
    const height = items.length * 40 + 24
    // Open upwards when the row sits too close to the bottom of the window.
    const top = rect.bottom + 6 + height > window.innerHeight ? Math.max(8, rect.top - height - 6) : rect.bottom + 6
    setPosition({ top, left: Math.max(8, Math.min(window.innerWidth - MENU_WIDTH - 8, rect.right - MENU_WIDTH)) })
  }
  const close = (refocus = true) => { setOpen(false); if (refocus) button.current?.focus() }
  useLayoutEffect(() => { if (open) place() }, [open])
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector('[role=menuitem]:not([aria-disabled=true])')?.focus()
    const outside = (event) => { if (!menu.current?.contains(event.target) && !button.current?.contains(event.target)) close(false) }
    const dismiss = () => close(false)
    document.addEventListener('mousedown', outside)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', dismiss, true)
    return () => { document.removeEventListener('mousedown', outside); window.removeEventListener('resize', dismiss); window.removeEventListener('scroll', dismiss, true) }
  }, [open])
  const onKeyDown = (event) => {
    const enabled = [...menu.current.querySelectorAll('[role=menuitem]:not([aria-disabled=true])')]
    const index = enabled.indexOf(document.activeElement)
    if (event.key === 'Escape') { event.preventDefault(); close() }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      enabled[(index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length]?.focus()
    } else if (event.key === 'Tab') close(false)
  }
  const choose = (item) => { if (item.blocked) return; close(); onSelect(item.value) }
  return <>
    <button ref={button} type="button" className="admin-action-trigger" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      aria-label={`${name} 관리 작업`} disabled={disabled} onClick={() => setOpen(value => !value)}>
      관리 선택 <LuChevronDown aria-hidden="true" />
    </button>
    {open && position && createPortal(<ul ref={menu} id={menuId} role="menu" aria-label={`${name} 관리 작업`} className="admin-action-menu" style={{ top: position.top, left: position.left, width: MENU_WIDTH }} onKeyDown={onKeyDown}>
      {items.map(item => <li key={item.value} role="none" className={item.divider ? "divider" : undefined}>
        <button type="button" role="menuitem" aria-disabled={item.blocked ? true : undefined} tabIndex={-1} className={`${item.danger ? 'danger' : ''}${item.blocked ? ' blocked' : ''}`} onClick={() => choose(item)}>
          <item.Icon aria-hidden="true" /><span>{item.label}</span>{item.blocked && <small>{item.blocked}</small>}
        </button>
      </li>)}
    </ul>, document.body)}
  </>
}
