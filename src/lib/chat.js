export function mergeMessages(previous, incoming) {
  const unique = new Map([...previous, ...incoming].map((message) => [message.id, message]))
  return [...unique.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).slice(-100)
}
export function presenceCounts(state) {
  const people = Object.values(state).filter((sessions) => sessions.length > 0)
  return { online: people.length, running: people.filter((sessions) => sessions.some((session) => session.status === 'running')).length }
}

export function presenceMembers(state = {}) {
  return Object.entries(state).flatMap(([id, entries]) => {
    const sessions = Array.isArray(entries) ? entries.filter(value => value && typeof value === 'object') : []
    if (!sessions.length) return []
    const active = sessions.find(session => session.status === 'running') || sessions[0]
    const named = typeof active.nickname === 'string' ? active : sessions.find(session => typeof session.nickname === 'string')
    const nickname = named?.nickname?.trim().slice(0,10) || '러너'
    return [{ id, nickname, status: sessions.some(session => session.status === 'running') ? 'running' : 'paused' }]
  })
}
