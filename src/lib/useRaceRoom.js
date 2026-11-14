import { useCallback, useEffect, useRef, useState } from 'react'
import { getSettings } from './settings'
import { getSupabase } from './supabase'
import { mergeMessages, presenceMembers } from './chat'

const roomCleanup = new WeakMap()

export default function useRaceRoom({ userId, nickname, paused }) {
  const [messages, setMessages] = useState([])
  const [counts, setCounts] = useState({ online: 0, running: 0, members: [] })
  const [connection, setConnection] = useState('connecting')
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
    const connect = async () => {
      await Promise.all([roomCleanup.get(client), pendingCleanup.current])
      if (!alive) return
      channel = client.channel('rundash-running-room', { config: { presence: { key: userId } } })
      channelRef.current = channel
      const sync = () => {
        if (!alive) return
        const members = presenceMembers(channel.presenceState())
        setCounts({ members, online: members.length, running: members.filter(member => member.status === 'running').length })
      }
      channel.on('presence', { event: 'sync' }, sync)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'race_messages' }, ({ new: row }) => { if (alive) setMessages((previous) => mergeMessages(previous, [row])) })
        .subscribe((status) => {
          if (!alive) return
          if (status === 'SUBSCRIBED') {
            setConnection('connected')
            channel.track(latest.current).catch(() => { if (alive) setConnection('reconnecting') })
            client.from('race_messages').select('id,user_id,nickname,is_anonymous,message,created_at').order('created_at', { ascending: false }).limit(50)
              .then(({ data, error: loadError }) => {
                if (!alive) return
                if (loadError) setError('이전 대화를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.')
                else { setMessages((previous) => mergeMessages(previous, data || [])); setError('') }
              })
          } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
            setConnection('reconnecting'); setCounts({ online: 0, running: 0, members: [] })
          }
        })
    }
    connect().catch(() => { if (alive) setConnection('reconnecting') })
    return () => {
      alive = false; channelRef.current = null
      if (channel) { const release = client.removeChannel(channel).catch(() => {}); pendingCleanup.current = release; roomCleanup.set(client, release) }
    }
  }, [userId])
  useEffect(() => {
    if (connection === 'connected') channelRef.current?.track(latest.current).catch(() => {})
  }, [paused, nickname, connection])
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
  return { messages, ...counts, connection, error, sending, send, userId }
}
