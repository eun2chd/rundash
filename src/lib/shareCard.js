import { fmtPace, fmtTime } from './pace.js'
import { progressionFor } from './progression.js'
import { num } from './format.js'

export const SHARE_URL = 'https://www.rundash.run'
export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1350

const pad = (n) => String(n).padStart(2, '0')

// Everything the card says, kept separate from drawing so it can be tested.
export function shareCardContent({ result, profile, persisted, now = new Date() }) {
  const growth = result.growth || {}
  const practice = growth.reason === 'practice'
  const level = persisted && !practice ? (growth.levelAfter || progressionFor(growth.xpAfter).level) : null
  return {
    nickname: profile?.nickname || '러너',
    level: level ? `Lv.${level}` : persisted ? '' : '익명 체험',
    headline: result.completed ? '완주했어요!' : '오늘도 달렸어요',
    distance: Number(result.distanceKm || 0).toFixed(2),
    stats: [
      ['시간', fmtTime(result.elapsedSec || 0)],
      ['평균 페이스', result.distanceKm > 0 ? `${fmtPace(result.paceSec)}/km` : '없음'],
      ['점수', `${num(Math.round(result.score || 0))}pt`],
    ],
    reward: persisted && !practice && growth.xpEarned > 0 ? `+${num(growth.xpEarned)} XP` : '',
    levelUp: persisted && growth.levelAfter > growth.levelBefore ? `LEVEL UP Lv.${growth.levelBefore} → Lv.${growth.levelAfter}` : '',
    date: `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`,
    shareText: `Run dash에서 ${num(result.distanceKm || 0, 2)}km ${result.completed ? '완주했어요' : '달렸어요'}! 나만의 캐릭터와 같이 달려요.`,
  }
}

const FONT = "'Pretendard Variable', Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
const COLORS = { dark: '#2a2b24', darker: '#1f201a', cream: '#fff8e6', bg: '#efebe3', ink: '#212121', olive: '#5f6b3c', oliveD: '#48522c', accent: '#e07b39', line: '#ddd6c8' }

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function text(ctx, value, x, y, { size, weight = 600, color = COLORS.ink, align = 'left' }) {
  ctx.font = `${weight} ${size}px ${FONT}`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.fillText(value, x, y)
  return ctx.measureText(value).width
}

// Draws the 4:5 card. `character` is an optional canvas or image of the 3D runner.
export function drawShareCard(ctx, content, character) {
  const W = CARD_WIDTH, H = CARD_HEIGHT, stageH = 760
  const sky = ctx.createLinearGradient(0, 0, 0, stageH)
  sky.addColorStop(0, COLORS.darker)
  sky.addColorStop(1, COLORS.dark)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, stageH)
  if (character) {
    const side = Math.min(character.width, character.height)
    const sx = (character.width - side) / 2, sy = (character.height - side) / 2
    const size = stageH - 40
    ctx.drawImage(character, sx, sy, side, side, (W - size) / 2, 40, size, size)
  }
  text(ctx, 'Run dash', 64, 104, { size: 52, weight: 800, color: COLORS.cream })
  text(ctx, content.date, W - 64, 100, { size: 34, weight: 600, color: COLORS.cream, align: 'right' })

  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, stageH, W, H - stageH)
  ctx.fillStyle = COLORS.accent
  ctx.fillRect(0, stageH, W, 10)

  let y = stageH + 92
  const nameWidth = text(ctx, content.nickname, 64, y, { size: 46, weight: 700 })
  if (content.level) text(ctx, content.level, 64 + nameWidth + 18, y, { size: 34, weight: 700, color: COLORS.oliveD })
  text(ctx, content.headline, W - 64, y, { size: 38, weight: 700, color: COLORS.accent, align: 'right' })

  y += 150
  const distanceWidth = text(ctx, content.distance, 60, y, { size: 150, weight: 800 })
  text(ctx, 'km', 60 + distanceWidth + 14, y, { size: 56, weight: 700, color: COLORS.oliveD })
  if (content.reward) text(ctx, content.reward, W - 64, y - 12, { size: 44, weight: 800, color: COLORS.olive, align: 'right' })

  y += 46
  const boxW = (W - 64 * 2 - 24 * 2) / 3
  content.stats.forEach(([label, value], index) => {
    const x = 64 + index * (boxW + 24)
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, x, y, boxW, 150, 24)
    ctx.fill()
    ctx.strokeStyle = COLORS.line
    ctx.lineWidth = 2
    ctx.stroke()
    text(ctx, label, x + 28, y + 52, { size: 28, weight: 600 })
    text(ctx, value, x + 28, y + 112, { size: 44, weight: 800 })
  })

  y += 150 + 60
  if (content.levelUp) text(ctx, content.levelUp, 64, y, { size: 32, weight: 800, color: COLORS.accent })
  text(ctx, '같이 달리자!  rundash.run', W - 64, H - 52, { size: 34, weight: 700, color: COLORS.oliveD, align: 'right' })
}

export async function createShareCardBlob(content, character) {
  // Canvas text needs the web font loaded first or it silently falls back.
  await Promise.all(['600', '700', '800'].map(weight => document.fonts?.load(`${weight} 40px "Pretendard Variable"`, '런대시0123456789')).filter(Boolean)).catch(() => {})
  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  drawShareCard(canvas.getContext('2d'), content, character)
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('공유 카드를 만들지 못했어요.')), 'image/png'))
}
