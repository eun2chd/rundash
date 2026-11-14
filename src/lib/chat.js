export function mergeMessages(previous, incoming) {
  const unique = new Map([...previous, ...incoming].map((message) => [message.id, message]))
  return [...unique.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).slice(-100)
}
export function presenceCounts(state) {
  const people = Object.values(state).filter((sessions) => sessions.length > 0)
  return { online: people.length, running: people.filter((sessions) => sessions.some((session) => session.status === 'running')).length }
}
