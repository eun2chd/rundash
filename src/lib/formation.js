// Display offsets only. These must never change simulation distance or rewards.
export function formationOffset(slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 3) return { distance: 0, lane: 0 }
  return { distance: slot < 2 ? 1.4 : -1.4, lane: slot % 2 ? 0.9 : -0.9 }
}
