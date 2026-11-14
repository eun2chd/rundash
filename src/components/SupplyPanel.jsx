import { LuDroplet } from 'react-icons/lu'
import { ITEM_TYPES } from '../lib/mockData'
import { ITEM_ICONS } from '../lib/icons'
import { STAMINA } from '../lib/stamina'

export default function SupplyPanel({ station, items, distance, resting, onCollect }) {
  const left = Math.max(0, station.dist + STAMINA.stationGrabAfterM - distance)
  return <section className="supply-panel" aria-label={`보급소 ${station.n}`}>
    <div className="supply-header"><span className="supply-symbol"><LuDroplet /></span><div><span className="eyebrow">AID STATION {String(station.n).padStart(2, '0')}</span><strong>잠깐, 수분 충전!</strong></div><span className="supply-open">OPEN</span></div>
    <div className="supply-window"><span>보급 가능 구간</span><b>{Math.ceil(left)}m 남음</b></div>
    <div className="supply-items">{['water', 'gel'].map((type) => {
      const stock = items.filter((item) => item.type === type)
      const Icon = ITEM_ICONS[type]
      return <button key={type} type="button" className={`supply-btn ${type}`} disabled={resting || stock.length === 0} onClick={() => stock[0] && onCollect(stock[0])}><Icon /><strong>{ITEM_TYPES[type].label}</strong><span>체력 +{ITEM_TYPES[type].restore}</span><small>{stock.length ? `${stock.length}개 남음` : '모두 챙겼어요'}</small></button>
    })}</div>
    <p className="supply-tip">{resting ? '회복이 끝나면 챙길 수 있어요.' : '물품 클릭 또는 E · 지나치면 챙길 수 없어요.'}</p>
  </section>
}
