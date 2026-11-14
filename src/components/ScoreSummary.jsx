export default function ScoreSummary({ stats }) {
  const multiplier = 1 + Math.min(stats.combo, 10) * .1
  return <section className="score-card" aria-label="러닝 점수와 콤보">
    <div className="score-heading"><span>러닝 점수</span><b>아이템 ×{multiplier.toFixed(1)}</b></div>
    <div className="score">{stats.score.toLocaleString()}<small>pt</small></div>
    <div className="score-row"><span>콤보 <b>{stats.combo}</b></span><span>최대 <b>{stats.maxCombo}</b></span></div>
    <div className="score-row"><span>보급 <b>{stats.supplies}</b></span><span>메달 <b>{stats.medals}</b></span><span>응원 <b>{stats.cheersSent}</b></span></div>
  </section>
}
