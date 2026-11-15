import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

// Cloudflare Turnstile for Supabase Auth's captcha protection. Without a site key the
// widget is skipped so local builds keep working while Supabase captcha is off.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
export const captchaEnabled = !!TURNSTILE_SITE_KEY

let scriptPromise
function loadTurnstile() {
  scriptPromise ||= new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile)
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => resolve(window.turnstile)
    script.onerror = () => { scriptPromise = null; reject(new Error('보안 확인을 불러오지 못했어요.')) }
    document.head.appendChild(script)
  })
  return scriptPromise
}

// Tokens are single use: call ref.reset() after every auth request, success or not.
export default forwardRef(function Captcha({ onToken }, ref) {
  const box = useRef(null)
  const widget = useRef(null)
  const callback = useRef(onToken)
  callback.current = onToken
  const [failed, setFailed] = useState(false)
  useImperativeHandle(ref, () => ({ reset() { callback.current(''); if (widget.current !== null) window.turnstile?.reset(widget.current) } }), [])
  useEffect(() => {
    if (!captchaEnabled) return
    let alive = true
    loadTurnstile().then(turnstile => {
      if (!alive || !box.current) return
      widget.current = turnstile.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY,
        language: 'ko',
        size: 'flexible',
        appearance: 'interaction-only',
        callback: token => { setFailed(false); callback.current(token) },
        'expired-callback': () => callback.current(''),
        'error-callback': () => { setFailed(true); callback.current('') },
      })
    }).catch(() => { if (alive) setFailed(true) })
    return () => {
      alive = false
      if (widget.current !== null) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [])
  if (!captchaEnabled) return null
  return <div className="captcha">
    <div ref={box} />
    {failed && <p className="error" role="alert">보안 확인에 실패했어요. 새로고침한 뒤 다시 시도해 주세요.</p>}
  </div>
})
