import { useState } from 'react'
import { LuEye, LuEyeOff } from 'react-icons/lu'

// Password field with an eye button that shows or hides what was typed. Takes the same props as <input>.
export default function PasswordInput({ disabled, ...props }) {
  const [visible, setVisible] = useState(false)
  return <span className="password-input">
    <input {...props} disabled={disabled} type={visible ? 'text' : 'password'} autoCapitalize="off" spellCheck={false} />
    <button type="button" className="password-toggle" disabled={disabled} aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'} aria-pressed={visible} title={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
      onMouseDown={event => event.preventDefault()} onClick={event => { event.preventDefault(); setVisible(value => !value) }}>
      {visible ? <LuEyeOff aria-hidden="true" /> : <LuEye aria-hidden="true" />}
    </button>
  </span>
}
