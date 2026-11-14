import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'

export function peerDistance(peer, now = Date.now()) {
  const age = Math.max(0, Math.min(6, (now - peer.receivedAt) / 1000))
  return peer.distance_m + (peer.paused ? 0 : peer.speed * age)
}

export default function useRunningSocial({ profile, config, sim, ready }) {
  const [data, setData] = useState({ peers: [], invites: [], pair: null })
  const [publicLocation, setPublicLocation] = useState(true)
  const [allowInvites, setAllowInvites] = useState(true)
  const [error, setError] = useState('')
  const [focusId, setFocusId] = useState(null)
  const [connected, setConnected] = useState(false)
  const options = useRef({ publicLocation, allowInvites })
  options.current = { publicLocation, allowInvites, focusId }
  const refreshRef = useRef(() => {})
  const enabled = ready && !config.anonymous
  useEffect(() => {
    if (!enabled) return
    let alive = true, busy = false
    const refresh = async () => {
      if (busy || !alive || sim.current.finished) return
      busy = true
      try {
        const s = sim.current
        const value = await api.socialTick({ runId: config.id, distance: s.dist, speed: s.speed * (s.speedMult || 0), paused: s.paused || s.resting, ...options.current })
        if (options.current.focusId && !value.peers.some(peer => peer.id === options.current.focusId)) {
          const focused = await api.locateFriend(options.current.focusId)
          if (focused) value.peers.push(focused)
        }
        if (alive) {
          const now = Date.now()
          setData({ ...value, peers: value.peers.map(peer => ({ ...peer, receivedAt: now })) })
          setConnected(true); setError('')
        }
      } catch {
        if (alive) { setConnected(false); setData({ peers: [], invites: [], pair: null }); setError('친구 연결이 잠시 끊겼어요. 자동으로 다시 연결할게요.') }
      } finally { busy = false }
    }
    refreshRef.current = refresh
    refresh()
    const timer = setInterval(refresh, 3000)
    window.addEventListener('focus', refresh)
    return () => {
      alive = false; clearInterval(timer); window.removeEventListener('focus', refresh)
      refreshRef.current = () => {}
      api.endPair().catch(() => {})
    }
  }, [enabled, config.id, sim])
  useEffect(() => { refreshRef.current() }, [publicLocation, allowInvites, focusId])
  const refresh = useCallback(() => refreshRef.current(), [])
  return { ...data, enabled, connected, error, publicLocation, allowInvites, setPublicLocation, setAllowInvites, setFocusId, refresh }
}
