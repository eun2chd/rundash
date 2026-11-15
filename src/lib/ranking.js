const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// '2026-11-09' -> '11.9 (월)'. Dates come from the server as plain KST calendar days.
export function formatDay(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  return `${month}.${day} (${WEEKDAYS[new Date(year, month - 1, day).getDay()]})`
}

export function timeUntil(target, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((new Date(target).getTime() - now) / 60000))
  const days = Math.floor(minutes / 1440), hours = Math.floor((minutes % 1440) / 60)
  return days ? `${days}일 ${hours}시간` : hours ? `${hours}시간 ${minutes % 60}분` : `${minutes % 60}분`
}

export const formatKm = (km) => `${Number(km).toFixed(2)}km`

export const RANKING_BOARDS = {
  week: { label: '주간', periods: ['이번 주', '지난주'], rule: '매주 월요일 0시(한국 시간)에 새로 시작해요. 정식 계정으로 저장한 러닝 거리를 합산하고, 같은 거리라면 먼저 달성한 러너가 앞서요.' },
  month: { label: '월간', periods: ['이번 달', '지난달'], rule: '매달 1일 0시(한국 시간)에 새로 시작해요. 그 달에 저장한 러닝 거리를 합산해요.' },
  total: { label: '누적', rule: '지금까지 달린 전체 거리 순위예요. 개발 배속 기록은 포함하지 않아요.' },
  level: { label: '레벨', rule: '누적 경험치 순위예요. 같은 경험치라면 먼저 도달한 러너가 앞서요.' },
}

export const periodLabel = (kind, offset) => RANKING_BOARDS[kind].periods?.[offset] ?? ''

// Main number and caption for a row on each board.
export function boardValue(kind, row) {
  if (kind === 'level') return { main: `Lv.${row.level}`, sub: `${Number(row.xp).toLocaleString('ko-KR')} XP` }
  return { main: formatKm(row.km), sub: `${row.runs}회 달림` }
}
