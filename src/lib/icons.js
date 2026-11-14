// 아이콘은 react-icons(Lucide) 로 통일 — 이모지 사용 금지
import {
  LuDroplet, LuWheat, LuMedal,
  LuTrees, LuLeaf, LuBuilding2, LuPalmtree, LuMoonStar,
  LuFlame, LuThumbsUp, LuHeart, LuPartyPopper,
} from 'react-icons/lu'

export const ITEM_ICONS = { water: LuDroplet, gel: LuWheat, medal: LuMedal }
export const BIOME_ICONS = { park: LuTrees, autumn: LuLeaf, city: LuBuilding2, beach: LuPalmtree, night: LuMoonStar }
export const CHEER_ICONS = { flame: LuFlame, thumbs: LuThumbsUp, heart: LuHeart, party: LuPartyPopper }
export const CHEER_KEYS = Object.keys(CHEER_ICONS)
