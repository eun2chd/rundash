import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LuDownload, LuLink, LuShare2, LuX } from 'react-icons/lu'
import { SHARE_URL, createShareCardBlob } from '../lib/shareCard'

const FILE_NAME = 'rundash-result.png'

export default function ShareCardDialog({ content, getCharacter, onClose }) {
  const ref = useRef(null)
  const titleId = useId()
  const [card, setCard] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const element = ref.current
    element.showModal()
    let url, alive = true
    createShareCardBlob(content, getCharacter())
      .then(blob => { if (!alive) return; url = URL.createObjectURL(blob); setCard({ blob, url, file: new File([blob], FILE_NAME, { type: 'image/png' }) }) })
      .catch(err => { if (alive) setError(err.message) })
    return () => { alive = false; element.close(); if (url) URL.revokeObjectURL(url) }
  }, [])
  const canShareFile = !!card && !!navigator.canShare?.({ files: [card.file] })
  const share = async () => {
    setNotice(''); setError('')
    try { await navigator.share({ files: [card.file], title: 'Run dash 러닝 기록', text: `${content.shareText} ${SHARE_URL}` }) }
    catch (err) { if (err.name !== 'AbortError') setError('공유하지 못했어요. 이미지를 저장해서 올려 주세요.') }
  }
  const save = () => {
    const link = document.createElement('a')
    link.href = card.url
    link.download = FILE_NAME
    link.click()
    setNotice('이미지를 저장했어요. SNS에 올려 자랑해 보세요.')
  }
  const copyLink = async () => {
    setError('')
    try { await navigator.clipboard.writeText(`${content.shareText} ${SHARE_URL}`); setNotice('공유 문구와 링크를 복사했어요.') }
    catch { setError('복사하지 못했어요. rundash.run 주소를 직접 알려 주세요.') }
  }
  return createPortal(<dialog ref={ref} className="confirm-dialog share-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="share-dialog-head"><h2 id={titleId}>러닝 기록 공유하기</h2><button type="button" className="icon-btn" aria-label="닫기" onClick={onClose}><LuX /></button></div>
    <div className="share-preview">{card ? <img src={card.url} alt={`${content.nickname}님의 ${content.distance}km 러닝 기록 카드`} /> : !error && <p role="status">공유 카드를 만들고 있어요…</p>}</div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="account-notice" role="status">{notice}</p>}
    <div className="share-actions">
      {canShareFile && <button type="button" className="btn primary" onClick={share}><LuShare2 />공유하기</button>}
      <button type="button" className={`btn ${canShareFile ? 'ghost' : 'primary'}`} disabled={!card} onClick={save}><LuDownload />이미지 저장</button>
      <button type="button" className="btn ghost" onClick={copyLink}><LuLink />링크 복사</button>
    </div>
  </dialog>, document.body)
}
