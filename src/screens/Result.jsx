import CharacterPreview from '../components/CharacterPreview'
import { fmtPace, fmtTime } from '../lib/pace'
import { LuTrophy, LuFlag } from 'react-icons/lu'
import GrowthCard from '../components/GrowthCard'
import { MILESTONES } from '../lib/progression'

export default function Result({ result, profile, persisted = true, onAgain }) {
  const r = result
  const growth = r.growth || { xpEarned: 0, xpBefore: 0, xpAfter: 0 }
  const unlocked = MILESTONES.filter((milestone) => milestone.level > (growth.levelBefore || 1) && milestone.level <= (growth.levelAfter || 1))
  return (
    <div className="result-screen">
      <div className="result-stage">
        <CharacterPreview color={profile.color} skin={profile.skin} hair={profile.hair} outfit={profile.outfit} nickname={profile.nickname} running={false} popKey={1} />
      </div>
      <div className="card result-card">
        <div className="eyebrow">{r.completed ? 'FINISH' : 'STOPPED'}</div>
        <h2 className="result-title">{r.completed ? <><LuTrophy /> 완주했어요!</> : <><LuFlag /> 오늘은 여기까지</>}</h2>
        <div className="run-reward" role="status"><strong>{growth.reason === 'practice' ? '개발 체험 러닝' : persisted ? `+${growth.xpEarned} XP` : '익명 체험 러닝'}</strong><p>{growth.reason === 'practice' ? '배속 또는 실제 시간보다 빠른 기록은 경험치가 지급되지 않아요.' : !persisted ? '정식 계정으로 로그인하면 성장을 저장할 수 있어요.' : `거리 +${growth.distanceXp || 0} · 완주 보너스 +${growth.completionXp || 0} XP`}</p>{growth.levelAfter > growth.levelBefore && <b>LEVEL UP! Lv.{growth.levelBefore} → Lv.{growth.levelAfter}</b>}{unlocked.map((reward) => <p key={reward.level}>해금! {reward.title} · {reward.description}</p>)}</div>
        <GrowthCard xp={growth.xpAfter} anonymous={!persisted} />
        <div className="result-big">
          <div><span>거리</span><b>{r.distanceKm.toFixed(2)}<small>km</small></b></div>
          <div><span>시간</span><b>{fmtTime(r.elapsedSec)}</b></div>
          <div><span>평균 페이스</span><b>{fmtPace(r.paceSec)}</b><small className="sub">기준 {fmtPace(r.targetPaceSec)}</small></div>
        </div>
        <div className="result-grid">
          <div><span>점수</span><b>{r.score.toLocaleString()} pt</b></div>
          <div><span>보급</span><b>{r.supplies}/{r.suppliesTotal}</b></div>
          <div><span>메달</span><b>{r.medals}/{r.medalsTotal}</b></div>
          <div><span>탈진</span><b>{r.exhaustCount}회</b></div>
          <div><span>회복에 쓴 시간</span><b>{fmtTime(r.restSec)}</b></div>
          <div><span>최대 콤보</span><b>{r.maxCombo}</b></div>
          <div><span>부스터</span><b>{r.boostUses || 0}회</b></div>
          <div><span>PERFECT</span><b>{r.perfect}</b></div>
          <div><span>보낸 응원</span><b>{r.cheersSent}</b></div>
          <div><span>받은 응원</span><b>{r.cheersGot}</b></div>
        </div>
        <p className="note">{persisted ? '러닝 기록이 내 계정에 저장됐어요.' : '익명 체험 기록은 저장되지 않아요. 새로고침하면 초기화돼요.'}</p>
        <button className="btn primary block" onClick={onAgain}>다시 달리기</button>
      </div>
    </div>
  )
}
