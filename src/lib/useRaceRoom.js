import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSettings } from './settings'
import { getSupabase } from './supabase'
import { mergeMessages, presenceMembers } from './chat'
import { weatherAt } from './weather'

const roomCleanup = new WeakMap()
const ROOM_TOPIC = 'rundash-running-room'
const CLEANUP_WAIT_MS = 2000

// The presence topic is shared by everyone, and realtime-js hands back an existing channel
// with the same topic. Wait briefly for the previous run's channel to leave; if it has not
// (leaving can take up to 10s on a flaky socket), drop it so a fresh channel is created.
async function releasePreviousRoom(client, pending) {
  await Promise.race([pending, new Promise(resolve => setTimeout(resolve, CLEANUP_WAIT_MS))])
  const stale = client.getChannels().find(channel => channel.subTopic === ROOM_TOPIC || channel.topic === `realtime:${ROOM_TOPIC}`)
  if (stale) { stale.teardown?.(); client.realtime._remove?.(stale) }
}

export default function useRaceRoom({ userId, nickname, paused, profile, config, sim, ready }) {
  const [photos, setPhotos] = useState({})
  const [runners, setRunners] = useState({})
  const runnerRef = useRef(null)
  runnerRef.current = { profile, config, sim, ready }
  const [messages, setMessages] = useState([])
  const [counts, setCounts] = useState({ online: 0, running: 0, members: [] })
  const [connection, setConnection] = useState('connecting')
  const [presenceConnection, setPresenceConnection] = useState('connecting')
  const [presenceError, setPresenceError] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const channelRef = useRef(null)
  const sendingRef = useRef(false)
  const pendingCleanup = useRef(Promise.resolve())
  const latest = useRef(null)
  latest.current = { nickname, status: paused ? 'paused' : 'running' }
  useEffect(() => {
    let alive = true
    const client = getSupabase()
    let channel
    // Chat lives on its own channel with a per-mount topic: its database subscription is
    // slower to confirm, and the head count must not wait for it or for an old channel.
    const chat = client.channel(`rundash-chat:${userId}:${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'race_messages' }, ({ new: row }) => { if (alive) setMessages((previous) => mergeMessages(previous, [row])) })
      // Moderation and retention deletes; with RLS on, the old record carries only the id.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'race_messages' }, ({ old }) => { if (alive && old?.id) setMessages((previous) => previous.filter(message => message.id !== old.id)) })
      .subscribe((status) => {
        if (!alive) return
        if (status === 'SUBSCRIBED') {
          setConnection('connected')
          client.from('race_messages').select('id,user_id,nickname,is_anonymous,message,created_at').order('created_at', { ascending: false }).limit(50)
            .then(({ data, error: loadError }) => {
              if (!alive) return
              if (loadError) setError('이전 대화를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.')
              else { setMessages((previous) => mergeMessages(previous, data || [])); setError('') }
            })
        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) setConnection('reconnecting')
      })
    let retryTimer
    // A failed or timed-out join is thrown away and rebuilt with a fresh token instead of
    // waiting on realtime-js's own rejoin, which keeps reusing the rejected join payload.
    const retry = (current, attempt, reason) => {
      if (!alive || channelRef.current !== current) return
      console.warn('[rundash] presence join failed:', reason)
      setPresenceError(String(reason || '')); setPresenceConnection('reconnecting'); setCounts({ online: 0, running: 0, members: [] })
      channelRef.current = null
      current?.teardown?.(); client.realtime._remove?.(current)
      retryTimer = setTimeout(() => connect(attempt + 1), Math.min(8000, 1000 * 2 ** attempt))
    }
    const connect = async (attempt = 0) => {
      await releasePreviousRoom(client, attempt ? Promise.resolve() : Promise.all([roomCleanup.get(client), pendingCleanup.current]))
      if (!alive) return
      // Make sure the socket carries the current session token before joining.
      try { await client.realtime.setAuth?.() } catch { /* the join reports auth problems */ }
      if (!alive) return
      channel = client.channel(ROOM_TOPIC, { config: { presence: { key: userId } } })
      channelRef.current = channel
      const runnerState = () => {
        const { profile: p, config: c, sim: source, ready: available } = runnerRef.current
        const s = source?.current
        if (!available || !s) return null
        const weather = weatherAt(s.weatherTimeMs)
        return { level: c.anonymous ? null : c.level, anonymous: !!c.anonymous, paceSec: c.paceSec, speed: s.speed * (s.speedMult || 0), distance: s.dist, targetKm: c.distanceKm, elapsed: s.elapsed, stamina: s.stamina, maxStamina: s.maxStamina, resting: s.resting, finished: s.finished, intensity: c.intensityLabel, outfit: p.outfit, booster: s.boostLeft > 0, rhythmBoost: s.rhythmBoostLeft > 0, weatherLabel: weather?.label, weatherDrain: Math.round(((weather?.drainMultiplier || 1) - 1) * 100), updatedAt: Date.now() }
      }
      // Live runner details go over broadcast, and only to someone who asked: presence
      // updates are rate limited per client and the server closes the channel past the limit.
      channel.on('broadcast', { event: 'runner-state-request' }, ({ payload }) => {
        if (payload?.target !== userId || typeof payload?.requester !== 'string') return
        const runner = runnerState()
        if (runner) channel.send({ type: 'broadcast', event: 'runner-state', payload: { requester: payload.requester, id: userId, runner } }).catch(() => {})
      }).on('broadcast', { event: 'runner-state' }, ({ payload }) => {
        if (!alive || payload?.requester !== userId || typeof payload.id !== 'string' || !payload.runner || typeof payload.runner !== 'object') return
        setRunners(previous => ({ ...previous, [payload.id]: payload.runner }))
      })
      channel.ownRunner = runnerState
      channel.on('broadcast', { event: 'runner-photo-request' }, ({ payload }) => {
        if (payload?.target !== userId || typeof payload?.requester !== 'string') return
        channel.send({ type: 'broadcast', event: 'runner-photo', payload: { requester: payload.requester, id: userId, image: runnerRef.current.profile?.avatar_image || null } }).catch(() => {})
      }).on('broadcast', { event: 'runner-photo' }, ({ payload }) => {
        if (!alive || payload?.requester !== userId || typeof payload.id !== 'string') return
        const image = payload.image
        if (image !== null && (typeof image !== 'string' || image.length > 60000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image))) return
        setPhotos(previous => ({ ...previous, [payload.id]: image }))
      })
      // Presence carries only who is here and whether they are running; re-sent on change only.
      channel.publishRunner = () => channel.track({ ...latest.current }).catch(() => {})
      const sync = () => {
        if (!alive) return
        const members = presenceMembers(channel.presenceState())
        setCounts({ members, online: members.length, running: members.filter(member => member.status === 'running').length })
      }
      const current = channel
      current.on('presence', { event: 'sync' }, sync)
      try {
        current.subscribe((status, error) => {
          if (!alive || channelRef.current !== current) return
          if (status === 'SUBSCRIBED') {
            setPresenceConnection('connected'); setPresenceError('')
            current.publishRunner()
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') retry(current, attempt, error?.message || status)
          else if (status === 'CLOSED') retry(current, attempt, 'closed')
        })
      } catch (error) { retry(current, attempt, error?.message) }
    }
    connect().catch((error) => { if (alive) { setPresenceConnection('reconnecting'); setPresenceError(String(error?.message || error)) } })
    return () => {
      alive = false; clearTimeout(retryTimer)
      channel = channelRef.current || channel; channelRef.current = null
      client.removeChannel(chat).catch(() => {})
      if (channel) { const release = client.removeChannel(channel).catch(() => {}); pendingCleanup.current = release; roomCleanup.set(client, release) }
    }
  }, [userId])
  useEffect(() => {
    if (presenceConnection === 'connected') channelRef.current?.publishRunner?.()
  }, [paused, nickname, presenceConnection])
  // Ask one runner for their live details (the details panel polls this while open).
  const watchRunner = useCallback(id => {
    if (id === userId) { const own = channelRef.current?.ownRunner?.(); if (own) setRunners(previous => ({ ...previous, [id]: own })); return }
    channelRef.current?.send({ type: 'broadcast', event: 'runner-state-request', payload: { target: id, requester: userId } }).catch(() => {})
  }, [userId])
  const loadPhoto = useCallback(id => {
    if (id === userId) { setPhotos(previous => ({ ...previous, [id]: runnerRef.current.profile?.avatar_image || null })); return }
    channelRef.current?.send({ type: 'broadcast', event: 'runner-photo-request', payload: { target: id, requester: userId } }).catch(() => {})
  }, [userId])
  const send = useCallback(async (text) => {
    const message = text.trim()
    if (sendingRef.current || !message || message.length > getSettings().chatMaxLength) return false
    sendingRef.current = true; setSending(true); setError('')
    try {
      const { data, error: sendError } = await getSupabase().rpc('send_race_message', { p_message: message, p_nickname: nickname })
      if (sendError) throw sendError
      setMessages((previous) => mergeMessages(previous, [data]))
      return true
    } catch (sendError) {
      setError(sendError.message?.includes('간격') || sendError.message?.includes('이용이 제한') ? sendError.message : '메시지를 보내지 못했어요. 연결을 확인한 뒤 다시 보내주세요.')
      return false
    } finally { sendingRef.current = false; setSending(false) }
  }, [nickname])
  const members = useMemo(() => counts.members.map(member => runners[member.id] ? { ...member, runner: runners[member.id] } : member), [counts.members, runners])
  return { messages, ...counts, members, connection, presenceConnection, presenceError, error, sending, send, userId, photos, loadPhoto, watchRunner }
}
