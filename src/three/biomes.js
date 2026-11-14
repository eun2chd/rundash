// 1km 마다 바뀌는 주변 환경
export const BIOMES = [
  { key: 'park', name: '공원', sky: '#9fd3f2', ground: '#8fbf62', shoulder: '#b8d48a', road: '#d6b98c', line: '#fff7e6', prop: 'tree',
    foliage: ['#6fae4b', '#86c05a', '#5c9a3e', '#a3cf6b'] },
  { key: 'autumn', name: '단풍길', sky: '#8ec5ea', ground: '#b98a55', shoulder: '#cfa772', road: '#a9a299', line: '#f3eee4', prop: 'tree',
    foliage: ['#c8402e', '#e2783a', '#efb43c', '#d65a2f', '#b8342a'] },
  { key: 'city', name: '도심', sky: '#c4d3df', ground: '#9aa1a8', shoulder: '#b8bec4', road: '#4a4f57', line: '#f2f2f2', prop: 'building',
    palette: ['#d9d3c7', '#b9c4cc', '#e8ddd0', '#9fb1bf', '#c9b8a6'] },
  { key: 'beach', name: '해변', sky: '#79c7ee', ground: '#f1dca7', shoulder: '#f7e8c0', road: '#d9c39a', line: '#ffffff', prop: 'palm' },
  { key: 'night', name: '야경', sky: '#171b33', ground: '#24283f', shoulder: '#2d3250', road: '#33384f', line: '#ffd36e', prop: 'neon', dark: true,
    neon: ['#ff5fa2', '#4fd8eb', '#b6f36b', '#ffd36e'] },
]

export const biomeIndexAt = (distM) => Math.floor(distM / 1000) % BIOMES.length
