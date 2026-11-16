import { useState } from 'react'
import Modal from 'react-modal'
import { LuX } from 'react-icons/lu'
import { num } from '../lib/format'
import { fmtPace, fmtTime } from '../lib/pace'

export const INTENSITY_LABELS = { easy: '가볍게', steady: '꾸준히', challenge: '도전하기', custom: '내 페이스' }
const date = value => value ? new Date(value).toLocaleString('ko-KR') : '없음'
const fact = (label, value) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>

// Saved run details, or closing an open run: header / body / footer.
export default function AdminRunModal({ run, mode, busy, onClose, onCloseRun }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const locked = busy || working
  const closing = mode === 'close'
  const submit = async event => {
    event.preventDefault()
    if (locked || reason.trim().length < 2) return
    setWorking(true); setError('')
    try { await onCloseRun(reason.trim()) }
    catch (err) { setError(err.message || '러닝을 종료하지 못했어요. 다시 시도해 주세요.') }
    finally { setWorking(false) }
  }
  const d = run.details || {}, growth = d.growth || {}
  const facts = closing ? [
    fact('러너', run.nickname), fact('시작', date(run.started_at)),
    fact('경과', fmtTime((Date.now() - Date.parse(run.started_at)) / 1000)), fact('목표 거리', `${num(run.target_km)} km`),
    fact('현재 거리', run.distance_m === null || run.distance_m === undefined ? '위치 기록 없음' : `${num(run.distance_m / 1000, 2)} km`),
    fact('강도', INTENSITY_LABELS[run.intensity] || run.intensity), fact('목표 페이스', `${fmtPace(run.pace_sec)}/km`),
    fact('마지막 신호', date(run.location_at)),
  ] : [
    fact('러너', `${run.nickname}${run.is_test ? ' (테스트)' : ''}`), fact('저장', date(run.created_at)),
    fact('결과', d.practice ? '체험 처리 (XP 없음)' : d.completed ? '완주' : '중간 종료'), fact('AUTO', d.autoUsed ? '사용' : '사용 안 함'),
    fact('거리', `${num(d.distanceKm || 0, 2)} / ${num(d.targetKm || 0)} km`), fact('시간', fmtTime(d.elapsedSec || 0)),
    fact('평균 페이스', d.paceSec ? `${fmtPace(d.paceSec)}/km` : '없음'), fact('목표 페이스', d.targetPaceSec ? `${fmtPace(d.targetPaceSec)}/km` : '없음'),
    fact('강도', INTENSITY_LABELS[d.intensity] || d.intensity || '없음'), fact('점수', `${num(d.score || 0)} pt`),
    fact('보급', `${num(d.supplies || 0)} / ${num(d.suppliesTotal || 0)}`), fact('메달', `${num(d.medals || 0)} / ${num(d.medalsTotal || 0)}`),
    fact('최대 콤보', num(d.maxCombo || 0)), fact('리듬 판정', `PERFECT ${num(d.perfect || 0)} · GOOD ${num(d.good || 0)}`),
    fact('부스터', `${num(d.boostUses || 0)}회`), fact('탈진', `${num(d.exhaustCount || 0)}회`),
    fact('경험치', `+${num(growth.xpEarned || 0)} XP`), fact('경험치 구성', `거리 ${num(growth.distanceXp || 0)} · 완주 ${num(growth.completionXp || 0)} · 점수 ${num(growth.scoreXp || 0)}`),
    fact('레벨', growth.levelBefore ? `Lv.${growth.levelBefore} → Lv.${growth.levelAfter}` : '없음'),
  ]
  return <Modal isOpen onRequestClose={locked ? undefined : onClose}
    appElement={document.getElementById('root')} shouldCloseOnOverlayClick={false} shouldCloseOnEsc={!locked}
    className="admin-member-modal" overlayClassName="admin-modal-overlay" bodyOpenClassName="admin-modal-open"
    aria={{ labelledby: 'run-modal-title' }}>
    <header className="admin-modal-header"><h2 id="run-modal-title">{closing ? '진행 중인 러닝 종료' : '러닝 기록 상세'}</h2><button type="button" className="icon-btn" aria-label="닫기" disabled={locked} onClick={onClose}><LuX /></button></header>
    <form className="admin-modal-form" onSubmit={submit}>
      <div className="admin-modal-body">
        <dl className="admin-member-facts">{facts}</dl>
        {closing && <>
          {run.stale && <p className="admin-action-warning">24시간 넘게 끝나지 않은 러닝이에요.</p>}
          <p className="admin-modal-note">종료하면 경험치 없이 체험 기록으로 끝나고, 러너의 진행 중 러닝·위치·이어 달리기 저장본·같이 달리기가 정리돼요. 러너가 아직 달리고 있다면 기록이 저장되지 않아요.</p>
          <label className="field admin-modal-field"><span>처리 사유 (필수)</span><textarea rows={3} minLength={2} maxLength={500} value={reason} disabled={locked} onChange={e => setReason(e.target.value)} placeholder="사유를 2자 이상 입력하세요" /></label>
        </>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      <footer className="admin-modal-footer">
        {closing ? <><button type="button" className="btn ghost" disabled={locked} onClick={onClose}>취소</button><button className="btn danger" disabled={locked || reason.trim().length < 2}>{working ? '종료 중…' : '러닝 종료'}</button></>
          : <button type="button" className="btn primary" onClick={onClose}>닫기</button>}
      </footer>
    </form>
  </Modal>
}
