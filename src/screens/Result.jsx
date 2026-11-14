import CharacterPreview from '../components/CharacterPreview'
import { fmtPace, fmtTime } from '../lib/pace'
import { LuTrophy, LuFlag } from 'react-icons/lu'

export default function Result({ result, profile, onAgain }) {
  const r = result
  return (
    <div className="result-screen">
      <div className="result-stage">
        <CharacterPreview color={profile.color} skin={profile.skin} hair={profile.hair} nickname={profile.nickname} running={false} popKey={1} />
      </div>
      <div className="card result-card">
        <div className="eyebrow">{r.completed ? 'FINISH' : 'STOPPED'}</div>
        <h2 className="result-title">{r.completed ? <><LuTrophy /> 완주했어요!</> : <><LuFlag /> 오늘은 여기까지</>}</h2>
        <div className="result-big">
          <div><span>거리</span><b>{r.distanceKm.toFixed(2)}<small>km</small></b></div>
          <div><span>시간</span><b>{fmtTime(r.elapsedSec)}</b></div>
          <div><span>평균 페이스</span><b>{fmtPace(r.paceSec)}</b><small className="sub">목표 {fmtPace(r.targetPaceSec)}</small></div>
        </div>
        <div className="result-grid">
          <div><span>점수</span><b>{r.score.toLocaleString()} pt</b></div>
          <div><span>보급</span><b>{r.supplies}/{r.suppliesTotal}</b></div>
          <div><span>메달</span><b>{r.medals}/{r.medalsTotal}</b></div>
          <div><span>탈진</span><b>{r.exhaustCount}회</b></div>
          <div><span>회복에 쓴 시간</span><b>{fmtTime(r.restSec)}</b></div>
          <div><span>최대 콤보</span><b>{r.maxCombo}</b></div>
          <div><span>PERFECT</span><b>{r.perfect}</b></div>
          <div><span>보낸 응원</span><b>{r.cheersSent}</b></div>
          <div><span>받은 응원</span><b>{r.cheersGot}</b></div>
        </div>
        <p className="note">기록은 지금은 브라우저에 저장돼요. (추후 Supabase runs 테이블)</p>
        <button className="btn primary block" onClick={onAgain}>다시 달리기</button>
      </div>
    </div>
  )
}
