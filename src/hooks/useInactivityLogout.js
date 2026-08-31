import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

const INACTIVITY_MS = 20 * 60 * 1000 // 20 minutes

/**
 * Auto-logout after 20 minutes of inactivity.
 * Listens to mouse/keyboard/scroll/touch events to reset the timer.
 */
export function useInactivityLogout(onLogout) {
  const timerRef = useRef(null)
  const { user, signOut } = useAuth()

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      await signOut()
      if (onLogout) onLogout()
    }, INACTIVITY_MS)
  }, [signOut, onLogout])

  useEffect(() => {
    if (!user) return // Only active when logged in

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'touchmove']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset() // Start timer immediately

    return () => {
      events.forEach(e => window.removeEventListener(e, reset))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [user, reset])
}
