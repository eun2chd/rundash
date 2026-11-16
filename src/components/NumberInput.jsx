import { useEffect, useRef, useState } from 'react'
import { groupDigits, num, parseGrouped } from '../lib/format'

// A number field that shows thousands separators while typing (type="number" cannot). It reports
// a Number (or '' when empty) through onChange(value) and keeps min/max/step validation by setting
// the browser's validity message, so required forms still block out-of-range values.
export default function NumberInput({ value, onChange, min, max, step = 1, required, readOnly, disabled, ...rest }) {
  const input = useRef(null)
  const [text, setText] = useState(null)
  const shown = text ?? (value === '' || value === null || value === undefined ? '' : num(value, undefined, 6))
  useEffect(() => {
    const n = parseGrouped(shown)
    let message = ''
    if (n === '') message = required ? '값을 입력해 주세요.' : ''
    else if (min !== undefined && n < min) message = `${num(min, undefined, 6)} 이상으로 입력해 주세요.`
    else if (max !== undefined && n > max) message = `${num(max, undefined, 6)} 이하로 입력해 주세요.`
    else if (step && Math.abs(Math.round((n - (min || 0)) / step) * step - (n - (min || 0))) > 1e-9) message = `${num(step, undefined, 6)} 단위로 입력해 주세요.`
    input.current?.setCustomValidity(message)
  }, [shown, min, max, step, required])
  return <input {...rest} ref={input} type="text" inputMode={step < 1 || (min !== undefined && min < 0) ? 'decimal' : 'numeric'}
    autoComplete="off" required={required} readOnly={readOnly} disabled={disabled} value={shown}
    onFocus={() => setText(shown)} onBlur={() => setText(null)}
    onChange={event => {
      const next = groupDigits(event.target.value)
      setText(next)
      onChange(parseGrouped(next))
    }} />
}
