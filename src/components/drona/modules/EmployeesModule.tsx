'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  UsersRound, UserPlus, Building2, MapPin, Filter, BadgeCheck,
  ShieldAlert, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

import { useApp, fetchJson } from '@/lib/app-store'
import { formatINR, formatDate } from '@/lib/format'
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

type EmployeeType = { id: string; name: string }
type Department = { id: string; name: string }
type LocationItem = { id: string; name: string; country: string | null }
type CompanyListItem = { id: string; name: string; code: string; type: string }

type Employee = {
  id: string
  companyId: string
  name: string
  code: string
  employeeTypeId: string
  departmentId: string
  locationId: string
  designation: string | null
  salary: number | null
  status: string
  joiningDate: string | null
  company: { id: string; name: string }
  employeeType: EmployeeType | null
  department: Department | null
  location: LocationItem | null
  _count?: { allocations: number; costs: number }
}

type StatusFilter = 'all' | 'ACTIVE' | 'INACTIVE'

// ---- Component -------------------------------------------------------------

export function EmployeesModule() {
  const { user, filterCompanyId, filterLocationId } = useApp()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [employeeTypes, setEmployeeTypes] = useState<EmployeeType[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [addOpen, setAddOpen] = useState(false)

  const isGroupAdmin = user?.role === 'GROUP_ADMIN'
  const isViewOnly = user?.role === 'STANDARD_USER'

  // Load filter dropdown options once on mount.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [d, t] = await Promise.all([
          fetchJson<{ items: Department[] }>('/api/departments').then((r) => r.items),
          fetchJson<{ items: EmployeeType[] }>('/api/employee-types').then((r) => r.items),
        ])
        if (!active) return
        setDepartments(d)
        setEmployeeTypes(t)
      } catch {
        // dropdowns remain empty — list still works
      }
    })()
    return () => {
      active = false
    }
  }, [])

  // Reload the list when filters change.
  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (filterCompanyId) params.set('companyId', filterCompanyId)
    if (filterLocationId) params.set('locationId', filterLocationId)
    if (departmentFilter !== 'all') params.set('departmentId', departmentFilter)
    if (typeFilter !== 'all') params.set('employeeTypeId', typeFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    fetchJson<{ employees: Employee[] }>(`/api/employees?${params.toString()}`)
      .then((d) => {
        if (!active) return
        setEmployees(d.employees)
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
  }, [filterCompanyId, filterLocationId, departmentFilter, typeFilter, statusFilter])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Employees"
        subtitle="Workforce master data"
        action={
          isViewOnly ? (
            <Badge variant="outline" className="gap-1.5 text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" /> View-only access
            </Badge>
          ) : (
            <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
              <UserPlus className="h-4 w-4" /> Add Employee
            </Button>
          )
        }
      />

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filters
        </div>

        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger size="sm" className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger size="sm" className="h-8 w-[170px] text-xs">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {employeeTypes.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger size="sm" className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto text-xs text-muted-foreground">
          {employees.length} {employees.length === 1 ? 'employee' : 'employees'}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <LoadingState label="Loading employees…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : employees.length === 0 ? (
        <EmptyState
          title="No employees found"
          desc="Adjust the filters above or add a new employee to get started."
          icon={<UsersRound className="h-8 w-8 text-muted-foreground/60" />}
        />
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto scroll-thin max-h-[70vh]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="pl-4">Employee</TableHead>
                    {isGroupAdmin && <TableHead>Company</TableHead>}
                    <TableHead>Department</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead className="text-right">Salary</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-center">Allocations</TableHead>
                    <TableHead className="text-center">Costs</TableHead>
                    <TableHead className="pr-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((e) => (
                    <TableRow key={e.id} className="hover:bg-muted/40">
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-md bg-violet-50 text-violet-700 ring-1 ring-violet-200 flex items-center justify-center text-xs font-semibold">
                            {e.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="leading-tight">
                            <div className="text-sm font-medium">{e.name}</div>
                            <Badge variant="outline" className="mt-0.5 text-[10px] font-mono py-0">
                              {e.code}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      {isGroupAdmin && (
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{e.company?.name ?? '—'}</span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        {e.department ? (
                          <span className="text-sm">{e.department.name}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {e.employeeType ? (
                          <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                            {e.employeeType.name}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {e.location ? (
                          <div className="flex items-center gap-1.5 text-sm">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{e.location.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {e.designation ? (
                          <span className="text-sm">{e.designation}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {e.salary != null && Number(e.salary) > 0
                          ? formatINR(Number(e.salary))
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {e.joiningDate ? formatDate(e.joiningDate) : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{e._count?.allocations ?? 0}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{e._count?.costs ?? 0}</Badge>
                      </TableCell>
                      <TableCell className="pr-4">
                        <Badge
                          variant="outline"
                          className={
                            e.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }
                        >
                          {e.status === 'ACTIVE' ? (
                            <BadgeCheck className="h-3 w-3" />
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          )}
                          {e.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add dialog */}
      <AddEmployeeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        isGroupAdmin={isGroupAdmin}
        defaultCompanyId={filterCompanyId ?? user?.companyId ?? null}
        onCreated={(e) => {
          setEmployees((prev) => {
            const next = [...prev, e]
            next.sort((a, b) => a.name.localeCompare(b.name))
            return next
          })
        }}
      />
    </div>
  )
}

// ---- Add Employee Dialog ---------------------------------------------------

function AddEmployeeDialog({
  open,
  onOpenChange,
  isGroupAdmin,
  defaultCompanyId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  isGroupAdmin: boolean
  defaultCompanyId: string | null
  onCreated: (e: Employee) => void
}) {
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [employeeTypes, setEmployeeTypes] = useState<EmployeeType[]>([])
  const [locations, setLocations] = useState<LocationItem[]>([])

  const [companyId, setCompanyId] = useState<string>(defaultCompanyId ?? '')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [employeeTypeId, setEmployeeTypeId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [designation, setDesignation] = useState('')
  const [salary, setSalary] = useState('')
  const [joiningDate, setJoiningDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Load dropdown options each time the dialog opens.
  useEffect(() => {
    if (!open) return
    let active = true
    ;(async () => {
      try {
        const [c, d, t, l] = await Promise.all([
          isGroupAdmin
            ? fetchJson<{ companies: CompanyListItem[] }>('/api/companies').then(
                (r) => r.companies.filter((x) => x.type !== 'PARENT'),
              )
            : Promise.resolve<CompanyListItem[]>([]),
          fetchJson<{ items: Department[] }>('/api/departments').then((r) => r.items),
          fetchJson<{ items: EmployeeType[] }>('/api/employee-types').then((r) => r.items),
          fetchJson<{ items: LocationItem[] }>('/api/locations').then((r) => r.items),
        ])
        if (!active) return
        setCompanies(c)
        setDepartments(d)
        setEmployeeTypes(t)
        setLocations(l)
        if (isGroupAdmin && !companyId && defaultCompanyId) setCompanyId(defaultCompanyId)
      } catch {
        // ignore — selects will be empty
      }
    })()
    return () => {
      active = false
    }
  }, [open])

  // Reset form fields when dialog closes.
  useEffect(() => {
    if (open) return
    setName('')
    setCode('')
    setEmployeeTypeId('')
    setDepartmentId('')
    setLocationId('')
    setDesignation('')
    setSalary('')
    setJoiningDate('')
  }, [open])

  const canSubmit =
    name.trim() &&
    code.trim() &&
    employeeTypeId &&
    departmentId &&
    locationId &&
    (!isGroupAdmin || companyId) &&
    !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        employeeTypeId,
        departmentId,
        locationId,
        designation: designation.trim() || undefined,
        salary: salary ? Number(salary) : undefined,
        joiningDate: joiningDate || undefined,
      }
      if (isGroupAdmin) body.companyId = companyId
      const { employee } = await fetchJson<{ employee: Employee }>('/api/employees', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      // POST response lacks _count — coerce to zeros for immediate render.
      const normalized: Employee = {
        ...employee,
        _count: employee._count ?? { allocations: 0, costs: 0 },
      }
      toast.success('Employee added', { description: `${normalized.name} · ${normalized.code}` })
      onCreated(normalized)
      onOpenChange(false)
    } catch (err) {
      toast.error('Failed to add employee', { description: (err as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" /> Add new employee
          </DialogTitle>
          <DialogDescription>
            Register a new employee under a tenant. Required fields are marked with *.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          {isGroupAdmin && (
            <div className="grid gap-1.5">
              <Label className="text-xs">Company *</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Employee name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Anita Sharma"
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Code *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. EMP-001"
                maxLength={20}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Employee type *</Label>
              <Select value={employeeTypeId} onValueChange={setEmployeeTypeId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {employeeTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Department *</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Location *</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}{l.country ? ` · ${l.country}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Designation</Label>
              <Input
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Senior Engineer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Salary (₹ / year)</Label>
              <Input
                type="number"
                min="0"
                step="1000"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="Annual salary"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Joining date</Label>
              <Input
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Saving…' : 'Add employee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
