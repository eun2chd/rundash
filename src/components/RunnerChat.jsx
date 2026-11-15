import { memo, useEffect, useRef, useState } from 'react'
import { LuMessageCircle, LuSend, LuX } from 'react-icons/lu'
import { getSettings } from '../lib/settings'
import { api } from '../lib/api'
import { REPORT_REASONS } from '../lib/chat'

export default memo(function RunnerChat({ room, onHide }) {
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
  useEffect(() => { if (pinned.current && list.current) list.current.scrollTop = list.current.scrollHeight }, [room.messages])
  const submit = async (event) => {
    event.preventDefault()
    if (await room.send(draft)) setDraft('')
  }
  return <section className="runner-chat" aria-label="러너 실시간 채팅방">
    <header className="chat-heading"><div><strong><LuMessageCircle /> 러너 라운지</strong><span>{room.connection === 'connected' ? '함께 달리며 이야기해요' : '채팅을 연결하고 있어요…'}</span></div><button className="icon-btn" type="button" aria-label="채팅 숨기기" onClick={onHide}><LuX /></button></header>
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
  </section>
})
