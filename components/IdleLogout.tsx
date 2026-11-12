'use client'
import { useEffect } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { sessionActivityKey } from '@/lib/session'

export default function IdleLogout({ userId, timeoutMinutes }: { userId: string; timeoutMinutes: number }) {
  useEffect(() => {
    if (!userId || !timeoutMinutes) return

    const key = sessionActivityKey(userId)
    const timeoutMs = timeoutMinutes * 60_000
    let lastActivity = Date.now()
    let lastSaved = 0
    let timer: ReturnType<typeof setTimeout>
    let ended = false
    const newSession = new URLSearchParams(location.search).get('session_started') === '1'

    const saveActivity = (at: number) => {
      if (at - lastSaved < 5_000) return
      try {
        localStorage.setItem(key, String(at))
        lastSaved = at
      } catch (error) {
        console.error('Could not synchronize session activity across tabs.', error)
      }
    }

    const logout = async () => {
      if (ended) return
      ended = true
      clearTimeout(timer)
      try {
        localStorage.removeItem(key)
      } catch (error) {
        console.error('Could not clear the saved session activity.', error)
      }
      try {
        const { error } = await supabaseBrowser().auth.signOut({ scope: 'local' })
        if (error) console.error('Could not sign out after inactivity.', error)
      } catch (error) {
        console.error('Could not sign out after inactivity.', error)
      } finally {
        location.replace('/login?reason=idle')
      }
    }

    const schedule = () => {
      clearTimeout(timer)
      const remaining = timeoutMs - (Date.now() - lastActivity)
      if (remaining <= 0) {
        void logout()
        return
      }
      timer = setTimeout(schedule, remaining)
    }

    const recordActivity = () => {
      if (ended) return
      const now = Date.now()
      if (now - lastActivity >= timeoutMs) {
        void logout()
        return
      }
      lastActivity = now
      saveActivity(now)
    }

    if (!newSession) {
      try {
        const saved = Number(localStorage.getItem(key))
        if (Number.isFinite(saved) && saved > 0) lastActivity = Math.min(saved, Date.now())
      } catch (error) {
        console.error('Could not read the saved session activity.', error)
      }
    }

    if (Date.now() - lastActivity >= timeoutMs) {
      void logout()
      return
    }

    saveActivity(lastActivity)
    schedule()
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key || !event.newValue) return
      const sharedActivity = Number(event.newValue)
      if (Number.isFinite(sharedActivity) && sharedActivity > lastActivity) {
        lastActivity = Math.min(sharedActivity, Date.now())
      }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') recordActivity()
    }
    const activityEvents: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'mousemove']
    activityEvents.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }))
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      ended = true
      clearTimeout(timer)
      activityEvents.forEach((event) => window.removeEventListener(event, recordActivity))
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [timeoutMinutes, userId])

  return null
}
