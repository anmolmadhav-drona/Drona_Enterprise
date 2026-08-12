'use client'

import { useState } from 'react'
import { Lock, Mail, Loader2, ShieldCheck, ChevronRight } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { fetchJson } from '@/lib/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { DronaLogo } from './branding/DronaLogo'

const DEMO_ACCOUNTS = [
  { label: 'Group Admin', email: 'group.admin@drona.com', password: 'admin123', role: 'Drona Enterprises (All Companies)', badge: 'bg-[#0B2148] text-white' },
  { label: 'Company Admin', email: 'logitech.admin@drona.com', password: 'admin123', role: 'Drona Logitech', badge: 'bg-[#08B6D8]/15 text-[#0B2148]' },
  { label: 'Company Admin', email: 'valuechain.admin@drona.com', password: 'admin123', role: 'Drona Valuechain', badge: 'bg-[#08B6D8]/15 text-[#0B2148]' },
  { label: 'Standard User', email: 'user.logitech@drona.com', password: 'user123', role: 'Logitech (View-only)', badge: 'bg-slate-100 text-slate-700' },
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
    <div className="h-screen w-full flex flex-col lg:flex-row bg-[#0B2148] relative overflow-hidden font-sans text-slate-100">
      {/* Left Column: Full Hero Video (Plays once on load, no loop) */}
      <div className="flex-1 relative z-10 h-full overflow-hidden bg-[#0B2148] flex flex-col justify-between p-6 lg:p-10">
        {/* Floating Top Brand Logo */}
        <div className="relative z-20">
          <DronaLogo variant="dark" />
        </div>

        {/* Hero Image Container */}
        <div className="absolute inset-0 z-10 w-full h-full flex items-center justify-center bg-[#0B2148]">
          <img
            src="/brand/hero_image.gif"
            alt="Drona Enterprises Hero"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Bottom subtle copyright overlay */}
        <div className="relative z-20 text-[11px] text-white/80 font-medium drop-shadow-md">
          © {new Date().getFullYear()} Drona Enterprises. Multi-Tenant Enterprise Suite.
        </div>
      </div>

      {/* Right Column: Secure Authentication Form */}
      <div className="flex-1 lg:flex-none lg:w-[460px] bg-[#F8FBFD] text-slate-900 flex items-center justify-center p-4 lg:p-8 relative z-20 border-l border-white/10 shadow-2xl h-full overflow-y-auto lg:overflow-hidden">
        <div className="w-full max-w-sm">
          <Card className="border border-slate-200/80 shadow-2xl bg-white rounded-2xl overflow-hidden">
            <CardHeader className="space-y-1 pb-2 pt-4 px-5 bg-slate-50/50 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-[#0B2148]">
                <ShieldCheck className="h-4 w-4 text-[#08B6D8]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0B2148]">Secure Workspace Access</span>
              </div>
              <CardTitle className="text-xl font-bold text-[#0B2148] tracking-tight">Welcome back</CardTitle>
              <CardDescription className="text-slate-500 text-[11px]">
                Enter your credentials to access your Drona workspace.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-[11px] font-semibold text-slate-700">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-8 h-9 border-slate-200 focus:border-[#08B6D8] focus:ring-2 focus:ring-[#08B6D8]/20 rounded-lg text-xs"
                      placeholder="name@drona.com"
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-[11px] font-semibold text-slate-700">Password</Label>
                    <span className="text-[10px] text-[#08B6D8] font-medium cursor-pointer hover:underline">Forgot password?</span>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-8 h-9 border-slate-200 focus:border-[#08B6D8] focus:ring-2 focus:ring-[#08B6D8]/20 rounded-lg text-xs"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-9 bg-[#0B2148] hover:bg-[#102B63] text-white font-semibold text-xs rounded-lg shadow-md transition-all duration-200 flex items-center justify-center gap-2 mt-1"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#08B6D8]" /> : null}
                  {loading ? 'Authenticating…' : 'Sign In to Workspace'}
                </Button>
              </form>

              {/* Demo Accounts Panel */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick Demo Accounts</span>
                  <span className="text-[9px] text-slate-400">Click to fill</span>
                </div>

                <div className="space-y-1.5">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => quickLogin(acc)}
                      className="w-full flex items-center justify-between p-2 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-[#E8F8FC]/50 hover:border-[#08B6D8]/40 transition text-left group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[11px] text-[#0B2148] truncate">{acc.label}</span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded ${acc.badge}`}>{acc.role}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">{acc.email}</div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#08B6D8] group-hover:translate-x-0.5 transition shrink-0" />
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
