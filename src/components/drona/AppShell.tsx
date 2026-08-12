'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard, Building2, Users, IndianRupee, Receipt,
  UsersRound, ArrowLeftRight, FileBarChart, LogOut, Building, MapPin,
  CalendarRange, ChevronDown, Sparkles, ShieldAlert, Search, Command,
  PlusCircle, SlidersHorizontal, Menu, X, ShieldCheck, FileSpreadsheet
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
import { DronaLogo } from './branding/DronaLogo'
import { DronaLogoMark } from './branding/DronaLogoMark'
import { GlobalSearch } from './GlobalSearch'

import { DashboardModule } from './modules/DashboardModule'
import { CompaniesModule } from './modules/CompaniesModule'
import { ClientsModule } from './modules/ClientsModule'
import { RevenueModule } from './modules/RevenueModule'
import { EmployeesModule } from './modules/EmployeesModule'
import { AllocationsModule } from './modules/AllocationsModule'
import { ExpensesModule } from './modules/ExpensesModule'
import { ReportsModule } from './modules/ReportsModule'
import { TallyImportModule } from './modules/TallyImportModule'
import { CustomModuleBuilder } from './modules/CustomModuleBuilder'

type NavGroup = {
  title: string
  items: {
    key: ModuleKey
    label: string
    icon: any
    desc: string
    roles: AppUser['role'][]
  }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'OVERVIEW',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Profitability Command Center', roles: ['GROUP_ADMIN', 'COMPANY_ADMIN', 'STANDARD_USER'] },
    ]
  },
  {
    title: 'MASTER DATA',
    items: [
      { key: 'companies', label: 'Companies', icon: Building2, desc: 'Multi-Tenant Hierarchy', roles: ['GROUP_ADMIN'] },
      { key: 'clients', label: 'Clients', icon: Users, desc: 'Customers & Contracts', roles: ['GROUP_ADMIN', 'COMPANY_ADMIN', 'STANDARD_USER'] },
      { key: 'employees', label: 'Employees', icon: UsersRound, desc: 'Workforce Roster', roles: ['GROUP_ADMIN', 'COMPANY_ADMIN', 'STANDARD_USER'] },
    ]
  },
  {
    title: 'FINANCIALS',
    items: [
      { key: 'revenue', label: 'Revenue', icon: IndianRupee, desc: 'Invoices & Billing', roles: ['GROUP_ADMIN', 'COMPANY_ADMIN', 'STANDARD_USER'] },
      { key: 'allocations', label: 'Allocations', icon: ArrowLeftRight, desc: 'Workforce to Client %', roles: ['GROUP_ADMIN', 'COMPANY_ADMIN', 'STANDARD_USER'] },
      { key: 'expenses', label: 'Expenses', icon: Receipt, desc: 'Operational Costs', roles: ['GROUP_ADMIN', 'COMPANY_ADMIN', 'STANDARD_USER'] },
    ]
  },
  {
    title: 'ANALYTICS',
    items: [
      { key: 'reports', label: 'Reports', icon: FileBarChart, desc: 'Financial Intelligence', roles: ['GROUP_ADMIN', 'COMPANY_ADMIN'] },
    ]
  },
  {
    title: 'DATA MANAGEMENT',
    items: [
      { key: 'import', label: 'Tally Data Import', icon: FileSpreadsheet, desc: 'Tally Excel Sync & Audit', roles: ['GROUP_ADMIN', 'COMPANY_ADMIN'] },
    ]
  }
]

const ROLE_LABELS: Record<AppUser['role'], string> = {
  GROUP_ADMIN: 'Group Admin',
  COMPANY_ADMIN: 'Company Admin',
  STANDARD_USER: 'Standard User',
}

export function AppShell() {
  const { user, activeModule, setActiveModule, logout } = useApp()
  const [companies, setCompanies] = useState<{ id: string; name: string; code: string; type: string }[]>([])
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [clientTypes, setClientTypes] = useState<{ id: string; name: string }[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [moduleBuilderOpen, setModuleBuilderOpen] = useState(false)

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

  async function handleLogout() {
    try {
      await fetchJson('/api/auth/logout', { method: 'POST' })
    } catch {}
    logout()
    toast.success('Signed out safely')
  }

  if (!user) return null

  const canPickCompany = user.role === 'GROUP_ADMIN'

  const activeItemLabel = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.key === activeModule)?.label ?? 'Dashboard'

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FBFD] font-sans antialiased text-slate-900">
      {/* Global Search Dialog */}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Custom Module Builder Modal */}
      <CustomModuleBuilder open={moduleBuilderOpen} onOpenChange={setModuleBuilderOpen} />

      <div className="flex flex-1 min-h-0">
        {/* Sidebar Desktop */}
        <aside className="hidden lg:flex w-64 flex-col bg-[#081B3A] text-white shrink-0 sticky top-0 h-screen border-r border-white/10 shadow-xl z-40">
          {/* Logo Header */}
          <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
            <DronaLogo variant="dark" compact />
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#08B6D8]/20 text-[#16C4E8] tracking-widest uppercase">
              v1.0
            </span>
          </div>

          {/* Nav Groups */}
          <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-4 space-y-6">
            {NAV_GROUPS.map((group) => {
              const visibleItems = group.items.filter((item) => item.roles.includes(user.role))
              if (visibleItems.length === 0) return null

              return (
                <div key={group.title} className="space-y-1">
                  <div className="px-3 text-[10px] font-bold tracking-wider uppercase text-slate-400">
                    {group.title}
                  </div>
                  {visibleItems.map((item) => {
                    const Icon = item.icon
                    const active = activeModule === item.key
                    return (
                      <button
                        key={item.key}
                        onClick={() => setActiveModule(item.key)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 relative group ${
                          active
                            ? 'bg-[#08B6D8]/15 text-white font-semibold shadow-sm'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {/* Active Cyan Left Bar Indicator */}
                        {active && (
                          <div className="absolute left-0 top-2 bottom-2 w-1 bg-[#08B6D8] rounded-r-full" />
                        )}

                        <span className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${
                          active ? 'bg-[#08B6D8] text-[#081B3A]' : 'bg-white/5 text-slate-400 group-hover:text-[#08B6D8]'
                        }`}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>

                        <div className="flex-1 text-left min-w-0">
                          <div className="leading-snug truncate">{item.label}</div>
                          <div className="text-[10px] text-slate-400 truncate">{item.desc}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })}

            {/* Custom Business Module Action */}
            <div className="pt-2 px-1">
              <button
                onClick={() => setModuleBuilderOpen(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#08B6D8]/20 to-transparent border border-[#08B6D8]/30 text-[#16C4E8] hover:bg-[#08B6D8]/25 transition"
              >
                <PlusCircle className="h-4 w-4" />
                + Create Business Module
              </button>
            </div>
          </nav>

          {/* Sidebar Footer: Tenant Workspace Card */}
          <div className="p-3 border-t border-white/10">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 backdrop-blur">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span className="flex items-center gap-1 font-semibold text-[#08B6D8]">
                  <Sparkles className="h-3 w-3" /> Current Workspace
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white/10 text-white">
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
              <div className="text-xs font-bold text-white truncate">
                {user.company ? user.company.name : 'All Companies (Group)'}
              </div>
              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                {user.email}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Workspace Column */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Glassmorphic Header */}
          <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
            <div className="flex items-center justify-between px-4 lg:px-8 h-16">
              {/* Left: Mobile Toggle & Breadcrumb */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>

                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-[#0B2148]">Drona Suite</span>
                  <span>/</span>
                  <span className="font-semibold text-slate-800">{activeItemLabel}</span>
                </div>

                <div className="sm:hidden font-bold text-sm text-[#0B2148]">
                  {activeItemLabel}
                </div>
              </div>

              {/* Center: Quick Search Trigger */}
              <div className="hidden md:flex flex-1 max-w-md mx-6">
                <button
                  onClick={() => setSearchOpen(true)}
                  className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl border border-slate-200/80 bg-slate-50/80 hover:bg-white hover:border-[#08B6D8]/50 transition shadow-sm text-xs text-slate-400"
                >
                  <span className="flex items-center gap-2">
                    <Search className="h-3.5 w-3.5 text-[#08B6D8]" />
                    Search modules, entities, reports...
                  </span>
                  <kbd className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                    <Command className="h-2.5 w-2.5" /> K
                  </kbd>
                </button>
              </div>

              {/* Right Header Tools: User Profile, Sign out */}
              <div className="flex items-center gap-2.5">
                {/* User Profile Info */}
                <div className="flex items-center gap-2">
                  <Avatar className="h-9 w-9 border border-slate-200">
                    <AvatarFallback className="bg-[#0B2148] text-white text-xs font-bold">
                      {user.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden xl:block leading-tight text-left">
                    <div className="text-xs font-bold text-[#0B2148]">{user.name}</div>
                    <div className="text-[10px] text-slate-500 font-medium">{ROLE_LABELS[user.role]}</div>
                  </div>
                </div>

                <Button variant="ghost" size="icon" onClick={handleLogout} className="h-9 w-9 text-[#0B2148] hover:text-red-600 hover:bg-red-50 rounded-xl" title="Sign out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Mobile Nav Scroller */}
            {mobileMenuOpen && (
              <div className="lg:hidden border-t border-slate-200 p-3 bg-white space-y-3">
                {NAV_GROUPS.map((g) => (
                  <div key={g.title} className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">{g.title}</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {g.items.filter((i) => i.roles.includes(user.role)).map((item) => {
                        const Icon = item.icon
                        const active = activeModule === item.key
                        return (
                          <button
                            key={item.key}
                            onClick={() => {
                              setActiveModule(item.key)
                              setMobileMenuOpen(false)
                            }}
                            className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium text-left ${
                              active ? 'bg-[#0B2148] text-white' : 'bg-slate-50 text-slate-700'
                            }`}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </header>

          {/* Workspace Module View */}
          <main className="flex-1 px-4 lg:px-8 py-6 max-w-7xl w-full mx-auto">
            {user.role !== 'GROUP_ADMIN' && activeModule === 'companies' ? (
              <div className="flex items-center gap-3 text-sm text-slate-600 p-6 border border-slate-200 rounded-2xl bg-white shadow-sm">
                <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0" />
                Only Group Admins can view and manage company tenant structures.
              </div>
            ) : (
              <ModuleHost moduleKey={activeModule} />
            )}
          </main>

          {/* Footer */}
          <footer className="mt-auto border-t border-slate-200/80 bg-white">
            <div className="px-4 lg:px-8 py-4 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
              <div>
                © {new Date().getFullYear()} <span className="font-semibold text-[#0B2148]">Drona Enterprises</span> · Multi-Tenant Profitability Suite
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Isolated DB Context
                </span>
                <span>·</span>
                <span className="flex items-center gap-1.5 text-[#08B6D8] font-medium">
                  <ShieldCheck className="h-3.5 w-3.5" /> Enterprise RBAC Enforced
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
    case 'import': return <TallyImportModule />
    default: return <DashboardModule />
  }
}
