'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard, Building2, Users, IndianRupee, Receipt,
  UsersRound, ArrowLeftRight, FileBarChart, LogOut, Building, MapPin,
  CalendarRange, ChevronDown, Sparkles, ShieldAlert
} from 'lucide-react'
import { useApp, fetchJson, type ModuleKey, type AppUser } from '@/lib/app-store'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

import { DashboardModule } from './modules/DashboardModule'
import { CompaniesModule } from './modules/CompaniesModule'
import { ClientsModule } from './modules/ClientsModule'
import { RevenueModule } from './modules/RevenueModule'
import { EmployeesModule } from './modules/EmployeesModule'
import { AllocationsModule } from './modules/AllocationsModule'
import { ExpensesModule } from './modules/ExpensesModule'
import { ReportsModule } from './modules/ReportsModule'

type NavItem = {
  key: ModuleKey
  label: string
  icon: any
  desc: string
  accent: string
  roles: AppUser['role'][]
}

const NAV: NavItem[] = [
  { key: 'dashboard',     label: 'Dashboard',     icon: LayoutDashboard,  desc: 'KPIs & charts',          accent: 'bg-primary/10 text-primary',         roles: ['GROUP_ADMIN', 'COMPANY_ADMIN', 'STANDARD_USER'] },
  { key: 'companies',     label: 'Companies',     icon: Building2,         desc: 'Tenant hierarchy',        accent: 'bg-violet-100 text-violet-700',       roles: ['GROUP_ADMIN'] },
  { key: 'clients',       label: 'Clients',       icon: Users,             desc: 'Master data',             accent: 'bg-emerald-100 text-emerald-700',     roles: ['GROUP_ADMIN', 'COMPANY_ADMIN', 'STANDARD_USER'] },
  { key: 'revenue',       label: 'Revenue',       icon: IndianRupee,       desc: 'Invoices & entries',      accent: 'bg-amber-100 text-amber-700',         roles: ['GROUP_ADMIN', 'COMPANY_ADMIN', 'STANDARD_USER'] },
  { key: 'employees',     label: 'Employees',     icon: UsersRound,       desc: 'Workforce master',         accent: 'bg-violet-100 text-violet-700',       roles: ['GROUP_ADMIN', 'COMPANY_ADMIN', 'STANDARD_USER'] },
  { key: 'allocations',   label: 'Allocations',   icon: ArrowLeftRight,   desc: 'Employee → Client',       accent: 'bg-sky-100 text-sky-700',             roles: ['GROUP_ADMIN', 'COMPANY_ADMIN', 'STANDARD_USER'] },
  { key: 'expenses',      label: 'Expenses',      icon: Receipt,          desc: 'Operational costs',       accent: 'bg-amber-100 text-amber-700',         roles: ['GROUP_ADMIN', 'COMPANY_ADMIN', 'STANDARD_USER'] },
  { key: 'reports',       label: 'Reports',       icon: FileBarChart,     desc: 'Profitability',           accent: 'bg-primary/10 text-primary',          roles: ['GROUP_ADMIN', 'COMPANY_ADMIN'] },
]

const ROLE_LABELS: Record<AppUser['role'], string> = {
  GROUP_ADMIN: 'Group Admin',
  COMPANY_ADMIN: 'Company Admin',
  STANDARD_USER: 'Standard User',
}

export function AppShell() {
  const { user, activeModule, setActiveModule, logout, filterCompanyId, filterLocationId, filterClientTypeId, filterFrom, filterTo, setFilter } = useApp()
  const [companies, setCompanies] = useState<{ id: string; name: string; code: string; type: string }[]>([])
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [clientTypes, setClientTypes] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const [c, l, t] = await Promise.all([
          fetchJson<{ companies: any[] }>('/api/companies'),
          fetchJson<{ items: { id: string; name: string }[] }>('/api/locations'),
          fetchJson<{ items: { id: string; name: string }[] }>('/api/client-types'),
        ])
        setCompanies(c.companies)
        setLocations(l.items)
        setClientTypes(t.items)
      } catch (e) {
        // ignore
      }
    })()
  }, [user])

  const navItems = useMemo(() => NAV.filter((n) => user && n.roles.includes(user.role)), [user])

  async function handleLogout() {
    try {
      await fetchJson('/api/auth/logout', { method: 'POST' })
    } catch {}
    logout()
    toast.success('Signed out')
  }

  if (!user) return null

  // Only GROUP_ADMIN can pick the company filter
  const canPickCompany = user.role === 'GROUP_ADMIN'
  // For tenant users, lock the filter to their company
  const effectiveCompanyId = canPickCompany
    ? filterCompanyId
    : user.companyId

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="hidden lg:flex w-64 flex-col bg-sidebar text-sidebar-foreground shrink-0 sticky top-0 h-screen">
          <div className="px-5 py-5 flex items-center gap-2.5 border-b border-sidebar-border">
            <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Building className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Drona Suite</div>
              <div className="text-[11px] text-sidebar-foreground/60">Profitability v1.0</div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-4 space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = activeModule === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveModule(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition group ${
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                      : 'hover:bg-sidebar-accent/60 text-sidebar-foreground/85'
                  }`}
                >
                  <span className={`h-8 w-8 rounded-md flex items-center justify-center ${active ? 'bg-sidebar-primary text-sidebar-primary-foreground' : item.accent}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-left">
                    <span className="block font-medium leading-tight">{item.label}</span>
                    <span className="block text-[10px] text-sidebar-foreground/55">{item.desc}</span>
                  </span>
                </button>
              )
            })}
          </nav>

          <div className="px-3 py-3 border-t border-sidebar-border">
            <div className="rounded-lg bg-sidebar-accent/60 p-3">
              <div className="flex items-center gap-2 text-xs text-sidebar-foreground/70 mb-1">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Tenant context</span>
              </div>
              <div className="text-sm font-medium text-sidebar-foreground">
                {user.company ? user.company.name : 'All companies'}
              </div>
              <div className="text-[10px] text-sidebar-foreground/55 mt-0.5">
                Role · {ROLE_LABELS[user.role]}
              </div>
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
            <div className="flex items-center gap-3 px-4 lg:px-8 h-16">
              <div className="lg:hidden flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
                  <Building className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-sm font-semibold">Drona Suite</span>
              </div>
              <div className="hidden lg:block">
                <h1 className="text-lg font-semibold tracking-tight capitalize">
                  {NAV.find((n) => n.key === activeModule)?.label ?? 'Dashboard'}
                </h1>
                <p className="text-[11px] text-muted-foreground -mt-0.5">
                  {NAV.find((n) => n.key === activeModule)?.desc ?? ''}
                </p>
              </div>

              <div className="ml-auto flex items-center gap-2">
                {/* Filters popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-2">
                      <CalendarRange className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Filters</span>
                      <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                        {[
                          effectiveCompanyId ? '1' : '0',
                          // We always have date range active
                          '',
                        ].filter(Boolean).length || 1}
                      </Badge>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80">
                    <div className="space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Filters
                      </div>

                      {canPickCompany && (
                        <div className="space-y-1.5">
                          <Label className="text-xs flex items-center gap-1.5">
                            <Building className="h-3 w-3" /> Company
                          </Label>
                          <Select
                            value={filterCompanyId ?? 'all'}
                            onValueChange={(v) => setFilter({ filterCompanyId: v === 'all' ? null : v })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="All companies" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All companies (consolidated)</SelectItem>
                              {companies.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name} · {c.code}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label className="text-xs flex items-center gap-1.5">
                          <MapPin className="h-3 w-3" /> Location
                        </Label>
                        <Select
                          value={filterLocationId ?? 'all'}
                          onValueChange={(v) => setFilter({ filterLocationId: v === 'all' ? null : v })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="All locations" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All locations</SelectItem>
                            {locations.map((l) => (
                              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs flex items-center gap-1.5">
                          <Users className="h-3 w-3" /> Client Type
                        </Label>
                        <Select
                          value={filterClientTypeId ?? 'all'}
                          onValueChange={(v) => setFilter({ filterClientTypeId: v === 'all' ? null : v })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="All client types" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All client types</SelectItem>
                            {clientTypes.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">From</Label>
                          <input
                            type="date"
                            value={filterFrom}
                            onChange={(e) => setFilter({ filterFrom: e.target.value })}
                            className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">To</Label>
                          <input
                            type="date"
                            value={filterTo}
                            onChange={(e) => setFilter({ filterTo: e.target.value })}
                            className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <Separator orientation="vertical" className="h-7" />

                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {user.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block leading-tight">
                    <div className="text-xs font-medium">{user.name}</div>
                    <div className="text-[10px] text-muted-foreground">{ROLE_LABELS[user.role]}</div>
                  </div>
                </div>

                <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Mobile nav scroller */}
            <div className="lg:hidden flex gap-1 px-3 pb-2 overflow-x-auto scroll-thin">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = activeModule === item.key
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveModule(item.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap ${
                      active ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </header>

          {/* Module content */}
          <main className="flex-1 px-4 lg:px-8 py-6 lg:py-8">
            {user.role !== 'GROUP_ADMIN' && activeModule === 'companies' ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-6 border rounded-lg bg-background">
                <ShieldAlert className="h-4 w-4" /> Only Group Admin can manage companies.
              </div>
            ) : (
              <ModuleHost moduleKey={activeModule} />
            )}
          </main>

          {/* Footer */}
          <footer className="mt-auto border-t bg-background">
            <div className="px-4 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <div>
                © {new Date().getFullYear()} Drona Enterprises · Multi-tenant Profitability Suite
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Data isolated per tenant
                </span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Shared codebase
                </span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}

function ModuleHost({ moduleKey }: { moduleKey: ModuleKey }) {
  switch (moduleKey) {
    case 'dashboard': return <DashboardModule />
    case 'companies': return <CompaniesModule />
    case 'clients': return <ClientsModule />
    case 'revenue': return <RevenueModule />
    case 'employees': return <EmployeesModule />
    case 'allocations': return <AllocationsModule />
    case 'expenses': return <ExpensesModule />
    case 'reports': return <ReportsModule />
    default: return <DashboardModule />
  }
}
