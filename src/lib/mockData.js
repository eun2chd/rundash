import { STAMINA } from './stamina'

// 목업 데이터 — 나중에 Supabase Realtime Presence 로 대체
// start: 시작 시점에 앞(+)/뒤(-)로 몇 m 떨어져 있는지
export const MOCK_RUNNERS = [
  { id: 'g1', nickname: '새벽러너', color: '#f08a5d', skin: '#f6d1b0', hair: '#3b2a20', paceSec: 330, start: -25, lane: -1.6 },
  { id: 'g2', nickname: '한강토끼', color: '#7fb3d5', skin: '#f1c9a5', hair: null, paceSec: 290, start: -70, lane: 1.6 },
  { id: 'g3', nickname: '느긋거북', color: '#b8d27a', skin: '#e8b98f', hair: '#5a4632', paceSec: 450, start: 45, lane: 0.9 },
  { id: 'g4', nickname: '주말조깅', color: '#c39bd3', skin: '#f6d1b0', hair: '#222', paceSec: 380, start: 12, lane: -0.9 },
]

// restore: 체력 회복량
export const ITEM_TYPES = {
  water: { label: '물', points: 5, restore: 15, color: '#5aa9e6' },
  gel: { label: '탄수화물 젤', points: 5, restore: 25, color: '#f4c430' },
  medal: { label: '메달', points: 50, restore: 0, color: '#e8a33d' },
}

export const STATION_LANE = 4.9

// 코스 구성: 보급소(물·젤) + 코스 위 메달(점수)
export function generateCourse(totalM) {
  const stations = []
  const items = []
  let n = 1
  for (let d = STAMINA.stationFirstM; d < totalM - 80; d += STAMINA.stationEveryM) {
    stations.push({ id: `s${n}`, n, dist: d })
    ;['water', 'water', 'gel'].forEach((type, slot) =>
      items.push({ id: `s${n}-${slot}`, type, stationId: `s${n}`, dist: d + (slot - 1) * 0.9, lane: STATION_LANE, status: 'pending' })
    )
    n++
  }
  let d = 200
  let i = 0
  while (d < totalM - 30) {
    items.push({ id: `m${i++}`, type: 'medal', dist: d, lane: [-1.8, 0, 1.8][Math.floor(Math.random() * 3)], status: 'pending' })
    d += 250 + Math.random() * 250
  }
  return { stations, items }
}
