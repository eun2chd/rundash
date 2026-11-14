import { useCallback, useEffect, useRef, useState } from 'react'

export default function useConfirmation() {
  const [question, setQuestion] = useState(null)
  const pending = useRef(null)
  const confirm = useCallback((options) => {
    if (pending.current) return Promise.resolve(false)
    return new Promise((resolve) => {
      pending.current = resolve
      setQuestion(options)
    })
  }, [])
  const answer = useCallback((accepted) => {
    const resolve = pending.current
    pending.current = null
    setQuestion(null)
    resolve?.(accepted)
  }, [])
  useEffect(() => () => { pending.current?.(false); pending.current = null }, [])
  return { confirm, question, answer }
}
