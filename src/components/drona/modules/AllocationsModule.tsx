'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftRight, Plus, Trash2, UserRound, ShieldCheck, Percent, AlertTriangle,
  Loader2, Building2,
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { LoadingState, EmptyState, ErrorState, PageHeader } from './shared'

// ---- Types -----------------------------------------------------------------

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

// Raw shape returned by POST /api/allocations (no nested employee/client).
type RawAllocation = {
  id: string
  employeeId: string
  clientId: string
  allocationPercent: number
  startDate: string | null
  endDate: string | null
  createdAt: string
}

// ---- Component -------------------------------------------------------------

export function AllocationsModule() {
  const { user, filterCompanyId } = useApp()

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

  // Load allocations when filter selection changes.
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

  // Load employees & clients for the filter dropdowns (respect active company).
  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (filterCompanyId) params.set('companyId', filterCompanyId)
    Promise.all([
      fetchJson<{ employees: EmployeeOption[] }>(`/api/employees?${params.toString()}`).catch(
        () => ({ employees: [] as EmployeeOption[] }),
      ),
      fetchJson<{ clients: ClientOption[] }>(`/api/clients?${params.toString()}`).catch(
        () => ({ clients: [] as ClientOption[] }),
      ),
    ]).then(([e, c]) => {
      if (!active) return
      setEmployees(e.employees)
      setClients(c.clients)
    })
    return () => {
      active = false
    }
  }, [filterCompanyId])

  // Group allocations by employee (sorted by name for stable display).
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { employee: AllocationEmployee; allocations: Allocation[]; total: number }
    >()
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
    return Array.from(map.values()).sort((x, y) =>
      x.employee.name.localeCompare(y.employee.name),
    )
  }, [allocations])

  async function handleRemove(id: string) {
    setRemovingId(id)
    try {
      await fetchJson(`/api/allocations?id=${id}`, { method: 'DELETE' })
      setAllocations((prev) => prev.filter((a) => a.id !== id))
      toast.success('Allocation removed')
    } catch (err) {
      toast.error('Failed to remove allocation', { description: (err as Error).message })
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Employee → Client Allocation"
        subtitle="Used to allocate employee cost to clients for profitability calculation"
        action={
          isViewOnly ? (
            <Badge variant="outline" className="gap-1.5 text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> View-only access
            </Badge>
          ) : (
            <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Allocation
            </Button>
          )
        }
      />

      {/* Info banner */}
      <Card className="shadow-sm bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 flex items-center justify-center shrink-0">
              <ArrowLeftRight className="h-4 w-4" />
            </div>
            <div className="space-y-2 text-sm min-w-0 flex-1">
              <p className="text-foreground">
                An employee can work for multiple clients. Their allocation % determines how their
                cost is split across clients for profit calculation.
              </p>
              <div className="rounded-md border bg-background p-2.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                  Example
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <Badge variant="secondary" className="gap-1">
                    <UserRound className="h-3 w-3" /> Employee A
                  </Badge>
                  <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    Client A · 60%
                  </Badge>
                  <span className="text-muted-foreground">+</span>
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                    Client B · 40%
                  </Badge>
                  <span className="text-muted-foreground">=</span>
                  <Badge variant="outline" className="font-semibold">
                    100%
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Employee</span>
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-[220px] h-8">
            <SelectValue placeholder="All employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employees</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name} · {e.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-2">Client</span>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[220px] h-8">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} · {c.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground">
          {allocations.length} {allocations.length === 1 ? 'allocation' : 'allocations'} ·{' '}
          {grouped.length} {grouped.length === 1 ? 'employee' : 'employees'}
        </div>
      </div>

      {/* Grouped by employee */}
      {loading ? (
        <LoadingState label="Loading allocations…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : grouped.length === 0 ? (
        <EmptyState
          title="No allocations yet"
          desc="Add an allocation to start splitting employee cost across clients."
          icon={<ArrowLeftRight className="h-8 w-8 text-muted-foreground/60" />}
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(({ employee, allocations: empAllocs, total }) => {
            const isComplete = Math.abs(total - 100) < 0.01
            const overAllocated = total > 100 + 0.01
            const totalBadgeClass = overAllocated
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : isComplete
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            return (
              <Card key={employee.id} className="shadow-sm">
                <CardContent className="p-4">
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div className="leading-tight">
                        <div className="text-sm font-semibold">{employee.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            {employee.code}
                          </Badge>
                          {isGroupAdmin && employee.company && (
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              <Building2 className="h-2.5 w-2.5" />
                              {employee.company.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Percent className="h-3.5 w-3.5" />
                        Total allocation
                      </div>
                      <Badge variant="outline" className={`font-semibold gap-1 ${totalBadgeClass}`}>
                        {overAllocated ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : isComplete ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                        {formatPercent(total)}
                      </Badge>
                    </div>
                  </div>

                  {/* Stacked bar */}
                  <div className="h-3 w-full rounded-full bg-muted/60 overflow-hidden flex mb-3">
                    {empAllocs.map((a, i) => {
                      const pct = Math.max(0, Math.min(100, Number(a.allocationPercent) || 0))
                      if (pct === 0) return null
                      return (
                        <div
                          key={a.id}
                          title={`${a.client.name} · ${formatPercent(pct)}`}
                          style={{
                            width: `${pct}%`,
                            backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                          className="h-full transition-all"
                        />
                      )
                    })}
                    {total === 0 && (
                      <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground">
                        no allocations
                      </div>
                    )}
                  </div>

                  {/* Allocations table */}
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead>Client</TableHead>
                        <TableHead className="w-[120px]">Allocation %</TableHead>
                        <TableHead className="w-[200px]">Period</TableHead>
                        {!isViewOnly && <TableHead className="w-[60px] text-right pr-2">Remove</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {empAllocs.map((a, i) => (
                        <TableRow key={a.id} className="hover:bg-muted/40">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                              />
                              <div className="leading-tight">
                                <div className="text-sm font-medium">{a.client.name}</div>
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {a.client.code}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="tabular-nums">
                              {formatPercent(Number(a.allocationPercent))}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {a.startDate || a.endDate ? (
                              <>
                                {a.startDate ? formatDate(a.startDate) : '—'}
                                {' → '}
                                {a.endDate ? formatDate(a.endDate) : 'now'}
                              </>
                            ) : (
                              <span className="italic">—</span>
                            )}
                          </TableCell>
                          {!isViewOnly && (
                            <TableCell className="text-right pr-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
                                onClick={() => handleRemove(a.id)}
                                disabled={removingId === a.id}
                                title="Remove allocation"
                                aria-label={`Remove allocation for ${a.client.name}`}
                              >
                                {removingId === a.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add dialog */}
      <AddAllocationDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        isGroupAdmin={isGroupAdmin}
        employees={employees}
        clients={clients}
        allocations={allocations}
        onCreated={(alloc) => {
          setAllocations((prev) => [alloc, ...prev])
        }}
      />
    </div>
  )
}

// ---- Add Allocation Dialog -------------------------------------------------

function AddAllocationDialog({
  open,
  onOpenChange,
  isGroupAdmin,
  employees,
  clients,
  allocations,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  isGroupAdmin: boolean
  employees: EmployeeOption[]
  clients: ClientOption[]
  allocations: Allocation[]
  onCreated: (a: Allocation) => void
}) {
  const [employeeId, setEmployeeId] = useState('')
  const [clientId, setClientId] = useState('')
  const [allocationPercent, setAllocationPercent] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Selected employee (used to filter the client dropdown by company).
  const selectedEmployee = employees.find((e) => e.id === employeeId) ?? null
  const selectedEmployeeCompanyId = selectedEmployee?.companyId ?? null

  // Clients filtered to the same company as the selected employee.
  const filteredClients = useMemo<ClientOption[]>(() => {
    if (!selectedEmployeeCompanyId) return []
    return clients.filter((c) => c.companyId === selectedEmployeeCompanyId)
  }, [clients, selectedEmployeeCompanyId])

  // Existing total allocation for the selected employee.
  const existingTotal = useMemo(() => {
    if (!employeeId) return 0
    return allocations
      .filter((a) => a.employeeId === employeeId)
      .reduce((sum, a) => sum + (Number(a.allocationPercent) || 0), 0)
  }, [allocations, employeeId])

  const projectedTotal = existingTotal + (Number(allocationPercent) || 0)
  const exceeds100 = projectedTotal > 100 + 0.01

  // Reset form when the dialog closes.
  useEffect(() => {
    if (open) return
    setEmployeeId('')
    setClientId('')
    setAllocationPercent('')
    setStartDate('')
    setEndDate('')
  }, [open])

  // When employee changes, reset the client selection (must belong to same company).
  useEffect(() => {
    setClientId('')
  }, [employeeId])

  const canSubmit =
    employeeId &&
    clientId &&
    Number(allocationPercent) > 0 &&
    Number(allocationPercent) <= 100 &&
    !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        employeeId,
        clientId,
        allocationPercent: Number(allocationPercent),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }
      // The POST endpoint returns the raw record (no nested employee/client),
      // so we synthesize them from the current dropdown data for an optimistic update.
      const data = await fetchJson<{ allocation: RawAllocation }>('/api/allocations', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const selectedClient = clients.find((c) => c.id === clientId) ?? null
      const newAlloc: Allocation = {
        ...data.allocation,
        employee: selectedEmployee
          ? {
              id: selectedEmployee.id,
              name: selectedEmployee.name,
              code: selectedEmployee.code,
              company: selectedEmployee.company,
            }
          : { id: employeeId, name: 'Employee', code: '', company: { id: '', name: '' } },
        client: selectedClient
          ? { id: selectedClient.id, name: selectedClient.name, code: selectedClient.code }
          : { id: clientId, name: 'Client', code: '' },
      }
      toast.success('Allocation added', {
        description: `${selectedEmployee?.name ?? 'Employee'} → ${selectedClient?.name ?? 'Client'} (${formatPercent(Number(allocationPercent))})`,
      })
      onCreated(newAlloc)
      onOpenChange(false)
    } catch (err) {
      toast.error('Failed to add allocation', { description: (err as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> Add allocation
          </DialogTitle>
          <DialogDescription>
            Allocate a portion of an employee&apos;s cost to a client.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label className="text-xs">Employee *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    No employees available
                  </SelectItem>
                ) : (
                  employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} · {e.code}
                      {isGroupAdmin && e.company ? ` · ${e.company.name}` : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Client *</Label>
            <Select value={clientId} onValueChange={setClientId} disabled={!employeeId}>
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={!employeeId ? 'Select an employee first' : 'Select client (same company)'}
                />
              </SelectTrigger>
              <SelectContent>
                {filteredClients.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    {employeeId ? 'No clients in this company' : 'Select an employee first'}
                  </SelectItem>
                ) : (
                  filteredClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.code}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {employeeId && (
              <div className="text-[10px] text-muted-foreground">
                Clients are filtered to the same company as the selected employee.
              </div>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Allocation % *</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="1"
              value={allocationPercent}
              onChange={(e) => setAllocationPercent(e.target.value)}
              placeholder="e.g. 60"
              autoFocus
            />
            <div
              className={`text-[10px] ${
                exceeds100 ? 'text-rose-600 font-medium' : 'text-muted-foreground'
              }`}
            >
              Total allocation for this employee should ideally sum to 100%.
              {employeeId && (
                <>
                  {' '}
                  Current: {formatPercent(existingTotal)} → Projected:{' '}
                  <span className="font-semibold">{formatPercent(projectedTotal)}</span>
                </>
              )}
              {exceeds100 && (
                <span className="ml-1 inline-flex items-center gap-1 text-rose-600">
                  <AlertTriangle className="h-3 w-3" /> exceeds 100%
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">End date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Saving…' : 'Add allocation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
