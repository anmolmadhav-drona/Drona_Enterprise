'use client'

import { useState, useEffect } from 'react'
import { Search, LayoutDashboard, Building2, Users, IndianRupee, UsersRound, ArrowLeftRight, Receipt, FileBarChart, Command } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useApp, type ModuleKey } from '@/lib/app-store'

type SearchItem = {
  key: ModuleKey
  title: string
  category: string
  icon: any
}

const SEARCH_ITEMS: SearchItem[] = [
  { key: 'dashboard', title: 'Dashboard & Profitability Overview', category: 'Overview', icon: LayoutDashboard },
  { key: 'companies', title: 'Companies & Multi-Tenant Hierarchy', category: 'Master Data', icon: Building2 },
  { key: 'clients', title: 'Clients Master & Revenue Contracts', category: 'Master Data', icon: Users },
  { key: 'revenue', title: 'Revenue Entries & Invoices', category: 'Financials', icon: IndianRupee },
  { key: 'employees', title: 'Workforce & Employees Master', category: 'Master Data', icon: UsersRound },
  { key: 'allocations', title: 'Employee-to-Client Allocations', category: 'Financials', icon: ArrowLeftRight },
  { key: 'expenses', title: 'Expenses & Operational Costs', category: 'Financials', icon: Receipt },
  { key: 'reports', title: 'Business Intelligence & Reports', category: 'Analytics', icon: FileBarChart },
]

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void }) {
  const { setActiveModule, user } = useApp()
  const [query, setQuery] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  const filtered = SEARCH_ITEMS.filter((item) => {
    if (user?.role !== 'GROUP_ADMIN' && item.key === 'companies') return false
    return item.title.toLowerCase().includes(query.toLowerCase()) || item.category.toLowerCase().includes(query.toLowerCase())
  })

  function handleSelect(key: ModuleKey) {
    setActiveModule(key)
    onOpenChange(false)
    setQuery('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden border-slate-200 shadow-2xl rounded-2xl bg-white">
        <DialogTitle className="sr-only">Search workspace</DialogTitle>
        <div className="flex items-center pl-4 pr-12 border-b border-slate-100 bg-slate-50/50 relative">
          <Search className="h-4 w-4 text-[#08B6D8] shrink-0" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search modules, financial metrics, reports..."
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm h-12 text-slate-800 pr-2"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-slate-200 bg-white px-1.5 font-mono text-[10px] font-medium text-slate-400 shrink-0 mr-2">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 scroll-thin space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No matching workspace items found.</div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  onClick={() => handleSelect(item.key)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#E8F8FC]/60 transition group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-slate-100 text-[#0B2148] group-hover:bg-[#08B6D8] group-hover:text-white transition flex items-center justify-center">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#0B2148]">{item.title}</div>
                      <div className="text-[10px] text-slate-400">{item.category}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-[#08B6D8] opacity-0 group-hover:opacity-100 transition">Jump to</span>
                </button>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
