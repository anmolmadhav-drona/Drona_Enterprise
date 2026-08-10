'use client'

import { useEffect } from 'react'
import { useApp, fetchJson, type AppUser, type ModuleKey } from '@/lib/app-store'
import { LoginScreen } from './LoginScreen'
import { AppShell } from './AppShell'
import { Loader2 } from 'lucide-react'

export function DronaApp() {
  const { user, loading, setUser, setLoading } = useApp()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { user } = await fetchJson<{ user: AppUser | null }>('/api/auth/me')
        if (!cancelled) {
          setUser(user)
        }
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setUser, setLoading])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <div className="text-sm text-muted-foreground">Loading Drona suite…</div>
      </div>
    )
  }

  if (!user) return <LoginScreen />
  return <AppShell />
}

// Re-export types for module authors
export type { ModuleKey, AppUser } from '@/lib/app-store'
