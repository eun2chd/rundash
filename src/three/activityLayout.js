// Each canvas owns a registry; previews and the running scene never mix.
const scenes = new WeakMap()
const overlaps = (a, b) => a.left < b.right + 6 && a.right + 6 > b.left && a.top < b.bottom + 6 && a.bottom + 6 > b.top
export function placeCloud(name, width, height, obstacles, viewport) {
  const preferred = { left: name.right - 8, top: name.top - height - 8 }
  const candidates = []
  for (let top = 8; top + height <= viewport.height - 8; top += 12) {
    for (const left of [preferred.left, name.left - width + 8, ...Array.from({ length: Math.ceil(viewport.width / 24) }, (_, i) => 8 + i * 24)]) {
      if (left < 8 || left + width > viewport.width - 8) continue
      const rect = { left, top, right: left + width, bottom: top + height }
      if (!obstacles.some(other => overlaps(rect, other))) candidates.push(rect)
    }
  }
  candidates.sort((a, b) => Math.hypot(a.left - preferred.left, a.top - preferred.top) - Math.hypot(b.left - preferred.left, b.top - preferred.top))
  return candidates[0] || null
}
export function registerActivity(scene, tag, cloud) {
  let entries = scenes.get(scene)
  if (!entries) { entries = new Set(); scenes.set(scene, entries) }
  const entry = { tag, cloud }
  entries.add(entry)
  const timer = setInterval(() => {
    if (entries.values().next().value !== entry) return
    const visible = [...entries].filter(e => e.tag.isConnected && e.tag.style.opacity !== '0')
    const obstacles = visible.map(e => e.tag.querySelector('.nametag')?.getBoundingClientRect()).filter(Boolean)
    for (const e of visible) {
      const name = e.tag.querySelector('.runner-nameplate')
      const anchor = name.getBoundingClientRect()
      if (anchor.right < 0 || anchor.left > window.innerWidth || anchor.bottom < 0 || anchor.top > window.innerHeight) {
        e.cloud.style.visibility = 'hidden'
        continue
      }
      const box = e.cloud.getBoundingClientRect()
      const scale = anchor.width / name.offsetWidth || 1
      const position = placeCloud(anchor, box.width, box.height, obstacles, { width: window.innerWidth, height: window.innerHeight })
      e.cloud.style.visibility = position ? 'visible' : 'hidden'
      if (position) {
        e.cloud.style.transform = 'translate(' + ((position.left - anchor.left) / scale) + 'px,' + ((position.top - anchor.top) / scale) + 'px)'
        obstacles.push(position)
      }
    }
  }, 120)
  return () => { clearInterval(timer); entries.delete(entry) }
}
