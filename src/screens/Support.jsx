import { useEffect, useState } from 'react'
import { LuMessageCircle, LuSend } from 'react-icons/lu'
import { api } from '../lib/api'

export const SUPPORT_TYPES = { bug: '버그 신고', feature: '기능 제안', account: '계정 문의', running: '러닝 문의', other: '기타 건의' }
export const SUPPORT_STATUS = { open: '접수 완료', reviewing: '검토 중', planned: '반영 예정', resolved: '답변 완료', closed: '종료' }

export default function Support({ suspended }) {
  const [category, setCategory] = useState('bug')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tickets, setTickets] = useState([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let live = true
    setLoading(true)
    api.listSupport().then(rows => { if (live) setTickets(rows) }).catch(() => { if (live) setError('문의 내역을 불러오지 못했어요. 다시 불러오기를 눌러주세요.') }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [refresh])
  const submit = async (event) => {
    event.preventDefault()
    if (busy || title.trim().length < 2 || body.trim().length < 10) return
    setBusy(true); setError(''); setNotice('')
    try {
      await api.submitSupport({ category, title: title.trim(), body: body.trim() })
      setTitle(''); setBody(''); setNotice('문의를 접수했어요. 아래 문의 내역에서 답변을 확인할 수 있어요.'); setRefresh(n => n + 1)
    } catch (err) { setError(err.message || '문의를 접수하지 못했어요.') } finally { setBusy(false) }
  }
  return <div className="support-screen">
    <section className="card support-form"><span className="eyebrow">RUN DASH SUPPORT</span><h1><LuMessageCircle /> 문의하기</h1><p>불편했던 점, 함께 만들고 싶은 기능을 들려주세요.</p>
      {suspended && <p className="account-notice">현재 이용이 제한된 계정이에요. 계정 문의로 연락해 주세요.</p>}
      <form onSubmit={submit}><fieldset disabled={busy}><legend className="sr-only">문의 작성</legend><label className="field"><span>문의 유형</span><select value={category} onChange={e => setCategory(e.target.value)}>{Object.entries(SUPPORT_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="field"><span>제목</span><input required minLength={2} maxLength={100} value={title} placeholder="어떤 이야기를 남기고 싶으신가요?" onChange={e => setTitle(e.target.value)} /><small>{title.length}/100</small></label><label className="field"><span>내용</span><textarea required minLength={10} maxLength={4000} rows={8} value={body} placeholder={category === 'bug' ? '어떤 화면에서 어떤 행동을 했을 때 문제가 생겼나요? 기대한 동작과 실제 동작을 함께 알려주세요.' : '제안하거나 문의할 내용을 자세히 적어주세요.'} onChange={e => setBody(e.target.value)} /><small>{body.length}/4000 · 비밀번호 등 민감한 정보는 적지 마세요.</small></label></fieldset>
        {error && <p className="error" role="alert">{error}</p>}{notice && <p className="account-notice" role="status">{notice}</p>}
        <button className="btn primary" disabled={busy || title.trim().length < 2 || body.trim().length < 10}><LuSend />{busy ? '접수 중…' : '문의 보내기'}</button>
      </form>
    </section>
    <section className="card support-history"><div className="section-heading"><h2>내 문의 내역</h2><button className="btn ghost" disabled={loading || busy} onClick={() => { setError(''); setRefresh(n => n + 1) }}>다시 불러오기</button></div><p>최근 문의 100개를 확인할 수 있어요. 답변은 이곳에 표시됩니다.</p>
      {loading ? <p role="status">문의 내역을 불러오고 있어요…</p> : tickets.length ? tickets.map(ticket => <details className="ticket-card" key={ticket.id}><summary><span className={`status-badge status-${ticket.status}`}>{SUPPORT_STATUS[ticket.status]}</span><strong>{ticket.title}</strong><small>{SUPPORT_TYPES[ticket.category]} · {new Date(ticket.created_at).toLocaleDateString('ko-KR')}</small></summary><p className="ticket-body">{ticket.body}</p>{ticket.reply ? <div className="ticket-reply"><strong>운영팀 답변</strong><p>{ticket.reply}</p><small>{new Date(ticket.updated_at).toLocaleString('ko-KR')}</small></div> : <p>아직 답변이 등록되지 않았어요.</p>}</details>) : <div className="account-empty"><LuMessageCircle /><p>접수한 문의가 없어요. 작은 의견도 편하게 남겨주세요.</p></div>}
    </section>
  </div>
}
