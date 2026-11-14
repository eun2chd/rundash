export function takeNewInvites(invites, seen) {
  const fresh = invites.filter(invite => invite.incoming && !seen.has(invite.id))
  for (const invite of fresh) seen.add(invite.id)
  while (seen.size > 100) seen.delete(seen.values().next().value)
  return fresh
}
