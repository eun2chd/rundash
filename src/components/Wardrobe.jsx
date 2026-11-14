import { useState } from 'react'
import { GEAR_COLORS, OUTFIT_CATEGORIES } from '../lib/outfit'

export default function Wardrobe({ outfit, color, onChange, onColor, disabled }) {
  const [active, setActive] = useState('top')
  const category = OUTFIT_CATEGORIES.find((item) => item.id === active)
  const selectedColor = active === 'top' ? color : outfit[category.color]
  return <section className="wardrobe" aria-label="러닝 장비 꾸미기">
    <div className="wardrobe-heading"><div><div className="eyebrow">RUNNER'S CLOSET</div><h3>오늘의 러닝 스타일</h3></div><span className="badge">6개 카테고리</span></div>
    <div className="wardrobe-tabs" role="tablist" aria-label="장비 종류">
      {OUTFIT_CATEGORIES.map((item) => <button type="button" key={item.id} role="tab" id={`gear-tab-${item.id}`} aria-selected={active === item.id} aria-controls="gear-panel" className={`wardrobe-tab ${active === item.id ? 'on' : ''}`} onClick={() => setActive(item.id)}>{item.label}</button>)}
    </div>
    <div id="gear-panel" role="tabpanel" aria-labelledby={`gear-tab-${active}`}>
      <div className="gear-options">{category.options.map(([id, label]) => <button type="button" key={id} className={`gear-option ${outfit[active] === id ? 'on' : ''}`} aria-pressed={outfit[active] === id} disabled={disabled} onClick={() => onChange({ ...outfit, [active]: id })}><span className="gear-option-dot" aria-hidden="true">{outfit[active] === id ? '✓' : '+'}</span>{label}</button>)}</div>
      <div className="gear-color-label">{category.label} 컬러</div>
      <div className="swatches">{GEAR_COLORS.map(([value, label]) => <button type="button" key={value} className={`swatch ${selectedColor === value ? 'on' : ''}`} style={{ background: value }} title={label} aria-label={`${category.label} ${label}`} aria-pressed={selectedColor === value} disabled={disabled} onClick={() => active === 'top' ? onColor(value) : onChange({ ...outfit, [category.color]: value })} />)}</div>
    </div>
  </section>
}
