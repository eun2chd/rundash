import { useState } from 'react'
import { LuTerminal } from 'react-icons/lu'

const SPEEDS = [1, 10, 30, 60]

export default function DeveloperDebug({ timeScale, onTimeScale, practice, level, stamina, maxStamina }) {
  const [enabled, setEnabled] = useState(false)
  const toggle = () => {
    if (enabled) onTimeScale(1)
    setEnabled(!enabled)
  }
  return <aside className="developer-debug" aria-label="개발용 디버그 도구">
    {enabled && <section id="developer-debug-panel" className="developer-debug-panel" aria-labelledby="developer-debug-title">
      <span className="eyebrow">LOCAL DEVELOPMENT ONLY</span>
      <h3 id="developer-debug-title">개발용 디버그 모드</h3>
      <p>러닝 배속</p>
      <div className="debug-speeds">{SPEEDS.map((value) => <button type="button" key={value} aria-pressed={timeScale === value} className={timeScale === value ? 'on' : ''} onClick={() => onTimeScale(value)}>{value}x</button>)}</div>
      <dl className="debug-readout">{level != null && <div><dt>러너 레벨</dt><dd>Lv.{level}</dd></div>}<div><dt>체력</dt><dd>{Math.round(stamina)} / {maxStamina}</dd></div><div><dt>러닝 모드</dt><dd>{practice ? '체험 · XP 없음' : '일반 · 1배속'}</dd></div></dl>
      <p className="debug-note">배속을 한 번이라도 사용하면 이번 러닝은 경험치가 지급되지 않아요. 디버그 모드를 끄면 1배속으로 돌아갑니다.</p>
    </section>}
    <button type="button" className={`developer-debug-toggle ${enabled ? 'on' : ''}`} aria-expanded={enabled} aria-controls="developer-debug-panel" aria-label="개발용 디버그 모드" onClick={toggle}><LuTerminal /><span>개발용 디버그 모드</span><b>{enabled ? 'ON' : 'OFF'}</b></button>
  </aside>
}
