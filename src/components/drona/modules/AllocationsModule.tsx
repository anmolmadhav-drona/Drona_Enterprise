'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftRight, Plus, Trash2, UserRound, ShieldCheck, Percent, AlertTriangle,
  Loader2, Building2, Sparkles, CheckCircle2
} from 'lucide-react'
import { toast } from 'sonner'

import { useApp, fetchJson } from '@/lib/app-store'
import { formatDate, formatPercent, CHART_COLORS } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { LoadingState, EmptyState, ErrorState, PageHeader } from './shared'

type EmployeeOption = {
  id: string
  name: string
  code: string
  companyId: string
  company: { id: string; name: string }
}

type ClientOption = {
  id: string
  name: string
  code: string
  companyId: string
  company: { id: string; name: string; code: string } | null
}

type AllocationEmployee = {
  id: string
  name: string
  code: string
  company: { id: string; name: string }
}

type Allocation = {
  id: string
  employeeId: string
  clientId: string
  allocationPercent: number
  startDate: string | null
  endDate: string | null
  createdAt: string
  employee: AllocationEmployee
  client: { id: string; name: string; code: string }
}

type RawAllocation = {
  id: string
  employeeId: string
  clientId: string
  allocationPercent: number
  startDate: string | null
  endDate: string | null
  createdAt: string
}

export function AllocationsModule() {
  const { user } = useApp()
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [employeeFilter, setEmployeeFilter] = useState<string>('all')
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const isGroupAdmin = user?.role === 'GROUP_ADMIN'
  const isViewOnly = user?.role === 'STANDARD_USER'

  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (employeeFilter !== 'all') params.set('employeeId', employeeFilter)
    if (clientFilter !== 'all') params.set('clientId', clientFilter)
    fetchJson<{ allocations: Allocation[] }>(`/api/allocations?${params.toString()}`)
      .then((d) => {
        if (!active) return
        setAllocations(d.allocations)
        setError(null)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [employeeFilter, clientFilter])

  useEffect(() => {
    let active = true
    Promise.all([
      fetchJson<{ employees: EmployeeOption[] }>('/api/employees').catch(() => ({ employees: [] as EmployeeOption[] })),
      fetchJson<{ clients: ClientOption[] }>('/api/clients').catch(() => ({ clients: [] as ClientOption[] })),
    ]).then(([e, c]) => {
      if (!active) return
      setEmployees(e.employees)
      setClients(c.clients)
    })
    return () => {
      active = false
    }
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, { employee: AllocationEmployee; allocations: Allocation[]; total: number }>()
    for (const a of allocations) {
      const entry = map.get(a.employeeId)
      if (entry) {
        entry.allocations.push(a)
        entry.total += Number(a.allocationPercent) || 0
      } else {
        map.set(a.employeeId, {
          employee: a.employee,
          allocations: [a],
          total: Number(a.allocationPercent) || 0,
        })
      }
    }
    return Array.from(map.values()).sort((x, y) => x.employee.name.localeCompare(y.employee.name))
  }, [allocations])

  async function handleRemove(id: string) {
    setRemovingId(id)
    try {
      await fetchJson(`/api/allocations?id=${id}`, { method: 'DELETE' })
      setAllocations((prev) => prev.filter((a) => a.id !== id))
      toast.success('Allocation removed!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove allocation')
    } finally {
      setRemovingId(null)
    }
  }

  const DRONA_COLOR_STACK = ['#08B6D8', '#0B2148', '#2563EB', '#7C3AED', '#059669', '#D97706']

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee → Client Labor Allocation"
        subtitle="Workforce labor % distribution for per-client cost and profitability accounting"
        action={
          isViewOnly ? (
            <Badge variant="outline" className="gap-1.5 text-slate-500 border-slate-200">
              <ShieldCheck className="h-3.5 w-3.5" /> View-only access
            </Badge>
          ) : (
            <Button onClick={() => setAddOpen(true)} size="sm" className="bg-[#0B2148] hover:bg-[#102B63] text-white font-semibold text-xs gap-1.5 rounded-lg shadow-sm">
              <Plus className="h-4 w-4 text-[#08B6D8]" /> + Allocate Employee
            </Button>
          )
        }
      />

      {/* Info Banner */}
      <Card className="border border-[#08B6D8]/30 bg-gradient-to-r from-[#0B2148] to-[#102B63] text-white shadow-md rounded-2xl">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#08B6D8]/20 text-[#16C4E8] flex items-center justify-center font-bold shrink-0">
              <ArrowLeftRight className="h-5 w-5 text-[#08B6D8]" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                Labor Cost Allocation Matrix <Sparkles className="h-3.5 w-3.5 text-[#16C4E8]" />
              </h4>
              <p className="text-xs text-slate-300 mt-1">
                Employee annual salaries are automatically split and attributed to client accounts based on their active allocation percentage.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger className="h-9 w-52 text-xs rounded-lg border-slate-200">
              <SelectValue placeholder="All employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name} ({e.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="h-9 w-52 text-xs rounded-lg border-slate-200">
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs font-semibold text-slate-500">
          {allocations.length} Active Labor Allocations
        </div>
      </div>

      {/* Grouped Allocation Cards */}
      {loading ? (
        <LoadingState label="Computing labor percentage matrix…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : grouped.length === 0 ? (
        <EmptyState
          title="No allocations configured"
          desc="Add an allocation entry to link workforce labor to client accounts."
          icon={<ArrowLeftRight className="h-8 w-8 text-slate-400" />}
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(({ employee, allocations: empAllocs, total }) => {
            const isComplete = Math.abs(total - 100) < 0.01
            const overAllocated = total > 100 + 0.01
            return (
              <Card key={employee.id} className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-[#0B2148]/10 text-[#0B2148] flex items-center justify-center font-bold text-xs">
                        {employee.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-[#0B2148] text-sm">{employee.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{employee.code} · {employee.company.name}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">Total Allocated:</span>
                      <Badge className={`text-xs font-bold ${
                        overAllocated
                          ? 'bg-rose-100 text-rose-800 border-rose-200'
                          : isComplete
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}>
                        {formatPercent(total)}
                      </Badge>
                    </div>
                  </div>

                  {/* Stacked Allocation Progress Bar */}
                  <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex mb-4 border border-slate-200/60">
                    {empAllocs.map((a, i) => {
                      const pct = Math.max(0, Math.min(100, Number(a.allocationPercent) || 0))
                      return (
                        <div
                          key={a.id}
                          style={{
                            width: `${pct}%`,
                            backgroundColor: DRONA_COLOR_STACK[i % DRONA_COLOR_STACK.length],
                          }}
                          className="h-full transition-all"
                          title={`${a.client.name}: ${formatPercent(pct)}`}
                        />
                      )
                    })}
                  </div>

                  {/* Allocations Table */}
                  <div className="overflow-x-auto scroll-thin">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                          <th className="py-2.5 px-3">Client Account</th>
                          <th className="py-2.5 px-3">Allocation %</th>
                          <th className="py-2.5 px-3">Active Period</th>
                          {!isViewOnly && <th className="py-2.5 px-3 text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {empAllocs.map((a, i) => (
                          <tr key={a.id} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-3 font-bold text-[#0B2148] flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DRONA_COLOR_STACK[i % DRONA_COLOR_STACK.length] }} />
                              {a.client.name} ({a.client.code})
                            </td>
                            <td className="py-2.5 px-3 font-bold text-[#08B6D8]">{formatPercent(Number(a.allocationPercent))}</td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {a.startDate || a.endDate ? `${a.startDate ? formatDate(a.startDate) : 'Start'} → ${a.endDate ? formatDate(a.endDate) : 'Present'}` : 'Ongoing'}
                            </td>
                            {!isViewOnly && (
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  onClick={() => handleRemove(a.id)}
                                  disabled={removingId === a.id}
                                  className="text-slate-400 hover:text-red-600 transition"
                                >
                                  {removingId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add Allocation Modal */}
      <AddAllocationDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        employees={employees}
        clients={clients}
        allocations={allocations}
        onCreated={(a) => setAllocations([a, ...allocations])}
      />
    </div>
  )
}

function AddAllocationDialog({
  open,
  onOpenChange,
  employees,
  clients,
  allocations,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  employees: EmployeeOption[]
  clients: ClientOption[]
  allocations: Allocation[]
  onCreated: (a: Allocation) => void
}) {
  const [employeeId, setEmployeeId] = useState('')
  const [clientId, setClientId] = useState('')
  const [allocationPercent, setAllocationPercent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedEmployee = employees.find((e) => e.id === employeeId) ?? null
  const filteredClients = useMemo(() => {
    if (!selectedEmployee) return []
    return clients.filter((c) => c.companyId === selectedEmployee.companyId)
  }, [clients, selectedEmployee])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!employeeId || !clientId || Number(allocationPercent) <= 0) return
    setSubmitting(true)
    try {
      const body = {
        employeeId,
        clientId,
        allocationPercent: Number(allocationPercent),
      }
      const data = await fetchJson<{ allocation: RawAllocation }>('/api/allocations', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const selectedClient = clients.find((c) => c.id === clientId) ?? null
      const synthesized: Allocation = {
        ...data.allocation,
        employee: selectedEmployee
          ? { id: selectedEmployee.id, name: selectedEmployee.name, code: selectedEmployee.code, company: selectedEmployee.company }
          : { id: employeeId, name: 'Employee', code: '', company: { id: '', name: '' } },
        client: selectedClient
          ? { id: selectedClient.id, name: selectedClient.name, code: selectedClient.code }
          : { id: clientId, name: 'Client', code: '' },
      }

      toast.success(`Allocation added: ${formatPercent(Number(allocationPercent))}`)
      onCreated(synthesized)
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to create allocation')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#0B2148]">Add Labor Allocation</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">Allocate an employee's labor % to a client account.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Employee *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name} ({e.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Client Account *</Label>
            <Select value={clientId} onValueChange={setClientId} disabled={!employeeId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={!employeeId ? 'Select employee first' : 'Select client'} />
              </SelectTrigger>
              <SelectContent>
                {filteredClients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Allocation Percentage % *</Label>
            <Input type="number" min="1" max="100" value={allocationPercent} onChange={(e) => setAllocationPercent(e.target.value)} placeholder="e.g. 50" className="h-9 text-xs" required />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-[#0B2148] text-white">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Allocation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
