export const DEFAULT_OUTFIT = {
  hat: 'band', hatColor: '#5f6b3c', top: 'tee',
  bottom: 'shorts', bottomColor: '#303a35',
  vest: 'none', vestColor: '#485a50',
  gloves: 'none', glovesColor: '#303a35',
  shoes: 'daily', shoesColor: '#f4f1e8',
}
export const OUTFIT_CATEGORIES = [
  { id: 'hat', label: '모자', color: 'hatColor', options: [['none', '벗기'], ['band', '헤어밴드'], ['cap', '러닝 캡'], ['visor', '선바이저'], ['beanie', '비니']] },
  { id: 'top', label: '상의', options: [['tee', '반팔'], ['singlet', '싱글렛'], ['long', '긴팔']] },
  { id: 'bottom', label: '하의', color: 'bottomColor', options: [['shorts', '러닝 쇼츠'], ['tights', '롱 타이츠'], ['layered', '쇼츠 + 타이츠']] },
  { id: 'vest', label: '러닝 조끼', color: 'vestColor', options: [['none', '벗기'], ['race', '레이스 조끼'], ['trail', '트레일 조끼']] },
  { id: 'gloves', label: '장갑', color: 'glovesColor', options: [['none', '벗기'], ['fingerless', '반장갑'], ['full', '러닝 장갑']] },
  { id: 'shoes', label: '신발', color: 'shoesColor', options: [['daily', '데일리 러닝화'], ['race', '레이싱화'], ['trail', '트레일화']] },
]
export const GEAR_COLORS = [
  ['#f4f1e8', '크림'], ['#303a35', '차콜'], ['#5f6b3c', '올리브'],
  ['#e07b39', '오렌지'], ['#6fb7d6', '스카이'], ['#a993d6', '라벤더'],
  ['#e98fb0', '로즈'], ['#e8c547', '옐로'],
]
export const normalizeOutfit = (outfit) => {
  const result = { ...DEFAULT_OUTFIT }
  for (const category of OUTFIT_CATEGORIES) {
    if (category.options.some(([id]) => id === outfit?.[category.id])) result[category.id] = outfit[category.id]
    if (category.color && /^#[0-9a-f]{6}$/i.test(outfit?.[category.color] || '')) result[category.color] = outfit[category.color]
  }
  return result
}
