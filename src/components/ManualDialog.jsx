import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  LuArrowRight, LuBatteryCharging, LuBatteryLow, LuBookOpen, LuCalendarCheck, LuCheck, LuCloud, LuDroplet,
  LuFlag, LuFootprints, LuLock, LuMessageCircle, LuPause, LuSearch, LuSend, LuSparkles, LuUserPlus, LuUsers, LuX,
} from 'react-icons/lu'
import RhythmBar from './RhythmBar'
import { getSettings } from '../lib/settings'
import { RHYTHM_BOOST } from '../lib/rhythmBoost'
import { num } from '../lib/format'
import { staminaShare } from '../lib/progression'
import { fmtPace } from '../lib/pace'
import { FREE_PACE_LEVEL, PACE_STEP, SLOWEST_PACE } from '../lib/pacePlans'

// Friend and group limits enforced by the server (saved_friends and group_running migrations).
const FRIEND_LIMIT = 200
const GROUP_LIMIT = 4
const INVITE_SECONDS = 60
const INVITE_COOLDOWN = 5

// Speed starts dropping below these stamina percentages (see speedMultFor in lib/stamina).
const STAMINA_SLOW = 60
const STAMINA_LIMIT = 25

const CONTROLS = [
  ['Space', '리듬 판정'], ['E', '가까운 아이템'], ['B', '부스터'],
  ['C', '연습 러너 응원'], ['P', '일시정지 / 계속'], ['A', 'AUTO 켜기 / 끄기'], ['Enter', '채팅 전송'],
]

function ManualSection({ title, summary, illustration, stats, children }) {
  return <section className="manual-section">
    <h3>{title}</h3>
    <p className="manual-summary">{summary}</p>
    <div className="manual-illustration">{illustration}</div>
    <dl className="manual-stats">
      {stats.map(([label, value, judgment]) => <div className="manual-stat" key={label} data-judgment={judgment}>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>)}
    </dl>
    <details className="manual-details">
      <summary>세부 규칙<span className="sr-only"> · {title}</span></summary>
      <div>{children}</div>
    </details>
  </section>
}

// Level milestones derived from the live level table, so the manual follows admin edits.
function levelMilestones(rules) {
  const levels = rules.levels
  const boostPercent = Math.round((rules.boostMultiplier - 1) * 100)
  const fastest = Math.min(...levels.map(row => row.pace))
  const quickest = Math.min(...levels.map(row => row.recovery))
  const byLevel = new Map()
  const add = (level, title, description) => {
    const row = levels[level - 1]
    if (!row) return
    if (!byLevel.has(level)) byLevel.set(level, { level, xp: row.xp, features: [] })
    byLevel.get(level).features.push({ title, description })
  }
  levels.forEach((row, index) => {
    const prev = levels[index - 1]
    if (!prev) {
      add(row.level, '기본 러닝', `러닝 설정에서 강도(${rules.intensities.map(item => item.label).join(' · ')})나 페이스 버튼을 골라 달려요. 지금 최고 페이스는 ${fmtPace(row.pace)}/km이고, 레벨이 오를 때마다 최고 페이스가 빨라져 더 빠른 페이스 버튼이 열려요.`)
      return
    }
    if (row.boost > 0 && !(prev.boost > 0)) add(row.level, '부스터 해금', `달리는 중 부스터 버튼이나 B를 누르면 최대 체력의 ${num(rules.boostCost)}%를 쓰고 ${num(row.boost)}초 동안 속도가 ${boostPercent}% 빨라져요. 끝나면 ${num(rules.boostCooldown)}초 동안 재충전해요.`)
    else if (row.boost > prev.boost) add(row.level, '부스터 강화', `부스터 가속 시간이 ${num(prev.boost)}초에서 ${num(row.boost)}초로 늘어나요.`)
    if (row.pace === fastest && prev.pace !== fastest) add(row.level, '최고 페이스 도달', `최고 페이스가 ${fmtPace(fastest)}/km가 돼요. 이후에는 페이스 대신 최대 체력과 부스터가 성장해요.`)
    if (row.recovery === quickest && prev.recovery !== quickest) add(row.level, '최단 회복', `탈진했을 때 다시 달리기까지 걸리는 시간이 가장 짧은 ${num(quickest)}초가 돼요.`)
  })
  add(FREE_PACE_LEVEL, '자유 페이스', `러닝 설정에서 정해진 페이스 버튼 대신 ${num(PACE_STEP)}초 단위로 페이스를 직접 정해요. 내 최고 페이스부터 ${fmtPace(SLOWEST_PACE)}/km까지 고를 수 있어요.`)
  add(rules.autoLevel, 'AUTO', '달리는 중 AUTO 버튼이나 A를 누르면 가까운 보급품과 메달을 자동으로 챙기고 리듬 판정을 모두 PERFECT로 처리해요. 원할 때 다시 끌 수 있어요.')
  add(levels.length, '최고 레벨', '더 이상 레벨이 오르지 않아요.')
  return [...byLevel.values()].sort((a, b) => a.level - b.level)
}

function LevelMilestones({ milestones }) {
  return <ol className="manual-levels" role="list">
    {milestones.map(({ level, xp, features }) => <li className="manual-level" key={level}>
      <div className="manual-level-head"><strong>Lv.{num(level)}</strong><span>누적 {num(xp)} XP</span></div>
      <dl>{features.map(({ title, description }) => <div key={title}><dt>{title}</dt><dd>{description}</dd></div>)}</dl>
    </li>)}
  </ol>
}

function LevelTable({ levels }) {
  return <div className="manual-table-wrap" tabIndex={0} role="region" aria-label="레벨별 경험치표">
    <table className="manual-table">
      <thead><tr><th scope="col">레벨</th><th scope="col">누적 XP</th><th scope="col">다음 레벨까지</th><th scope="col">최고 페이스</th><th scope="col">최대 체력</th><th scope="col">탈진 회복</th><th scope="col">부스터</th></tr></thead>
      <tbody>{levels.map((row, index) => {
        const next = levels[index + 1]
        return <tr key={row.level}>
          <th scope="row">Lv.{num(row.level)}</th>
          <td>{num(row.xp)}</td>
          <td>{next ? num(next.xp - row.xp) : '-'}</td>
          <td>{fmtPace(row.pace)}</td>
          <td>{num(row.stamina)}</td>
          <td>{num(row.recovery)}초</td>
          <td>{row.boost > 0 ? `${num(row.boost)}초` : '잠김'}</td>
        </tr>
      })}</tbody>
    </table>
  </div>
}

function ManualFlow({ steps, connected = true }) {
  return <ul className="manual-flow" role="list">
    {steps.map(([Icon, label, detail], index) => <li className="manual-step" key={label}>
      {connected && index > 0 && <LuArrowRight className="manual-step-arrow" aria-hidden="true" />}
      <Icon className="manual-step-icon" aria-hidden="true" />
      <strong>{label}</strong>
      <span>{detail}</span>
    </li>)}
  </ul>
}

export default function ManualDialog({ onClose }) {
  const rules = getSettings()
  const boostLevel = rules.levels.find(row => row.boost > 0)
  const recoveryPercent = Math.round(rules.recoverRatio * 100)
  const boosterPercent = Math.round((rules.boostMultiplier - 1) * 100)
  const completionPercent = Math.round(rules.completionBonus * 100)
  const maxLevel = rules.levels[rules.levels.length - 1]
  const milestones = levelMilestones(rules)
  const staminaStep = (maxLevel.stamina - rules.levels[0].stamina) / Math.max(1, rules.levels.length - 1)
  const quickestRecovery = Math.min(...rules.levels.map(row => row.recovery))
  const ref = useRef(null)
  const close = useRef(null)
  const titleId = useId()
  const baseId = useId()
  const body = useRef(null)
  const tabs = useRef(null)
  const [active, setActive] = useState('rhythm')
  useEffect(() => {
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const element = ref.current
    element.showModal(); close.current?.focus()
    return () => { element.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus() }
  }, [])
  const sections = [
    { id: 'rhythm', label: '리듬', content: <ManualSection
      title="리듬 러닝"
      summary={<>커서가 중앙 초록 구간에 들어오면 <kbd>Space</kbd> 또는 화면의 터치 버튼을 눌러요.</>}
      illustration={<RhythmBar demo />}
      stats={[
        ['PERFECT', `+${num(rules.perfectPoints)} pt`, 'perfect'],
        ['GOOD', `+${num(rules.goodPoints)} pt`, 'good'],
        ['MISS', '0 pt', 'miss'],
      ]}
    >
      <p>안 해도 러너는 계속 달려요.</p>
      <p>중앙의 진한 초록은 PERFECT, 양옆의 연한 초록은 GOOD, 바깥의 회색은 MISS예요. 커서가 한 바퀴 돌 때 한 번만 판정해요.</p>
      <p>연속 성공하면 콤보가 쌓여요. 아이템 점수는 콤보당 {Math.round(rules.comboBonus * 100)}% 늘고, {num(rules.comboCap)}콤보에서 최대 {num(1 + rules.comboCap * rules.comboBonus)}배가 돼요.</p>
      <p>PERFECT는 2칸, GOOD은 1칸을 채워요. {RHYTHM_BOOST.threshold}칸마다 {RHYTHM_BOOST.duration}초 동안 속도가 {Math.round(RHYTHM_BOOST.bonus * 100)}% 올라가며 금빛 잔상과 리듬 부스트 표시가 나타나요. 남은 충전은 이어지고, 가속 중 다시 발동하면 지속 시간이 갱신돼요. 종료 직전에는 원래 속도로 부드럽게 돌아와요.</p>
      <p>MISS는 콤보와 충전을 초기화해요. 체력과 이미 발동한 가속은 유지돼요. 일시정지 중에는 가속 시간이 멈추고 탈진하면 가속이 끝나요. 리듬 점수(pt)와 성장 경험치(XP)는 별도예요.</p>
    </ManualSection> },
    { id: 'station', label: '보급소', content: <ManualSection
      title="보급소"
      summary="보급소 근처에서 물이나 젤을 챙겨 체력을 회복해요."
      illustration={<ManualFlow steps={[
        [LuFootprints, '보급 시작', `보급소 ${num(rules.stationGrabBeforeM)}m 전`],
        [LuDroplet, '물과 젤', `${num(rules.stationEveryM / 1000)}km마다 보급소`],
        [LuFlag, '보급 마감', `보급소 ${num(rules.stationGrabAfterM)}m 후`],
      ]} />}
      stats={[
        ['첫 보급소', `${num(rules.stationFirstM)}m`],
        ['물 회복량', `최대 체력의 ${num(rules.waterRestore)}%`],
        ['젤 회복량', `최대 체력의 ${num(rules.gelRestore)}%`],
      ]}
    >
      <p>보급소마다 물 2개와 젤 1개가 있어요. 왼쪽 보급 버튼이나 테이블 위 물품을 누르세요. <kbd>E</kbd>로 가까운 보급품을 하나씩 챙길 수도 있어요.</p>
      <p>체력은 최대치를 넘지 않아요. 구간을 지나치면 남은 물품이 사라지고, 탈진 회복 중에는 챙길 수 없어요.</p>
    </ManualSection> },
    { id: 'stamina', label: '체력·부스터', content: <ManualSection
      title="체력과 부스터"
      summary={`달리면 체력이 줄고, 빠르게 달릴수록 더 많이 줄어요. 최대 체력은 Lv.1 ${num(rules.levels[0].stamina)}에서 Lv.${num(maxLevel.level)} ${num(maxLevel.stamina)}까지 레벨이 오를수록 늘어요.`}
      illustration={<ManualFlow steps={[
        [LuBatteryLow, `체력 ${num(STAMINA_SLOW)}% 미만`, '페이스 감소'],
        [LuPause, '체력 0', `${num(rules.levels[0].recovery)}~${num(quickestRecovery)}초 멈춰서 회복`],
        [LuBatteryCharging, '회복 완료', `체력 ${recoveryPercent}%로 재개`],
      ]} />}
      stats={[
        ['Lv.1 최대 체력', num(rules.levels[0].stamina)],
        [`Lv.${num(maxLevel.level)} 최대 체력`, num(maxLevel.stamina)],
        ['레벨당 증가', `약 +${num(Math.round(staminaStep))}`],
      ]}
    >
      <p><b>체력 소모</b> · {fmtPace(rules.staminaBasePace)}/km로 1km를 달리면 체력 {num(rules.staminaDrain)}를 써요. 이보다 빠르면 더 많이, 느리면 더 적게 써요. 강도별로 소모량이 달라요({rules.intensities.map(row => `${row.label} ×${row.drain}`).join(' · ')}).</p>
      <p><b>속도 저하</b> · 체력이 최대치의 {num(STAMINA_SLOW)}% 아래로 내려가면 느려지기 시작하고, {num(STAMINA_LIMIT)}% 아래에서는 더 크게 느려져요. 체력이 거의 없으면 원래 속도의 절반까지 떨어져요.</p>
      <p><b>탈진</b> · 체력이 0이 되면 멈춰서 회복해요. 회복 시간은 레벨에 따라 {num(rules.levels[0].recovery)}초에서 {num(quickestRecovery)}초까지 줄고, 회복 후에는 최대 체력의 {recoveryPercent}%로 다시 달려요.</p>
      <p><b>보급</b> · 물은 최대 체력의 {num(rules.waterRestore)}%, 젤은 {num(rules.gelRestore)}%만큼 체력을 채워요. 레벨이 올라 최대 체력이 늘면 회복량도 같이 늘어요. 예를 들어 Lv.1(체력 {num(rules.levels[0].stamina)})은 물 +{num(staminaShare(rules.levels[0].stamina, rules.waterRestore))}, Lv.{num(maxLevel.level)}(체력 {num(maxLevel.stamina)})은 물 +{num(staminaShare(maxLevel.stamina, rules.waterRestore))}이에요.</p>
      <p><b>부스터</b> · {boostLevel ? `정식 계정은 Lv.${boostLevel.level}에서 부스터를 열어요.` : '현재 부스터가 잠겨 있어요.'} 버튼이나 <kbd>B</kbd>를 누르면 최대 체력의 {num(rules.boostCost)}%를 쓰고 속도가 {boosterPercent}% 빨라져요. 끝나면 {num(rules.boostCooldown)}초 동안 재충전해요. 남은 체력이 그만큼 이하이거나 일시정지·탈진 중이면 쓸 수 없어요. 레벨별 가속 시간은 레벨 탭에서 볼 수 있어요.</p>
      <p>익명 러너는 레벨과 상관없이 체력 {num(rules.anonymousStamina)}로 달려요. 자세한 내용은 익명 러너 탭에서 볼 수 있어요.</p>
    </ManualSection> },
    { id: 'growth', label: '경험치', content: <ManualSection
      title="경험치 얻는 법"
      summary="러닝을 마치면 거리, 완주, 점수, 출석에서 얻은 경험치(XP)를 더해 받아요. 경험치가 쌓이면 레벨이 올라 페이스와 체력, 회복력이 좋아져요."
      illustration={<ManualFlow connected={false} steps={[
        [LuFootprints, '거리 XP', `1km마다 ${num(rules.xpPerKmMin)}~${num(rules.xpPerKmMax)} XP`],
        [LuFlag, '완주 보너스', `거리 XP의 +${completionPercent}%`],
        [LuSparkles, '점수 XP', `${num(rules.scorePointsPerXp)}점마다 1 XP`],
        [LuCalendarCheck, '출석 XP', `하루 +${num(rules.attendanceDailyXp)} XP`],
      ]} />}
      stats={[
        ['1km당', `${num(rules.xpPerKmMin)}~${num(rules.xpPerKmMax)} XP`],
        ['완주 보너스', `+${completionPercent}%`],
        [`${num(rules.attendanceStreakEvery)}일 연속 출석`, `+${num(rules.attendanceStreakBonusXp)} XP`],
      ]}
    >
      <p><b>거리 XP</b> · 1km마다 {num(rules.xpPerKmMin)}~{num(rules.xpPerKmMax)} XP 사이에서 무작위로 정해져요. 마지막 1km를 다 달리지 못했다면 달린 비율만큼만 받아요. 중간에 종료해도 달린 거리만큼은 받아요.</p>
      <p><b>완주 보너스</b> · 목표 거리를 끝까지 달리면 거리 XP의 {completionPercent}%를 더 받아요. 예를 들어 5km를 완주하면 거리 XP {num(5 * rules.xpPerKmMin)}~{num(5 * rules.xpPerKmMax)}에 완주 보너스가 붙어요.</p>
      <p><b>점수 XP</b> · 리듬과 아이템으로 얻은 러닝 점수 {num(rules.scorePointsPerXp)}점마다 1 XP를 받아요. 점수로 받는 XP는 그 러닝의 거리 XP를 넘지 않아요.</p>
      <p><b>출석 XP</b> · 한국 시간 기준 하루 첫 {num(rules.attendanceMinKm)}km 이상 러닝을 저장하면 {num(rules.attendanceDailyXp)} XP를 받아요. {num(rules.attendanceStreakEvery)}일 연속 출석할 때마다 {num(rules.attendanceStreakBonusXp)} XP를 더 받고, 하루라도 빠지면 연속 일수가 처음부터 다시 시작돼요.</p>
      <p>러닝 강도는 {rules.intensities.map(row => row.label).join(' · ')} 중에서 골라요. 강도는 페이스와 체력 소모에 영향을 주고, 경험치는 거리 기준으로 받아요. 레벨별로 열리는 기능은 레벨 탭에서 볼 수 있어요.</p>
      <p>실제 흐른 시간보다 멀리 달린 것으로 확인된 기록은 체험 처리되어 경험치와 출석을 받지 않아요. 경험치는 정식 계정만 받아요. 익명 러너가 할 수 있는 것은 익명 러너 탭에서 볼 수 있어요.</p>
    </ManualSection> },
    { id: 'level', label: '레벨', content: <ManualSection
      title="레벨별 경험치와 기능"
      summary="경험치가 정해진 누적값에 닿으면 레벨이 올라요. 레벨마다 최고 페이스, 최대 체력, 탈진 회복 시간이 좋아지고, 아래 레벨에서 새 기능이 열려요."
      illustration={<LevelMilestones milestones={milestones} />}
      stats={[
        ['Lv.2까지', `${num(rules.levels[1]?.xp ?? 0)} XP`],
        ['자유 페이스', `Lv.${num(FREE_PACE_LEVEL)}`],
        ['AUTO', `Lv.${num(rules.autoLevel)}`],
        [`Lv.${num(maxLevel.level)}까지`, `${num(maxLevel.xp)} XP`],
      ]}
    >
      <p><b>최고 페이스</b> · 가장 빠른 강도인 ‘{rules.intensities.find(item => item.extraPace === 0)?.label ?? '도전하기'}’로 달릴 때 1km에 걸리는 시간이에요. 숫자가 작을수록 빨라요.</p>
      <p><b>최대 체력</b> · 꽉 찼을 때의 체력이에요. 체력이 많을수록 보급 없이 더 오래 달리고 부스터도 더 자주 쓸 수 있어요.</p>
      <p><b>탈진 회복</b> · 체력이 0이 되어 멈춘 뒤 다시 달리기까지 걸리는 시간이에요.</p>
      <p>레벨은 누적 경험치로 정해져요. 표의 ‘다음 레벨까지’는 그 레벨에서 다음 레벨로 오르는 데 필요한 경험치예요.</p>
      <LevelTable levels={rules.levels} />
    </ManualSection> },
    { id: 'friends', label: '친구 추가', content: <ManualSection
      title="친구 추가"
      summary="러닝 화면의 친구 관리 버튼에서 닉네임으로 러너를 찾아 내 친구 목록에 저장해요. 한 번 추가하면 다음부터 다시 찾지 않아도 돼요."
      illustration={<ManualFlow steps={[
        [LuUsers, '친구 관리', '러닝 화면의 친구 버튼'],
        [LuSearch, '친구 찾기', '닉네임 2~10자 검색'],
        [LuUserPlus, '친구 추가', '내 친구 목록에 저장'],
      ]} />}
      stats={[
        ['최대 친구 수', `${num(FRIEND_LIMIT)}명`],
        ['상대 수락', '필요 없음'],
        ['이용 대상', '정식 계정'],
      ]}
    >
      <p><b>친구 추가</b> · 내 목록에만 저장하는 기능이라 상대가 수락할 필요가 없어요. 상대의 친구 목록에는 자동으로 추가되지 않고, 상대의 위치 공개나 초대 설정도 바뀌지 않아요.</p>
      <p><b>내 친구 목록</b> · 친구마다 러닝 화면 접속 여부와 위치 공개 여부가 보여요. 여기서 위치 보기, 같이 달리기 초대, 친구 삭제, 차단을 할 수 있어요. 목록은 15초마다 새로 고쳐져요.</p>
      <p><b>위치 보기</b> · 친구가 위치를 공개했고 러닝 화면에 접속해 있으면 맵에서 친구가 있는 곳으로 이동해 볼 수 있어요. 함께 달리는 러너의 위치는 공개 설정과 상관없이 보여요.</p>
      <p><b>친구 삭제</b> · 내 목록에서만 지워요. 같이 달리고 있었다면 동행은 그대로 이어져요.</p>
      <p><b>차단</b> · 서로 위치가 보이지 않고 초대를 주고받을 수 없어요. 함께 달리던 중이면 동행도 끝나요. ‘차단 목록 보기’에서 해제할 수 있어요.</p>
      <p><b>내 공개 설정</b> · 친구 관리 창에서 세 가지를 켜고 끌 수 있어요. ‘내 코스 위치 공개’를 켜면 다른 러너가 맵에서 나를 찾을 수 있어요(처음에는 꺼져 있어요). ‘동행 초대 받기’를 끄면 초대를 받지 않아요. ‘내 활동 구름 공개’는 다른 러너에게 내 구름 말풍선을 보여줄지 정해요.</p>
      <p>친구 기능은 정식 계정으로 달리는 중에만 쓸 수 있어요.</p>
    </ManualSection> },
    { id: 'together', label: '같이 달리기', content: <ManualSection
      title="친구와 같이 달리기"
      summary={`달리고 있는 친구에게 동행 초대를 보내면 나를 포함해 최대 ${num(GROUP_LIMIT)}명이 같은 페이스와 거리로 함께 달려요.`}
      illustration={<ManualFlow steps={[
        [LuSend, '초대 보내기', '내 페이스와 목표 거리 제안'],
        [LuCheck, `${num(INVITE_SECONDS)}초 안에 수락`, '같은 조건으로 새 러닝 시작'],
        [LuUsers, '함께 달리기', `최대 ${num(GROUP_LIMIT)}명 · 앞 2명, 뒤 2명`],
      ]} />}
      stats={[
        ['최대 인원', `${num(GROUP_LIMIT)}명`],
        ['초대 유효 시간', `${num(INVITE_SECONDS)}초`],
        ['기록과 경험치', '각자 계산'],
      ]}
    >
      <p><b>초대 조건</b> · 나와 친구 모두 러닝 화면에 접속해 있고, 친구가 ‘동행 초대 받기’를 켜 두어야 해요. 친구 목록이나 친구 찾기 결과에서 ‘같이 달리기’를 누르면 초대가 가요. 초대는 {num(INVITE_COOLDOWN)}초에 한 번 보낼 수 있어요.</p>
      <p><b>초대 내용</b> · 초대를 보낸 러너의 지금 페이스와 목표 거리가 함께 전달돼요. 수락하기 전에 바뀌면 그 초대로는 시작할 수 없고, 새 초대를 받아야 해요.</p>
      <p><b>수락하면</b> · 내가 지금 달리던 러닝은 그때까지 달린 거리로 저장되고, 달린 만큼 경험치도 받아요(완주 보너스는 없어요). 그다음 초대받은 페이스와 목표 거리로 0km부터 새 러닝이 시작돼요. 상대가 먼저 달린 거리는 내 기록에 더해지지 않아요.</p>
      <p><b>함께 달리는 동안</b> · 같은 화면에서 앞 2명, 뒤 2명 대열로 보여요. 대열 위치는 화면 표시용이라 실제 거리나 점수에는 영향이 없어요. 거리, 체력, 보급, 점수, 경험치는 모두 각자 계산해요.</p>
      <p><b>방장</b> · 처음 초대를 보낸 러너가 방장이에요. 일시정지와 다시 시작은 방장만 할 수 있고, 방장이 멈추면 모두 함께 멈춰요. 방장이 나가면 남은 러너 중 한 명이 방장을 이어받아요.</p>
      <p><b>인원 추가와 종료</b> · 함께 달리는 중에도 초대를 보내 {num(GROUP_LIMIT)}명까지 늘릴 수 있어요. 친구 관리 창에서 언제든 동행을 끝낼 수 있고, 남은 러너가 1명이 되면 동행이 자동으로 끝나요.</p>
    </ManualSection> },
    { id: 'social', label: '채팅', content: <ManualSection
      title="구름 말풍선과 실시간 채팅"
      summary="구름으로 내 활동을 보여주고 러너 라운지에서 함께 달리는 사람과 대화해요."
      illustration={<ManualFlow connected={false} steps={[
        [LuCloud, '구름 말풍선', '내 활동 표시'],
        [LuMessageCircle, '러너 라운지', '실시간 대화'],
      ]} />}
      stats={[
        ['메시지 최대 길이', `${num(rules.chatMaxLength)}자`],
        ['전송 간격', `${num(rules.chatInterval)}초`],
      ]}
    >
      <p>러닝 설정에서 활동을 고르면 러너 머리 옆에 표시돼요. 구름 버튼으로 숨기거나 다시 켤 수 있어요.</p>
      <p><kbd>Enter</kbd>로 메시지를 보내요. 채팅을 숨겨도 접속은 유지돼요. 접속 인원은 계정당 한 명으로 세며, ‘달리는 중’에는 실제로 달리는 접속자만 표시돼요.</p>
    </ManualSection> },
    { id: 'controls', label: '조작', content: <ManualSection
      title="조작 한눈에 보기"
      summary="달리는 중 자주 쓰는 조작을 키보드로 빠르게 실행할 수 있어요."
      illustration={<ul className="manual-keys" role="list">
        {CONTROLS.map(([key, action]) => <li key={key}><kbd>{key}</kbd><span>{action}</span></li>)}
      </ul>}
      stats={[
        ['연습 러너 응원 범위', `${num(rules.cheerRadius)}m`],
        ['응원 성공 점수', `+${num(rules.cheerPoints)} pt`],
      ]}
    >
      <p>채팅 입력 중에는 게임 단축키가 작동하지 않아요. 매뉴얼과 종료 확인창을 열면 러닝이 잠시 멈춰요. 종료와 메뉴 이동은 확인 후 진행해요.</p>
    </ManualSection> },
    { id: 'anonymous', label: '익명 러너', content: <ManualSection
      title="익명 러너 이용 안내"
      summary={`가입하지 않고 바로 달려볼 수 있어요. 기본 능력치로 최대 ${num(rules.anonymousMaxKm)}km까지 체험하고, 기록과 성장은 저장되지 않아요.`}
      illustration={<div className="manual-compare">
        <section><h4><LuCheck aria-hidden="true" /> 익명 러너도 할 수 있어요</h4><ul role="list">
          {[
            '러너 만들기 (닉네임은 자동으로 정해져요)',
            `${rules.intensities.map(row => row.label).join(' · ')} 강도로 최대 ${num(rules.anonymousMaxKm)}km 달리기`,
            '리듬 러닝, 보급소, 메달 수집',
            '구름 말풍선과 러너 라운지 채팅',
            '결과 화면 확인',
          ].map(item => <li key={item}>{item}</li>)}
        </ul></section>
        <section><h4><LuLock aria-hidden="true" /> 정식 계정만 쓸 수 있어요</h4><ul role="list">
          {[
            '경험치, 레벨, 능력치 성장',
            '부스터, AUTO, 내 페이스 직접 고르기',
            `${num(rules.anonymousMaxKm)}km 넘는 거리 (최대 ${num(rules.maxDistanceKm)}km)`,
            '러닝 기록 저장과 이어 달리기',
            '출석 체크, 랭킹, 친구 위치 보기와 초대',
            '프로필 사진과 비밀번호 관리',
          ].map(item => <li key={item}>{item}</li>)}
        </ul></section>
      </div>}
      stats={[
        ['최대 거리', `${num(rules.anonymousMaxKm)}km`],
        ['최고 페이스', `${fmtPace(rules.anonymousPace)}/km`],
        ['체력', num(rules.anonymousStamina)],
        ['탈진 회복', `${num(rules.anonymousRecovery)}초`],
      ]}
    >
      <p><b>능력치</b> · 레벨 없이 고정 능력치로 달려요. 가장 빠른 강도가 {fmtPace(rules.anonymousPace)}/km이고, 체력은 {num(rules.anonymousStamina)}, 탈진하면 {num(rules.anonymousRecovery)}초 쉬고 다시 달려요.</p>
      <p><b>저장</b> · 러닝 기록과 경험치는 저장되지 않아요. 새로고침하거나 로그아웃하면 만든 러너와 체험 기록이 사라져요.</p>
      <p><b>채팅</b> · 러너 라운지에서 대화할 수 있고, 메시지에는 익명 러너라고 표시돼요.</p>
      <p><b>정식 계정으로 시작하기</b> · 익명 체험 기록은 정식 계정으로 옮겨지지 않아요. 로그인 화면에서 회원가입하면 처음부터 레벨과 기록이 쌓여요.</p>
    </ManualSection> },
  ]
  const current = sections.find(section => section.id === active)
  // When the tab row scrolls (phones), fade whichever edge still hides tabs.
  function markTabOverflow() {
    const row = tabs.current
    if (!row) return
    row.classList.toggle('more-left', row.scrollLeft > 1)
    row.classList.toggle('more-right', row.scrollLeft + row.clientWidth < row.scrollWidth - 1)
  }
  useEffect(() => {
    const row = tabs.current
    if (!row) return
    row.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    markTabOverflow()
  }, [active])
  useEffect(() => {
    window.addEventListener('resize', markTabOverflow)
    return () => window.removeEventListener('resize', markTabOverflow)
  }, [])
  const selectTab = (id) => { setActive(id); body.current?.scrollTo({ top: 0 }) }
  const moveTab = (event) => {
    const index = sections.findIndex(section => section.id === active)
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: sections.length - 1 }[event.key]
    if (next === undefined) return
    event.preventDefault()
    const target = sections[(next + sections.length) % sections.length]
    selectTab(target.id)
    document.getElementById(`${baseId}-tab-${target.id}`)?.focus()
  }
  return createPortal(<dialog ref={ref} className="manual-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose() }}>
    <header className="manual-heading"><h2 id={titleId}><LuBookOpen aria-hidden="true" /> 러너 매뉴얼</h2><button type="button" ref={close} className="icon-btn" aria-label="매뉴얼 닫기" onClick={onClose}><LuX aria-hidden="true" /></button></header>
    <div ref={tabs} className="manual-tabs" role="tablist" aria-label="매뉴얼 항목" onKeyDown={moveTab} onScroll={markTabOverflow}>
      {sections.map(({ id, label }) => <button type="button" role="tab" key={id} id={`${baseId}-tab-${id}`} aria-selected={active === id} aria-controls={`${baseId}-panel`} tabIndex={active === id ? 0 : -1} className={active === id ? 'on' : ''} onClick={() => selectTab(id)}>{label}</button>)}
    </div>
    <div ref={body} className="manual-body" role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${active}`} tabIndex={0}>
      {current.content}
    </div>
    <footer className="manual-footer"><button type="button" className="btn primary" onClick={onClose}>알겠어요, 계속하기</button></footer>
  </dialog>, document.body)
}
