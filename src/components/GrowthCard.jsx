import { progressionFor, xpForLevel } from '../lib/progression'
import { fmtPace } from '../lib/pace'

export default function GrowthCard({ xp = 0, anonymous = false }) {
  if (anonymous) return null
  const growth = progressionFor(anonymous ? 0 : xp)
  const next = growth.nextUnlock
  return <section className="growth-card" aria-label="러너 성장">
    <div className="growth-heading"><div><span className="eyebrow">RUNNER LEVEL</span><strong>Lv. {growth.level}</strong></div><span className="badge">{anonymous ? '익명 체험' : `${growth.xp.toLocaleString()} XP`}</span></div>
    <div className="xp-track" role="progressbar" aria-label="다음 레벨까지 경험치" aria-valuemin={0} aria-valuemax={growth.needed || 1} aria-valuenow={Math.min(growth.inLevel, growth.needed || 1)}><span style={{ width: `${growth.progress * 100}%` }} /></div>
    <div className="growth-caption">{anonymous ? '정식 계정으로 로그인하면 성장을 저장할 수 있어요.' : growth.needed ? `${growth.inLevel} / ${growth.needed} XP · 다음 레벨까지 ${growth.remaining} XP` : '최고 레벨에 도달했어요!'}</div>
    <div className="growth-stats"><div><span>최대 페이스</span><b>{fmtPace(growth.fastestPace)} /km</b></div><div><span>최대 체력</span><b>{growth.maxStamina}</b></div><div><span>부스터</span><b>{growth.boosterUnlocked ? `${growth.boosterDuration}초` : '아직 잠김'}</b></div></div>
    {next && <div className="next-unlock"><span className="eyebrow">NEXT UNLOCK · LV.{next.level}</span><strong>{next.title}</strong><p>{next.description}</p><small>{Math.max(0, xpForLevel(next.level) - growth.xp).toLocaleString()} XP 남음</small></div>}
  </section>
}
