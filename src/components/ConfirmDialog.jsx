import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { LuArrowRight, LuHelpCircle } from 'react-icons/lu'

export default function ConfirmDialog({ title, description, confirmLabel = '이동하기', cancelLabel = '머무르기', onAnswer, onDismiss, focusConfirm = false, eyebrow = 'JUST A MOMENT', resumeShortcut = false }) {
  const dialog = useRef(null)
  const cancel = useRef(null)
  const proceed = useRef(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const element = dialog.current
    element.showModal()
    ;(focusConfirm ? proceed.current : cancel.current)?.focus()
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])
  return createPortal(<dialog ref={dialog} className="confirm-dialog" onKeyDown={event => { event.stopPropagation(); if (resumeShortcut && event.code === 'KeyP') { event.preventDefault(); onDismiss?.() } }} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={(event) => { event.preventDefault(); if (onDismiss) onDismiss(); else onAnswer(false) }}>
    <div className="confirm-symbol" aria-hidden="true"><LuHelpCircle /></div>
    <div className="eyebrow">{eyebrow}</div>
    <h2 id={titleId}>{title}</h2>
    <p id={descriptionId}>{description}</p>
    <div className="confirm-actions">
      <button type="button" ref={cancel} className="btn ghost" onClick={() => onAnswer(false)}>{cancelLabel}</button>
      <button type="button" ref={proceed} className="btn primary" onClick={() => onAnswer(true)}>{confirmLabel}<LuArrowRight aria-hidden="true" /></button>
    </div>
  </dialog>, document.body)
}
