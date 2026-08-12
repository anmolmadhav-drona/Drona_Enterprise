'use client'

import { useEffect, useState } from 'react'
import {
  UsersRound, UserPlus, Building2, MapPin, Filter, BadgeCheck,
  ShieldAlert, Loader2, Search, Briefcase, Calendar, Phone, Mail,
  Layers, Plus, X, Columns3
} from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
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
import { LoadingState, EmptyState, ErrorState, PageHeader } from './shared'

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
  email?: string | null
  phone?: string | null
  customFields?: string | null
  company: { id: string; name: string }
  employeeType: EmployeeType | null
  department: Department | null
  location: LocationItem | null
  _count?: { allocations: number; costs: number }
}

type StatusFilter = 'all' | 'ACTIVE' | 'INACTIVE'

export function EmployeesModule() {
  const { user } = useApp()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [employeeTypes, setEmployeeTypes] = useState<EmployeeType[]>([])
  const [locations, setLocations] = useState<LocationItem[]>([])
  const [companies, setCompanies] = useState<CompanyListItem[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const [pageCompanyId, setPageCompanyId] = useState<string | null>(null)
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [pageLocationId, setPageLocationId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [addOpen, setAddOpen] = useState(false)

  // Column Visibility & Custom Column Pill Button State
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    name: true,
    company: true,
    department: true,
    type: true,
    location: true,
    designation: true,
    contact: true,
    salary: true,
    allocations: true,
    status: true,
  })
  const [extraCols, setExtraCols] = useState<string[]>([])
  const [newColHeader, setNewColHeader] = useState('')

  const isGroupAdmin = user?.role === 'GROUP_ADMIN'
  const isViewOnly = user?.role === 'STANDARD_USER'

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [d, t, l, c] = await Promise.all([
          fetchJson<{ items: Department[] }>('/api/departments').then((r) => r.items),
          fetchJson<{ items: EmployeeType[] }>('/api/employee-types').then((r) => r.items),
          fetchJson<{ items: LocationItem[] }>('/api/locations').then((r) => r.items),
          fetchJson<{ companies: CompanyListItem[] }>('/api/companies').then((r) => r.companies.filter((x) => x.type !== 'PARENT')),
        ])
        if (!active) return
        setDepartments(d)
        setEmployeeTypes(t)
        setLocations(l)
        setCompanies(c)
      } catch {}
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (pageCompanyId) params.set('companyId', pageCompanyId)
    if (pageLocationId) params.set('locationId', pageLocationId)
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
  }, [pageCompanyId, pageLocationId, departmentFilter, typeFilter, statusFilter])

  const filteredEmployees = employees.filter((e) => {
    if (pageCompanyId && e.companyId !== pageCompanyId) return false
    return (
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.designation && e.designation.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workforce Roster & Employees"
        subtitle="Master record of human resources, departmental placement, and compensation"
        action={
          isViewOnly ? (
            <Badge variant="outline" className="gap-1.5 text-slate-500 border-slate-200">
              <ShieldAlert className="h-3.5 w-3.5" /> View-only access
            </Badge>
          ) : (
            <Button onClick={() => setAddOpen(true)} size="sm" className="bg-[#0B2148] hover:bg-[#102B63] text-white font-semibold text-xs gap-1.5 rounded-lg shadow-sm">
              <UserPlus className="h-4 w-4 text-[#08B6D8]" /> + Add New Employee
            </Button>
          )
        }
      />

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search employee, code, designation..."
              className="pl-8 h-9 text-xs border-slate-200 rounded-lg focus:border-[#08B6D8]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
          {/* Unified Filter Box Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="h-8 px-3.5 rounded-full bg-white border border-slate-200 shadow-xs hover:border-slate-300 flex items-center gap-2 text-xs font-bold text-[#0B2148] transition cursor-pointer">
                <Filter className="h-4 w-4 text-[#08B6D8]" />
                <span>Filter</span>
                {(pageCompanyId !== null || pageLocationId !== null || departmentFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all') && (
                  <span className="px-2 py-0.5 rounded-full bg-[#08B6D8] text-white text-[10px] font-mono font-bold">
                    {[
                      pageCompanyId !== null,
                      pageLocationId !== null,
                      departmentFilter !== 'all',
                      typeFilter !== 'all',
                      statusFilter !== 'all',
                    ].filter(Boolean).length}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 bg-white rounded-2xl shadow-xl border border-slate-200 z-50">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-[#0B2148]">Filter Employee Roster</span>
                  <button
                    onClick={() => {
                      setPageCompanyId(null)
                      setPageLocationId(null)
                      setDepartmentFilter('all')
                      setTypeFilter('all')
                      setStatusFilter('all')
                    }}
                    className="text-[10px] text-rose-500 font-bold hover:underline"
                  >
                    Reset Filters
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Tenant Scope */}
                  {companies.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-slate-600">Tenant Scope</Label>
                      <Select value={pageCompanyId ?? 'all'} onValueChange={(v) => setPageCompanyId(v === 'all' ? null : v)}>
                        <SelectTrigger className="h-8 text-xs rounded-lg border-slate-200">
                          <SelectValue placeholder="All Tenants" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Tenants</SelectItem>
                          {companies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Location */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">Location</Label>
                    <Select value={pageLocationId ?? 'all'} onValueChange={(v) => setPageLocationId(v === 'all' ? null : v)}>
                      <SelectTrigger className="h-8 text-xs rounded-lg border-slate-200">
                        <SelectValue placeholder="All Locations" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Locations</SelectItem>
                        {locations.map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Department */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">Department</Label>
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                      <SelectTrigger className="h-8 text-xs rounded-lg border-slate-200">
                        <SelectValue placeholder="All Departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Employment Type */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">Employment Type</Label>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="h-8 text-xs rounded-lg border-slate-200">
                        <SelectValue placeholder="All Employment Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Employment Types</SelectItem>
                        {employeeTypes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">Status</Label>
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                      <SelectTrigger className="h-8 text-xs rounded-lg border-slate-200">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Custom Columns Pill Button matching user screenshot */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="h-8 px-3.5 rounded-full bg-white border border-slate-200 shadow-xs hover:border-slate-300 flex items-center gap-2 text-xs font-bold text-[#0B2148] transition cursor-pointer">
                <Columns3 className="h-4 w-4 text-[#08B6D8]" />
                <span>Custom Columns</span>
                <span className="px-2 py-0.5 rounded-full bg-[#0B2148] text-white text-[10px] font-mono font-bold">
                  {Object.values(columnVisibility).filter(Boolean).length}/{Object.keys(columnVisibility).length}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4 bg-white rounded-2xl shadow-xl border border-slate-200 z-50">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-[#0B2148]">Table Column Visibility</span>
                  <button
                    onClick={() => {
                      const reset: Record<string, boolean> = {}
                      Object.keys(columnVisibility).forEach((k) => (reset[k] = true))
                      setColumnVisibility(reset)
                    }}
                    className="text-[10px] text-[#08B6D8] font-bold hover:underline"
                  >
                    Show All
                  </button>
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {[
                    { id: 'name', label: 'Employee Name' },
                    { id: 'company', label: 'Company Scope' },
                    { id: 'department', label: 'Department' },
                    { id: 'type', label: 'Employment Type' },
                    { id: 'location', label: 'Location' },
                    { id: 'designation', label: 'Designation' },
                    { id: 'contact', label: 'Contact Info' },
                    { id: 'salary', label: 'Annual Salary' },
                    { id: 'allocations', label: 'Allocations' },
                    { id: 'status', label: 'Status' },
                    ...extraCols.map((c) => ({ id: c, label: c })),
                  ].map((col) => (
                    <label key={col.id} className="flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition">
                      <span className="text-slate-700 font-medium">{col.label}</span>
                      <input
                        type="checkbox"
                        checked={columnVisibility[col.id] !== false}
                        onChange={(e) => setColumnVisibility({ ...columnVisibility, [col.id]: e.target.checked })}
                        className="rounded border-slate-300 text-[#08B6D8] focus:ring-[#08B6D8]"
                      />
                    </label>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
                  <Input
                    placeholder="Add column header..."
                    value={newColHeader}
                    onChange={(e) => setNewColHeader(e.target.value)}
                    className="h-8 text-xs flex-1 border-slate-200"
                  />
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => {
                      if (newColHeader.trim() && !extraCols.includes(newColHeader.trim())) {
                        const name = newColHeader.trim()
                        setExtraCols([...extraCols, name])
                        setColumnVisibility({ ...columnVisibility, [name]: true })
                        setNewColHeader('')
                        toast.success(`Custom column "${name}" added to table!`)
                      }
                    }}
                    className="h-8 text-xs bg-[#0B2148] text-white px-2.5 rounded-lg"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Employees Table */}
      {loading ? (
        <LoadingState label="Loading workforce records…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : filteredEmployees.length === 0 ? (
        <EmptyState
          title="No employees found"
          desc="Adjust filters or register a new team member."
          icon={<UsersRound className="h-8 w-8 text-slate-400" />}
        />
      ) : (
        <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    {columnVisibility.name !== false && <th className="py-3 px-4">Employee Name</th>}
                    {isGroupAdmin && columnVisibility.company !== false && <th className="py-3 px-4">Tenant Scope</th>}
                    {columnVisibility.department !== false && <th className="py-3 px-4">Department</th>}
                    {columnVisibility.type !== false && <th className="py-3 px-4">Type</th>}
                    {columnVisibility.location !== false && <th className="py-3 px-4">Location</th>}
                    {columnVisibility.designation !== false && <th className="py-3 px-4">Designation</th>}
                    {columnVisibility.contact !== false && <th className="py-3 px-4">Contact Info</th>}
                    {extraCols.map((c) => columnVisibility[c] !== false && <th key={c} className="py-3 px-4">{c}</th>)}
                    {columnVisibility.salary !== false && <th className="py-3 px-4 text-right">Annual Salary</th>}
                    {columnVisibility.allocations !== false && <th className="py-3 px-4 text-center">Allocations</th>}
                    {columnVisibility.status !== false && <th className="py-3 px-4">Status</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((e) => (
                    <tr key={e.id} className="hover:bg-[#E8F8FC]/40 transition">
                      {columnVisibility.name !== false && (
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-[#0B2148]/10 text-[#0B2148] flex items-center justify-center font-bold text-xs">
                              {e.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-[#0B2148] text-sm">{e.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{e.code}</div>
                            </div>
                          </div>
                        </td>
                      )}
                      {isGroupAdmin && columnVisibility.company !== false && (
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-[#08B6D8]" />
                            {e.company?.name ?? '—'}
                          </div>
                        </td>
                      )}
                      {columnVisibility.department !== false && (
                        <td className="py-3 px-4 font-semibold text-[#0B2148]">
                          {e.department?.name ?? '—'}
                        </td>
                      )}
                      {columnVisibility.type !== false && (
                        <td className="py-3 px-4">
                          {e.employeeType ? (
                            <Badge className="bg-[#08B6D8]/15 text-[#0B2148] font-semibold text-[10px]">
                              {e.employeeType.name}
                            </Badge>
                          ) : '—'}
                        </td>
                      )}
                      {columnVisibility.location !== false && (
                        <td className="py-3 px-4 text-slate-600">
                          {e.location ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              {e.location.name}
                            </div>
                          ) : '—'}
                        </td>
                      )}
                      {columnVisibility.designation !== false && (
                        <td className="py-3 px-4 text-slate-700 font-medium">
                          {e.designation ?? '—'}
                        </td>
                      )}
                      {columnVisibility.contact !== false && (
                        <td className="py-3 px-4">
                          {e.phone || e.email ? (
                            <div className="space-y-0.5">
                              {e.phone && (
                                <div className="text-[11px] font-medium text-slate-700 flex items-center gap-1 font-mono">
                                  <Phone className="h-3 w-3 text-[#08B6D8]" />
                                  {e.phone}
                                </div>
                              )}
                              {e.email && (
                                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <Mail className="h-2.5 w-2.5 text-slate-400" />
                                  {e.email}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 italic">—</span>
                          )}
                        </td>
                      )}
                      {extraCols.map((colName) => (
                        columnVisibility[colName] !== false && (
                          <td key={colName} className="py-3 px-4 text-slate-600 font-medium">
                            {(() => {
                              if (!e.customFields) return '—'
                              try {
                                const parsed = JSON.parse(e.customFields)
                                return parsed[colName] ?? '—'
                              } catch {
                                return '—'
                              }
                            })()}
                          </td>
                        )
                      ))}
                      {columnVisibility.salary !== false && (
                        <td className="py-3 px-4 text-right font-bold text-[#0B2148]">
                          {e.salary != null && Number(e.salary) > 0 ? formatINR(Number(e.salary)) : '—'}
                        </td>
                      )}
                      {columnVisibility.allocations !== false && (
                        <td className="py-3 px-4 text-center">
                          <Badge variant="secondary" className="font-bold">{e._count?.allocations ?? 0}</Badge>
                        </td>
                      )}
                      {columnVisibility.status !== false && (
                        <td className="py-3 px-4">
                          <Badge className={`text-[10px] font-bold ${e.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {e.status}
                          </Badge>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Employee Dialog */}
      <AddEmployeeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        isGroupAdmin={isGroupAdmin}
        defaultCompanyId={user?.companyId ?? null}
        onCreated={(e) => setEmployees([e, ...employees])}
      />
    </div>
  )
}

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
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [customFieldsList, setCustomFieldsList] = useState<{ key: string; value: string }[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    ;(async () => {
      try {
        const [c, d, t, l] = await Promise.all([
          isGroupAdmin
            ? fetchJson<{ companies: CompanyListItem[] }>('/api/companies').then((r) => r.companies.filter((x) => x.type !== 'PARENT'))
            : Promise.resolve<CompanyListItem[]>([]),
          fetchJson<{ items: Department[] }>('/api/departments').then((r) => r.items),
          fetchJson<{ items: EmployeeType[] }>('/api/employee-types').then((r) => r.items),
          fetchJson<{ items: LocationItem[] }>('/api/locations').then((r) => r.items),
        ])
        setCompanies(c)
        setDepartments(d)
        setEmployeeTypes(t)
        setLocations(l)
        if (isGroupAdmin && !companyId && defaultCompanyId) setCompanyId(defaultCompanyId)
      } catch (e) {}
    })()
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !code.trim() || !employeeTypeId || !departmentId || !locationId || (isGroupAdmin && !companyId)) return
    setSubmitting(true)
    try {
      const customObj: Record<string, string> = {}
      for (const item of customFieldsList) {
        if (item.key.trim() && item.value.trim()) {
          customObj[item.key.trim()] = item.value.trim()
        }
      }

      const body: Record<string, unknown> = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        employeeTypeId,
        departmentId,
        locationId,
        designation: designation.trim() || undefined,
        salary: salary ? Number(salary) : undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        customFields: Object.keys(customObj).length > 0 ? customObj : undefined,
      }
      if (isGroupAdmin) body.companyId = companyId
      const { employee } = await fetchJson<{ employee: Employee }>('/api/employees', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      toast.success(`Employee ${employee.name} added!`)
      onCreated(employee)
      onOpenChange(false)
      setName('')
      setCode('')
      setSalary('')
      setPhone('')
      setEmail('')
      setCustomFieldsList([])
    } catch (err: any) {
      toast.error(err.message || 'Failed to add employee')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#0B2148]">Add Employee Record</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Register a new employee into the workforce master.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {isGroupAdmin && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Company Scope *</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Employee Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anita Sharma" className="h-9 text-xs" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Employee Code *</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. EMP-101" className="h-9 text-xs font-mono" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Department *</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Employment Type *</Label>
              <Select value={employeeTypeId} onValueChange={setEmployeeTypeId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {employeeTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Location *</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Designation</Label>
              <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Lead Logistics Analyst" className="h-9 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Annual Salary (INR)</Label>
              <Input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="e.g. 1200000" className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Mobile / Phone Number</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +91 98765 12345" className="h-9 text-xs font-mono" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Email Address</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. employee@drona.com" className="h-9 text-xs" />
          </div>

          {/* Dynamic Custom Columns & Fields Manager */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-[#0B2148] flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-[#08B6D8]" /> Custom Columns / Attributes
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCustomFieldsList([...customFieldsList, { key: '', value: '' }])}
                className="h-7 text-[11px] text-[#08B6D8] border-[#08B6D8]/40 hover:bg-[#E8F8FC] font-semibold gap-1 rounded-lg"
              >
                <Plus className="h-3 w-3" /> + Add Custom Field
              </Button>
            </div>

            {customFieldsList.length > 0 && (
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {customFieldsList.map((field, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="Column Name (e.g. Blood Group)"
                      value={field.key}
                      onChange={(e) => {
                        const copy = [...customFieldsList]
                        copy[idx].key = e.target.value
                        setCustomFieldsList(copy)
                      }}
                      className="h-8 text-xs flex-1 border-slate-200"
                    />
                    <Input
                      placeholder="Value (e.g. O+ / PF-99182)"
                      value={field.value}
                      onChange={(e) => {
                        const copy = [...customFieldsList]
                        copy[idx].value = e.target.value
                        setCustomFieldsList(copy)
                      }}
                      className="h-8 text-xs flex-1 border-slate-200"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCustomFieldsList(customFieldsList.filter((_, i) => i !== idx))}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-[#0B2148] text-white">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Employee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
