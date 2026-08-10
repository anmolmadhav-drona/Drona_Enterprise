'use client'

import { useState } from 'react'
import { Building2, Lock, Mail, Loader2, ShieldCheck, Users, ChevronRight } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { fetchJson } from '@/lib/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

const DEMO_ACCOUNTS = [
  { label: 'Group Admin', email: 'group.admin@drona.com', password: 'admin123', role: 'Drona Enterprises', tone: 'violet' },
  { label: 'Logitech Admin', email: 'logitech.admin@drona.com', password: 'admin123', role: 'Drona Logitech', tone: 'blue' },
  { label: 'Valuechain Admin', email: 'valuechain.admin@drona.com', password: 'admin123', role: 'Drona Valuechain', tone: 'green' },
  { label: 'Standard User', email: 'user.logitech@drona.com', password: 'user123', role: 'Tenant user', tone: 'amber' },
]

export function LoginScreen() {
  const setUser = useApp((s) => s.setUser)
  const [email, setEmail] = useState('group.admin@drona.com')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { user } = await fetchJson<{ user: any }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setUser(user)
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`)
    } catch (err: any) {
      toast.error(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  function quickLogin(acc: typeof DEMO_ACCOUNTS[number]) {
    setEmail(acc.email)
    setPassword(acc.password)
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-gradient-to-br from-primary/95 via-primary to-primary/90">
      {/* Left: Brand + diagram-style architecture preview */}
      <div className="flex-1 p-8 lg:p-14 text-primary-foreground flex flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary-foreground/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Drona Enterprises</h1>
            <p className="text-xs text-primary-foreground/70">Profitability Management Suite</p>
          </div>
        </div>

        <div className="my-8 lg:my-0 max-w-md">
          <h2 className="text-3xl lg:text-4xl font-bold leading-tight tracking-tight">
            Track revenue, cost & profit across every company.
          </h2>
          <p className="mt-3 text-primary-foreground/80 text-sm lg:text-base">
            A multi-tenant ERP that isolates data per company while letting Group admins compare
            performance and drill into per-client profitability.
          </p>

          {/* Mini architecture sketch */}
          <div className="mt-7 grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg bg-white/10 ring-1 ring-white/15 p-3">
              <Users className="h-4 w-4 mb-1.5" />
              <div className="font-semibold">Parent</div>
              <div className="text-primary-foreground/70">Drona Enterprises</div>
            </div>
            <div className="rounded-lg bg-white/10 ring-1 ring-white/15 p-3">
              <Building2 className="h-4 w-4 mb-1.5" />
              <div className="font-semibold">Tenant A</div>
              <div className="text-primary-foreground/70">Drona Logitech</div>
            </div>
            <div className="rounded-lg bg-white/10 ring-1 ring-white/15 p-3">
              <Building2 className="h-4 w-4 mb-1.5" />
              <div className="font-semibold">Tenant B</div>
              <div className="text-primary-foreground/70">Drona Valuechain</div>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-primary-foreground/60">
          Multi-tenant · Role-based access · Isolated databases · Shared codebase
        </div>
      </div>

      {/* Right: Login card */}
      <div className="flex-1 lg:flex-none lg:w-[480px] bg-background flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-sm">
          <Card className="border-0 shadow-xl">
            <CardHeader className="space-y-1 pb-2">
              <div className="flex items-center gap-2 text-primary">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-wide">Secure Sign In</span>
              </div>
              <CardTitle className="text-2xl">Welcome back</CardTitle>
              <CardDescription className="text-muted-foreground">
                Enter your credentials to access your tenant.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loading ? 'Signing in…' : 'Sign In'}
                </Button>
              </form>

              <div className="mt-6 pt-4 border-t">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
                  Quick demo logins
                </div>
                <div className="space-y-1.5">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => quickLogin(acc)}
                      className="w-full flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs hover:bg-accent/70 transition group"
                    >
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                        <span className="font-medium">{acc.label}</span>
                        <span className="text-muted-foreground">· {acc.role}</span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition" />
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
