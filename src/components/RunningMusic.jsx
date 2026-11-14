import { useEffect, useRef, useState } from 'react'
import { LuVolume2, LuVolumeX } from 'react-icons/lu'

export default function RunningMusic() {
  const audioRef = useRef(null)
  const request = useRef(0)
  const wanted = useRef(false)
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const audio = audioRef.current
    audio.volume = 0.35
    return () => {
      request.current++
      wanted.current = false
      audio.pause()
      audio.currentTime = 0
    }
  }, [])

  const toggle = async () => {
    const audio = audioRef.current
    const id = ++request.current
    wanted.current = !wanted.current
    setEnabled(wanted.current)
    setError('')
    if (!wanted.current) {
      audio.pause()
      return
    }
    try {
      await audio.play()
      if (!wanted.current) audio.pause()
    } catch {
      if (id !== request.current) return
      wanted.current = false
      setEnabled(false)
      setError('배경음을 재생하지 못했어요. 다시 켜 주세요.')
    }
  }

  return (
    <div className="running-music">
      <audio ref={audioRef} src="/audio/leafy-trail.mp3" loop preload="none" />
      <button type="button" className="chat-toggle" aria-pressed={enabled} onClick={toggle}>
        {enabled ? <LuVolume2 /> : <LuVolumeX />} 배경음 {enabled ? 'ON' : 'OFF'}
      </button>
      {error && <p className="running-music-error" role="status">{error}</p>}
    </div>
  )
}
