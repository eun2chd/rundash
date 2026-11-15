export function clampPanel(position, panel, viewport) {
  const bound = (value, size, space) => Math.max(8, Math.min(Number.isFinite(value) ? value : 8, Math.max(8, space - size - 8)))
  return { x: bound(position.x, panel.width, viewport.width), y: bound(position.y, panel.height, viewport.height) }
}
