import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LuMessageCircle, LuSend, LuX, LuRotateCcw, LuMinus, LuChevronUp, LuMove } from 'react-icons/lu'
import { getSettings } from '../lib/settings'
import { api } from '../lib/api'
import { REPORT_REASONS } from '../lib/chat'
import { clampPanel } from '../lib/floatingPanel'

export default memo(function RunnerChat({ room, onHide }) {
  const panel = useRef()
  const drag = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [unread, setUnread] = useState(false)
  const minimizedAt = useRef(0)
  const seenOnMinimize = useRef(new Set())
  const toggleMinimized = () => {
    if (!minimized) {
      minimizedAt.current = Date.now()
      seenOnMinimize.current = new Set(room.messages.map(message => message.id))
    } else pinned.current = true
    setUnread(false)
    setMinimized(value => !value)
  }
  useEffect(() => {
    if (minimized && room.messages.some(message => !seenOnMinimize.current.has(message.id) && message.user_id !== room.userId && Date.parse(message.created_at) >= minimizedAt.current)) setUnread(true)
  }, [room.messages, room.userId, minimized])
  const [position, setPosition] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('rundash:chat-position'))
      if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) return saved
    } catch { /* Fall back to the left side. */ }
    return { x: 14, y: Math.round(window.innerHeight * .45) }
  })
  const bounded = value => clampPanel(value, panel.current.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight })
  const resetPosition = () => setPosition(bounded({ x: 14, y: window.innerHeight * .45 }))
  useLayoutEffect(() => {
    const fit = () => setPosition(previous => {
      const next = bounded(previous)
      return next.x === previous.x && next.y === previous.y ? previous : next
    })
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(panel.current)
    window.addEventListener('resize', fit)
    return () => { observer.disconnect(); window.removeEventListener('resize', fit) }
  }, [])
  useEffect(() => {
    if (!dragging) try { localStorage.setItem('rundash:chat-position', JSON.stringify(position)) } catch { /* Position still works without storage. */ }
  }, [position, dragging])
  const startDrag = event => {
    if (event.button !== 0 || event.target.closest('button')) return
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id: event.pointerId, x: event.clientX - position.x, y: event.clientY - position.y }
    setDragging(true)
  }
  const moveDrag = event => {
    if (drag.current?.id !== event.pointerId) return
    setPosition(bounded({ x: event.clientX - drag.current.x, y: event.clientY - drag.current.y }))
  }
  const stopDrag = () => { drag.current = null; setDragging(false) }
  const [draft, setDraft] = useState('')
  const [reporting, setReporting] = useState(null)
  const [reportBusy, setReportBusy] = useState(false)
  const [reported, setReported] = useState(() => new Set())
  const [reportNotice, setReportNotice] = useState(null)
  const report = async (id, reason) => {
    setReportBusy(true); setReportNotice(null)
    try { await api.reportMessage(id, reason); setReported(previous => new Set(previous).add(id)); setReporting(null); setReportNotice({ ok: true, text: '신고를 접수했어요. 운영팀이 확인할게요.' }) }
    catch (err) { setReportNotice({ ok: false, text: err.message || '신고하지 못했어요. 잠시 후 다시 시도해 주세요.' }) }
    finally { setReportBusy(false) }
  }
  const list = useRef(null)
  const pinned = useRef(true)
  useEffect(() => { if (!minimized && pinned.current && list.current) list.current.scrollTop = list.current.scrollHeight }, [room.messages, minimized])
  const submit = async (event) => {
    event.preventDefault()
    if (await room.send(draft)) setDraft('')
  }
  return createPortal(<section ref={panel} className={`runner-chat floating-runner-chat${dragging ? ' is-dragging' : ''}${minimized ? ' is-minimized' : ''}`} style={{ left: position.x, top: position.y }} aria-label="러너 실시간 채팅방">
    <header className="chat-heading chat-drag-handle" tabIndex={0} aria-label="러너 라운지 위치 이동. 드래그하거나 방향키로 이동하세요." onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag} onKeyDown={event => {
      if (event.target !== event.currentTarget) return
      const offset = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
      if (!offset) return
      event.preventDefault(); event.stopPropagation()
      const step = event.shiftKey ? 40 : 10
      setPosition(previous => bounded({ x: previous.x + offset[0] * step, y: previous.y + offset[1] * step }))
    }}><div><strong><LuMessageCircle /> 러너 라운지{minimized && unread && <span className="chat-unread-dot" role="status" aria-label="새 메시지가 있어요" />}<LuMove className="chat-move-indicator" aria-hidden="true" /></strong>{!minimized && room.connection !== 'connected' && <span>채팅을 연결하고 있어요…</span>}</div><div className="chat-window-actions"><button className="icon-btn" type="button" title="위치 초기화" aria-label="채팅 위치 초기화" onClick={resetPosition}><LuRotateCcw /></button><button className="icon-btn" type="button" title={minimized ? '채팅 펼치기' : '채팅 최소화'} aria-label={minimized ? '채팅 펼치기' : '채팅 최소화'} aria-expanded={!minimized} onClick={toggleMinimized}>{minimized ? <LuChevronUp /> : <LuMinus />}</button><button className="icon-btn" type="button" aria-label="채팅 숨기기" onClick={onHide}><LuX /></button></div></header>
    <div className="chat-messages" ref={list} role="log" aria-label="실시간 대화" aria-live="polite" aria-relevant="additions" onScroll={() => { const element = list.current; pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 50 }}>
      {room.messages.length === 0 && <div className="chat-empty"><LuMessageCircle /><p>아직 대화가 없어요.<br />달리는 러너에게 인사를 건네보세요.</p></div>}
      {room.messages.map((message) => <article key={message.id} className={`chat-message ${message.user_id === room.userId ? 'mine' : ''}`}><div className="chat-author"><strong>{message.nickname}</strong>{message.is_anonymous && <span>익명</span>}<time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</time>{message.user_id !== room.userId && (reported.has(message.id) ? <span className="chat-reported">신고됨</span> : <button type="button" className="chat-report" aria-label={`${message.nickname}님의 메시지 신고`} aria-expanded={reporting === message.id} onClick={() => setReporting(id => id === message.id ? null : message.id)}>신고</button>)}</div><p>{message.message}</p>{reporting === message.id && <div className="chat-report-reasons" role="group" aria-label="신고 사유">{Object.entries(REPORT_REASONS).map(([reason, label]) => <button type="button" key={reason} disabled={reportBusy} onClick={() => report(message.id, reason)}>{label}</button>)}</div>}</article>)}
    </div>
    {room.error && <p className="chat-error" role="alert">{room.error}</p>}
    {reportNotice && <p className={`chat-error${reportNotice.ok ? ' chat-notice' : ''}`} role="status">{reportNotice.text}</p>}
    <form className="chat-compose" onSubmit={submit}>
      <label className="sr-only" htmlFor="race-chat-message">채팅 메시지</label>
      <input id="race-chat-message" value={draft} maxLength={getSettings().chatMaxLength} autoComplete="off" placeholder="러너들과 이야기해요" disabled={room.sending} onChange={(event) => setDraft(event.target.value)} />
      <button type="submit" className="chat-send" aria-label="메시지 보내기" disabled={room.sending || !draft.trim() || room.connection !== 'connected'}><LuSend /></button>
    </form>
    <div className="chat-footer">Enter로 보내기 · {draft.length}/{getSettings().chatMaxLength}</div>
  </section>, document.body)
})
