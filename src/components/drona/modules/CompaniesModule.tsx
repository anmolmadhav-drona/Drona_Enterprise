'use client'

import { useEffect, useState, useSyncExternalStore, useCallback } from 'react'
import {
  Building2, Users, UsersRound, Plus, ShieldCheck, Network, Loader2, Briefcase,
  Columns3, RotateCcw, Check, Sparkles, Building, ChevronRight, Lock, Mail, Eye, EyeOff, KeyRound, LogIn,
  Pencil, Trash2, ShieldAlert
} from 'lucide-react'
import { toast } from 'sonner'

import { useApp, fetchJson } from '@/lib/app-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { LoadingState, EmptyState, ErrorState, PageHeader } from './shared'

type CompanyChild = {
  id: string
  name: string
  code: string
  type: string
  parentId: string | null
  status: string
}

type Company = {
  id: string
  name: string
  code: string
  type: 'PARENT' | 'TENANT'
  parentId: string | null
  status: string
  createdAt: string
  children: CompanyChild[]
  _count: { users: number; clients: number; employees: number }
}

type ColumnKey =
  | 'code'
  | 'type'
  | 'status'
  | 'parent'
  | 'clients'
  | 'employees'
  | 'users'
  | 'createdAt'

type ColumnDef = {
  key: ColumnKey
  label: string
  description: string
  defaultOn: boolean
}

const COLUMN_DEFS: ColumnDef[] = [
  { key: 'code', label: 'Code', description: 'Short tenant code', defaultOn: true },
  { key: 'type', label: 'Type', description: 'Parent or Tenant', defaultOn: true },
  { key: 'status', label: 'Status', description: 'Active / Inactive', defaultOn: true },
  { key: 'parent', label: 'Parent', description: 'Owning group company', defaultOn: false },
  { key: 'clients', label: 'Clients', description: 'Number of clients', defaultOn: true },
  { key: 'employees', label: 'Employees', description: 'Number of employees', defaultOn: true },
  { key: 'users', label: 'Users', description: 'Number of users', defaultOn: true },
  { key: 'createdAt', label: 'Created', description: 'Creation date', defaultOn: false },
]

const STORAGE_KEY = 'drona.companies.columns'
const DEFAULT_VISIBLE: ColumnKey[] = COLUMN_DEFS.filter((c) => c.defaultOn).map((c) => c.key)
const DEFAULT_VISIBLE_JSON = JSON.stringify(DEFAULT_VISIBLE)
const COL_UPDATE_EVENT = 'drona:companies-cols-change'

function parseColumns(json: string | null): Set<ColumnKey> {
  if (!json) return new Set(DEFAULT_VISIBLE)
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) return new Set(DEFAULT_VISIBLE)
    const valid = parsed.filter((k) => COLUMN_DEFS.some((c) => c.key === k))
    return new Set(valid as ColumnKey[])
  } catch {
    return new Set(DEFAULT_VISIBLE)
  }
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', callback)
  window.addEventListener(COL_UPDATE_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(COL_UPDATE_EVENT, callback)
  }
}

function getClientSnapshot(): string {
  if (typeof window === 'undefined') return DEFAULT_VISIBLE_JSON
  return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_VISIBLE_JSON
}

function getServerSnapshot(): string {
  return DEFAULT_VISIBLE_JSON
}

function useVisibleColumns(): [Set<ColumnKey>, (next: Set<ColumnKey>) => void] {
  const json = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
  const visible = parseColumns(json)

  const setVisible = useCallback((next: Set<ColumnKey>) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
    } catch {}
    window.dispatchEvent(new Event(COL_UPDATE_EVENT))
  }, [])

  return [visible, setVisible]
}

export function CompaniesModule() {
  const { user } = useApp()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [visibleCols, setVisibleCols] = useVisibleColumns()

  function toggleColumn(key: ColumnKey) {
    const next = new Set(visibleCols)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setVisibleCols(next)
  }

  function resetColumns() {
    setVisibleCols(new Set(DEFAULT_VISIBLE))
    toast.success('Columns reset to defaults')
  }

  function showAllColumns() {
    setVisibleCols(new Set(COLUMN_DEFS.map((c) => c.key)))
  }

  const isGroupAdmin = user?.role === 'GROUP_ADMIN'

  useEffect(() => {
    if (!isGroupAdmin) return
    let active = true
    fetchJson<{ companies: Company[] }>('/api/companies')
      .then((d) => {
        if (!active) return
        setCompanies(d.companies)
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
  }, [isGroupAdmin])

  if (!isGroupAdmin) {
    return (
      <div className="space-y-5">
        <PageHeader title="Companies" subtitle="Parent group and tenant hierarchy" />
        <EmptyState
          title="Access restricted"
          desc="Only Group Admins can manage companies."
          icon={<ShieldCheck className="h-8 w-8 text-slate-400" />}
        />
      </div>
    )
  }

  if (loading) return <LoadingState label="Inspecting group company hierarchy…" />
  if (error) return <ErrorState message={error} />

  const parent = companies.find((c) => c.type === 'PARENT') ?? null
  const tenants = companies.filter((c) => c.type === 'TENANT')
  const parentNameMap = new Map<string, string>()
  for (const c of companies) {
    if (c.type === 'PARENT') parentNameMap.set(c.id, c.name)
  }

  const aggregate = {
    users: tenants.reduce((s, c) => s + (c._count?.users ?? 0), 0),
    clients: tenants.reduce((s, c) => s + (c._count?.clients ?? 0), 0),
    employees: tenants.reduce((s, c) => s + (c._count?.employees ?? 0), 0),
    tenants: tenants.length,
  }

  const tableRows: Company[] = [parent, ...tenants].filter(Boolean) as Company[]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies & Multi-Tenant Hierarchy"
        subtitle="Consolidated view of parent group structure and active tenant units"
        action={
          <div className="flex items-center gap-2">
            <CustomColumnsButton
              visibleCols={visibleCols}
              onToggle={toggleColumn}
              onReset={resetColumns}
              onShowAll={showAllColumns}
            />
            <Button onClick={() => setAddOpen(true)} size="sm" className="bg-[#0B2148] hover:bg-[#102B63] text-white font-semibold text-xs gap-1.5 rounded-lg shadow-sm">
              <Plus className="h-4 w-4 text-[#08B6D8]" /> Add Tenant Company
            </Button>
          </div>
        }
      />

      {/* Parent + Tenant Visual Hierarchy */}
      {parent ? (
        <div className="flex flex-col items-center">
          <ParentCard company={parent} aggregate={aggregate} />

          {tenants.length > 0 && (
            <div className="flex flex-col items-center w-full">
              <div className="h-8 w-0.5 bg-[#08B6D8]" />
              <div className="relative w-full max-w-6xl">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 bg-[#08B6D8] w-[calc(100%-2rem)]" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                  {tenants.map((t) => (
                    <TenantCard
                      key={t.id}
                      company={t}
                      onEdit={(c) => { setEditingCompany(c); setEditOpen(true) }}
                      onDelete={(c) => { setDeletingCompany(c); setDeleteOpen(true) }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          title="No group companies configured"
          desc="Add your first tenant company to establish the group hierarchy."
          icon={<Building2 className="h-8 w-8 text-slate-400" />}
        />
      )}

      {/* Companies Dataset Table */}
      {tableRows.length > 0 && (
        <CompaniesTable
          rows={tableRows}
          visibleCols={visibleCols}
          parentNameMap={parentNameMap}
          onEdit={(c) => { setEditingCompany(c); setEditOpen(true) }}
          onDelete={(c) => { setDeletingCompany(c); setDeleteOpen(true) }}
        />
      )}

      {/* Add Tenant Modal */}
      <AddTenantDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        parentCompanyId={parent?.id ?? null}
        onCreated={(c) => {
          setCompanies((prev) => [...prev, c as Company])
        }}
      />

      {/* Edit Tenant Modal */}
      <EditTenantDialog
        company={editingCompany}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={(updated) => {
          setCompanies((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)))
        }}
      />

      {/* Delete Tenant Modal */}
      <DeleteTenantDialog
        company={deletingCompany}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={(deletedId) => {
          setCompanies((prev) => prev.filter((item) => item.id !== deletedId))
        }}
      />
    </div>
  )
}

function CustomColumnsButton({
  visibleCols,
  onToggle,
  onReset,
  onShowAll,
}: {
  visibleCols: Set<ColumnKey>
  onToggle: (k: ColumnKey) => void
  onReset: () => void
  onShowAll: () => void
}) {
  const visibleCount = visibleCols.size
  const totalOptional = COLUMN_DEFS.length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg">
          <Columns3 className="h-4 w-4 text-[#08B6D8]" />
          <span className="hidden sm:inline">Custom Columns</span>
          <Badge className="bg-[#0B2148] text-white text-[10px] px-1.5 h-4 font-mono">
            {visibleCount}/{totalOptional}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4 border-slate-200 shadow-xl rounded-2xl bg-white space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#0B2148]">Custom Table Columns</div>
            <div className="text-[10px] text-slate-400">Toggle active table columns</div>
          </div>
          <Columns3 className="h-4 w-4 text-[#08B6D8]" />
        </div>

        <div className="space-y-1 max-h-60 overflow-y-auto scroll-thin">
          {COLUMN_DEFS.map((col) => {
            const checked = visibleCols.has(col.key)
            return (
              <label
                key={col.key}
                className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[#E8F8FC]/50 cursor-pointer transition"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => onToggle(col.key)}
                  className="mt-0.5"
                />
                <div>
                  <span className="block text-xs font-semibold text-[#0B2148]">{col.label}</span>
                  <span className="block text-[10px] text-slate-400">{col.description}</span>
                </div>
              </label>
            )
          })}
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-[#08B6D8]" onClick={onShowAll}>
            <Check className="h-3 w-3 mr-1" /> Show all
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-slate-500" onClick={onReset}>
            <RotateCcw className="h-3 w-3 mr-1" /> Reset
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function CompaniesTable({
  rows,
  visibleCols,
  parentNameMap,
  onEdit,
  onDelete,
}: {
  rows: Company[]
  visibleCols: Set<ColumnKey>
  parentNameMap: Map<string, string>
  onEdit: (c: Company) => void
  onDelete: (c: Company) => void
}) {
  return (
    <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <div className="text-sm font-bold text-[#0B2148]">Companies Directory</div>
            <div className="text-xs text-slate-500">
              {rows.length} total group entities · {visibleCols.size} active columns
            </div>
          </div>
          <Columns3 className="h-4 w-4 text-[#08B6D8]" />
        </div>

        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4 sticky left-0 bg-slate-50 z-10">Company Name</th>
                {visibleCols.has('code') && <th className="py-3 px-4">Code</th>}
                {visibleCols.has('type') && <th className="py-3 px-4">Type</th>}
                {visibleCols.has('status') && <th className="py-3 px-4">Status</th>}
                {visibleCols.has('parent') && <th className="py-3 px-4">Parent Group</th>}
                {visibleCols.has('clients') && <th className="py-3 px-4 text-right">Clients</th>}
                {visibleCols.has('employees') && <th className="py-3 px-4 text-right">Employees</th>}
                {visibleCols.has('users') && <th className="py-3 px-4 text-right">Users</th>}
                {visibleCols.has('createdAt') && <th className="py-3 px-4">Created Date</th>}
                <th className="py-3 px-4 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => {
                const isParent = c.type === 'PARENT'
                const counts = c._count ?? { users: 0, clients: 0, employees: 0 }
                return (
                  <tr
                    key={c.id}
                    className={`hover:bg-[#E8F8FC]/40 transition ${isParent ? 'bg-[#0B2148]/5 font-bold' : ''}`}
                  >
                    <td className="py-3 px-4 sticky left-0 bg-inherit z-10">
                      <div className="flex items-center gap-2.5">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                          isParent ? 'bg-[#0B2148] text-white' : 'bg-[#08B6D8]/15 text-[#0B2148]'
                        }`}>
                          {isParent ? <Network className="h-4 w-4 text-[#08B6D8]" /> : <Building2 className="h-4 w-4" />}
                        </div>
                        <span className="font-bold text-[#0B2148] text-sm">{c.name}</span>
                      </div>
                    </td>
                    {visibleCols.has('code') && (
                      <td className="py-3 px-4">
                        <Badge className="font-mono text-[10px] bg-slate-100 text-slate-800 border-slate-200">{c.code}</Badge>
                      </td>
                    )}
                    {visibleCols.has('type') && (
                      <td className="py-3 px-4">
                        <Badge className={`text-[10px] font-bold ${isParent ? 'bg-[#0B2148] text-white' : 'bg-[#08B6D8]/15 text-[#0B2148]'}`}>
                          {isParent ? 'PARENT' : 'TENANT'}
                        </Badge>
                      </td>
                    )}
                    {visibleCols.has('status') && (
                      <td className="py-3 px-4">
                        <Badge className={`text-[10px] font-bold ${c.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {c.status}
                        </Badge>
                      </td>
                    )}
                    {visibleCols.has('parent') && (
                      <td className="py-3 px-4 text-slate-500">
                        {isParent ? '—' : parentNameMap.get(c.parentId ?? '') ?? '—'}
                      </td>
                    )}
                    {visibleCols.has('clients') && <td className="py-3 px-4 text-right font-bold text-[#0B2148]">{counts.clients}</td>}
                    {visibleCols.has('employees') && <td className="py-3 px-4 text-right font-bold text-[#0B2148]">{counts.employees}</td>}
                    {visibleCols.has('users') && <td className="py-3 px-4 text-right font-bold text-[#0B2148]">{counts.users}</td>}
                    {visibleCols.has('createdAt') && (
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(c.createdAt).toLocaleDateString('en-IN')}
                      </td>
                    )}
                    <td className="py-3 px-4 text-center">
                      {!isParent ? (
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(c)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-[#08B6D8] hover:bg-[#E8F8FC] rounded-lg"
                            title="Edit Tenant Credentials"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(c)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                            title="Delete Tenant Company"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function ParentCard({
  company,
  aggregate,
}: {
  company: Company
  aggregate: { users: number; clients: number; employees: number; tenants: number }
}) {
  return (
    <Card className="w-full max-w-2xl bg-gradient-to-r from-[#0B2148] via-[#102B63] to-[#0B2148] text-white border-0 shadow-xl rounded-2xl overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
              <Building className="h-6 w-6 text-[#08B6D8]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-white tracking-tight">{company.name}</h3>
                <Badge className="bg-[#08B6D8] text-[#0B2148] font-bold text-[10px]">GROUP PARENT</Badge>
              </div>
              <div className="text-xs text-slate-300 mt-0.5">{company.code} · Enterprise Group Headquarters</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <KpiTile icon={<Network className="h-4 w-4 text-[#08B6D8]" />} label="Tenants" value={aggregate.tenants} />
          <KpiTile icon={<Briefcase className="h-4 w-4 text-[#08B6D8]" />} label="Clients" value={aggregate.clients} />
          <KpiTile icon={<UsersRound className="h-4 w-4 text-[#08B6D8]" />} label="Employees" value={aggregate.employees} />
          <KpiTile icon={<Users className="h-4 w-4 text-[#08B6D8]" />} label="Users" value={aggregate.users} />
        </div>
      </CardContent>
    </Card>
  )
}

function KpiTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 border border-white/15 p-3.5 backdrop-blur">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-extrabold text-white mt-1">{value}</div>
    </div>
  )
}

function TenantCard({
  company,
  onEdit,
  onDelete,
}: {
  company: Company
  onEdit?: (c: Company) => void
  onDelete?: (c: Company) => void
}) {
  const counts = company._count ?? { users: 0, clients: 0, employees: 0 }
  return (
    <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl hover:shadow-md hover:border-[#08B6D8]/50 transition-all duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#08B6D8]/15 text-[#0B2148] flex items-center justify-center font-bold">
              <Building2 className="h-5 w-5 text-[#08B6D8]" />
            </div>
            <div>
              <div className="text-base font-bold text-[#0B2148]">{company.name}</div>
              <Badge className="font-mono text-[10px] bg-slate-100 text-slate-700">{company.code}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge className={`text-[10px] font-bold ${company.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
              {company.status}
            </Badge>
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(company)}
                className="h-7 w-7 p-0 text-slate-400 hover:text-[#08B6D8] hover:bg-[#E8F8FC] rounded-lg"
                title="Edit Tenant Credentials & Details"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(company)}
                className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                title="Delete Tenant Company"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
          <div className="p-2 rounded-lg bg-slate-50">
            <div className="text-[9px] font-bold uppercase text-slate-400">Clients</div>
            <div className="text-sm font-bold text-[#0B2148] mt-0.5">{counts.clients}</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-50">
            <div className="text-[9px] font-bold uppercase text-slate-400">Employees</div>
            <div className="text-sm font-bold text-[#0B2148] mt-0.5">{counts.employees}</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-50">
            <div className="text-[9px] font-bold uppercase text-slate-400">Users</div>
            <div className="text-sm font-bold text-[#0B2148] mt-0.5">{counts.users}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AddTenantDialog({
  open,
  onOpenChange,
  parentCompanyId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  parentCompanyId: string | null
  onCreated: (c: Company) => void
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [parentId, setParentId] = useState<string>(parentCompanyId ?? '')
  const [submitting, setSubmitting] = useState(false)

  // Auto-suggest admin email when company code changes
  const handleCodeChange = (val: string) => {
    const formatted = val.toUpperCase()
    setCode(formatted)
    if (!adminEmail || adminEmail.includes('@drona.com')) {
      setAdminEmail(`admin.${formatted.toLowerCase()}@drona.com`)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !code.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      toast.error('Please fill in Company Name, Code, Admin Email/ID, and Admin Password')
      return
    }
    setSubmitting(true)
    try {
      const { company, tenantAdmin } = await fetchJson<{ company: Company; tenantAdmin?: { email: string } }>('/api/companies', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          adminEmail: adminEmail.trim(),
          adminPassword: adminPassword.trim(),
          type: 'TENANT',
          parentId: parentId || parentCompanyId,
          status: 'ACTIVE',
        }),
      })
      toast.success(`Tenant "${company.name}" created with Admin ID: ${tenantAdmin?.email || adminEmail}`)
      onCreated(company)
      onOpenChange(false)
      setName('')
      setCode('')
      setAdminEmail('')
      setAdminPassword('')
    } catch (err: any) {
      toast.error(err.message || 'Failed to create tenant company')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#0B2148] flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#08B6D8]" /> Add Tenant Company
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Register a new tenant company under the group parent structure with login credentials.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Company Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Drona Logistics"
              className="h-10 text-xs"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Company Code *</Label>
            <Input
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="e.g. DRL"
              className="h-10 text-xs font-mono font-bold"
              maxLength={10}
              required
            />
          </div>

          {/* Tenant Portal Admin Credentials */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#08B6D8] flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> Tenant Portal Login Credentials
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-400" /> Tenant Admin ID / Email *
              </Label>
              <Input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="e.g. admin.drl@drona.com"
                className="h-10 text-xs font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-slate-400" /> Tenant Portal Password *
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Set login password for tenant portal"
                  className="h-10 text-xs pr-9 font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-[#0B2148] hover:bg-[#102B63] text-white font-semibold gap-1.5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Tenant & Set Login'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditTenantDialog({
  company,
  open,
  onOpenChange,
  onUpdated,
}: {
  company: Company | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onUpdated: (c: Company) => void
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !company) return
    setName(company.name)
    setCode(company.code)
    setStatus(company.status)
    setAdminPassword('')
    setLoading(true)

    // Fetch existing tenant details & admin email
    fetchJson<{ company: Company; tenantAdmin: { email: string } | null }>(`/api/companies/${company.id}`)
      .then((data) => {
        if (data.tenantAdmin) {
          setAdminEmail(data.tenantAdmin.email)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, company])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!company) return
    setSubmitting(true)
    try {
      const { company: updated } = await fetchJson<{ company: Company }>(`/api/companies/${company.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          status,
          adminEmail: adminEmail.trim() || undefined,
          adminPassword: adminPassword.trim() || undefined,
        }),
      })
      toast.success(`Tenant "${updated.name}" updated successfully!`)
      onUpdated(updated)
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to update tenant')
    } finally {
      setSubmitting(false)
    }
  }

  if (!company) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#0B2148] flex items-center gap-2">
            <Pencil className="h-5 w-5 text-[#08B6D8]" /> Edit Tenant & Credentials
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Update tenant details, status, and tenant portal login credentials.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#08B6D8]" /></div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Company Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Company Code *</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="h-10 text-xs font-mono font-bold"
                  maxLength={10}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Status *</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                    <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tenant Admin Credentials */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#08B6D8] flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> Tenant Portal Login Credentials
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" /> Tenant Admin ID / Email
                </Label>
                <Input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="e.g. admin.drl@drona.com"
                  className="h-10 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-slate-400" /> New Password (Optional)
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Leave blank to keep current password"
                    className="h-10 text-xs pr-9 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-[#0B2148] hover:bg-[#102B63] text-white font-semibold gap-1.5">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DeleteTenantDialog({
  company,
  open,
  onOpenChange,
  onDeleted,
}: {
  company: Company | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onDeleted: (id: string) => void
}) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) setPassword('')
  }, [open])

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault()
    if (!company || !password.trim()) return
    setSubmitting(true)
    try {
      const res = await fetchJson<{ success: boolean; message: string }>(`/api/companies/${company.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ password: password.trim() }),
      })
      toast.success(res.message || `Tenant "${company.name}" deleted!`)
      onDeleted(company.id)
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || 'Deletion failed. Incorrect password.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!company) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl border-rose-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-rose-700 flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-rose-600" /> Confirm Delete Tenant
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Permanently delete <strong className="text-slate-800">{company.name}</strong> and remove its tenant access.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-start gap-2.5 my-2">
          <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong>Security Warning:</strong> This action cannot be undone. To authorize deletion, you must confirm the <strong>Tenant Admin Password</strong>.
          </div>
        </div>

        <form onSubmit={handleDelete} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-rose-600" /> Confirm Tenant Password *
            </Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter tenant admin password to delete"
                className="h-10 text-xs pr-9 font-mono border-rose-300 focus-visible:ring-rose-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting || !password.trim()} className="bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1.5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm & Delete Tenant'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
