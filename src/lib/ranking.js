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
