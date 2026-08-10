'use client'

import { useEffect, useState, useSyncExternalStore, useCallback } from 'react'
import {
  Building2, Users, UsersRound, Plus, ShieldCheck, Network, Loader2, Briefcase,
  Columns3, RotateCcw, Check,
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

// ---- Types -----------------------------------------------------------------

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

// Alternating accent classes for tenant cards (left border + tint).
const TENANT_ACCENTS = [
  'module-sky',
  'module-green',
  'module-amber',
  'module-violet',
  'module-rose',
  'module-blue',
]

// ---- Custom Column definitions ---------------------------------------------
// Each column describes a toggleable field shown in the companies table.
// `name` is always visible (sticky) and not toggleable.

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
  { key: 'code',       label: 'Code',         description: 'Short tenant code',         defaultOn: true },
  { key: 'type',       label: 'Type',         description: 'Parent or Tenant',           defaultOn: true },
  { key: 'status',     label: 'Status',       description: 'Active / Inactive',          defaultOn: true },
  { key: 'parent',     label: 'Parent',       description: 'Owning group company',       defaultOn: false },
  { key: 'clients',    label: 'Clients',      description: 'Number of clients',          defaultOn: true },
  { key: 'employees',  label: 'Employees',    description: 'Number of employees',        defaultOn: true },
  { key: 'users',      label: 'Users',        description: 'Number of users',           defaultOn: true },
  { key: 'createdAt',  label: 'Created',      description: 'Creation date',              defaultOn: false },
]

const STORAGE_KEY = 'drona.companies.columns'
const DEFAULT_VISIBLE: ColumnKey[] = COLUMN_DEFS.filter((c) => c.defaultOn).map((c) => c.key)
const DEFAULT_VISIBLE_JSON = JSON.stringify(DEFAULT_VISIBLE)

// ---- External store for column visibility (localStorage-backed) ------------
// We use useSyncExternalStore so the server-rendered HTML matches the first
// client render (both return the default set), then we hydrate from
// localStorage after mount. Updates within the same tab are dispatched via
// a custom event so all subscribers re-render.

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

/** Read the persisted column set, hydrating safely from localStorage. */
function useVisibleColumns(): [Set<ColumnKey>, (next: Set<ColumnKey>) => void] {
  const json = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
  const visible = parseColumns(json)

  const setVisible = useCallback((next: Set<ColumnKey>) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
    } catch {
      // ignore quota / privacy errors
    }
    window.dispatchEvent(new Event(COL_UPDATE_EVENT))
  }, [])

  return [visible, setVisible]
}

// ---- Component -------------------------------------------------------------

export function CompaniesModule() {
  const { user } = useApp()

  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  // Custom column visibility — backed by localStorage via useSyncExternalStore.
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

  // Access gate — only Group Admins can manage companies.
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
          icon={<ShieldCheck className="h-8 w-8 text-muted-foreground/60" />}
        />
      </div>
    )
  }

  if (loading) return <LoadingState label="Loading company hierarchy…" />
  if (error) return <ErrorState message={error} />

  // Split into parent + tenants.
  const parent = companies.find((c) => c.type === 'PARENT') ?? null
  const tenants = companies.filter((c) => c.type === 'TENANT')
  // Build a lookup of parent id → parent name for the table column.
  const parentNameMap = new Map<string, string>()
  for (const c of companies) {
    if (c.type === 'PARENT') parentNameMap.set(c.id, c.name)
  }

  // Aggregate counts across tenants for the parent card.
  const aggregate = {
    users: tenants.reduce((s, c) => s + (c._count?.users ?? 0), 0),
    clients: tenants.reduce((s, c) => s + (c._count?.clients ?? 0), 0),
    employees: tenants.reduce((s, c) => s + (c._count?.employees ?? 0), 0),
    tenants: tenants.length,
  }

  // Build the flat table rows: parent first, then tenants.
  const tableRows: Company[] = [parent, ...tenants].filter(Boolean) as Company[]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        subtitle="Parent group and tenant hierarchy"
        action={
          <div className="flex items-center gap-2">
            <CustomColumnsButton
              visibleCols={visibleCols}
              onToggle={toggleColumn}
              onReset={resetColumns}
              onShowAll={showAllColumns}
            />
            <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Tenant
            </Button>
          </div>
        }
      />

      {/* Hierarchy view */}
      {parent ? (
        <div className="flex flex-col items-center">
          {/* Parent card */}
          <ParentCard company={parent} aggregate={aggregate} />

          {/* Tree connector */}
          {tenants.length > 0 && (
            <div className="flex flex-col items-center w-full">
              <div className="h-8 w-px bg-border" aria-hidden />
              <div className="relative w-full max-w-6xl">
                {/* Horizontal rail spanning the tenant grid */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px bg-border w-[calc(100%-2rem)]" aria-hidden />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                  {tenants.map((t, i) => (
                    <TenantCard key={t.id} company={t} accent={TENANT_ACCENTS[i % TENANT_ACCENTS.length]} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : companies.length > 0 ? (
        // Fallback: no parent, just list everything flat.
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((c, i) => (
            <TenantCard key={c.id} company={c} accent={TENANT_ACCENTS[i % TENANT_ACCENTS.length]} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No companies yet"
          desc="Add your first tenant to start building the group hierarchy."
          icon={<Building2 className="h-8 w-8 text-muted-foreground/60" />}
        />
      )}

      {/* Companies table with custom columns */}
      {tableRows.length > 0 && (
        <CompaniesTable
          rows={tableRows}
          visibleCols={visibleCols}
          parentNameMap={parentNameMap}
        />
      )}

      {/* Add Tenant dialog */}
      <AddTenantDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        parentCompanyId={parent?.id ?? null}
        onCreated={(c) => {
          setCompanies((prev) => {
            const next = [...prev]
            const idx = next.findIndex((x) => x.type === 'PARENT')
            if (idx >= 0 && next[idx].children) {
              next[idx] = { ...next[idx], children: [...next[idx].children, c] }
            }
            return [...next, c as Company]
          })
        }}
      />
    </div>
  )
}

// ---- Custom Columns button -------------------------------------------------

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
        <Button variant="outline" size="sm" className="gap-1.5">
          <Columns3 className="h-4 w-4" />
          <span className="hidden sm:inline">Custom Columns</span>
          <span className="sm:hidden">Columns</span>
          <Badge variant="secondary" className="ml-0.5 h-4 px-1.5 text-[10px] font-mono">
            {visibleCount}/{totalOptional}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Custom Columns
              </div>
              <div className="text-[10px] text-muted-foreground/80">
                Toggle visible columns in the table below
              </div>
            </div>
            <Columns3 className="h-3.5 w-3.5 text-muted-foreground" />
          </div>

          <Separator />

          <div className="space-y-1 max-h-64 overflow-y-auto scroll-thin pr-1">
            {COLUMN_DEFS.map((col) => {
              const checked = visibleCols.has(col.key)
              return (
                <label
                  key={col.key}
                  htmlFor={`col-${col.key}`}
                  className="flex items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/70 cursor-pointer transition"
                >
                  <Checkbox
                    id={`col-${col.key}`}
                    checked={checked}
                    onCheckedChange={() => onToggle(col.key)}
                    className="mt-0.5"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium leading-tight">{col.label}</span>
                    <span className="block text-[10px] text-muted-foreground leading-tight mt-0.5">
                      {col.description}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={onShowAll}
              disabled={visibleCount === totalOptional}
            >
              <Check className="h-3 w-3 mr-1" /> Show all
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={onReset}
              disabled={visibleCount === DEFAULT_VISIBLE.length && DEFAULT_VISIBLE.every((k) => visibleCols.has(k))}
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Reset
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ---- Companies table ------------------------------------------------------

function CompaniesTable({
  rows,
  visibleCols,
  parentNameMap,
}: {
  rows: Company[]
  visibleCols: Set<ColumnKey>
  parentNameMap: Map<string, string>
}) {
  if (visibleCols.size === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          No columns selected. Use <span className="font-medium text-foreground">Custom Columns</span> to pick which fields to display.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <div className="text-sm font-semibold">Companies Table</div>
            <div className="text-[11px] text-muted-foreground">
              {rows.length} companies · {visibleCols.size} of {COLUMN_DEFS.length} columns shown
            </div>
          </div>
          <Columns3 className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-muted/30">
                <th className="py-2.5 px-4 font-medium sticky left-0 bg-muted/30 z-10">Company</th>
                {visibleCols.has('code') && <th className="py-2.5 px-4 font-medium">Code</th>}
                {visibleCols.has('type') && <th className="py-2.5 px-4 font-medium">Type</th>}
                {visibleCols.has('status') && <th className="py-2.5 px-4 font-medium">Status</th>}
                {visibleCols.has('parent') && <th className="py-2.5 px-4 font-medium">Parent</th>}
                {visibleCols.has('clients') && <th className="py-2.5 px-4 font-medium text-right">Clients</th>}
                {visibleCols.has('employees') && <th className="py-2.5 px-4 font-medium text-right">Employees</th>}
                {visibleCols.has('users') && <th className="py-2.5 px-4 font-medium text-right">Users</th>}
                {visibleCols.has('createdAt') && <th className="py-2.5 px-4 font-medium">Created</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const isParent = c.type === 'PARENT'
                const counts = c._count ?? { users: 0, clients: 0, employees: 0 }
                return (
                  <tr
                    key={c.id}
                    className={`border-b last:border-0 hover:bg-muted/40 transition ${
                      isParent ? 'bg-primary/5 font-medium' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 sticky left-0 bg-inherit z-10">
                      <div className="flex items-center gap-2">
                        <span className={`h-7 w-7 rounded-md flex items-center justify-center ${isParent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          {isParent ? <Network className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                        </span>
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </td>
                    {visibleCols.has('code') && (
                      <td className="py-2.5 px-4">
                        <Badge variant="secondary" className="font-mono text-[10px]">{c.code}</Badge>
                      </td>
                    )}
                    {visibleCols.has('type') && (
                      <td className="py-2.5 px-4">
                        <Badge variant={isParent ? 'default' : 'outline'} className="text-[10px]">
                          {isParent ? 'Parent' : 'Tenant'}
                        </Badge>
                      </td>
                    )}
                    {visibleCols.has('status') && (
                      <td className="py-2.5 px-4">
                        <Badge
                          variant="outline"
                          className={
                            c.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${c.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {c.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                    )}
                    {visibleCols.has('parent') && (
                      <td className="py-2.5 px-4 text-xs text-muted-foreground">
                        {isParent ? <span className="italic opacity-60">—</span> : (parentNameMap.get(c.parentId ?? '') ?? '—')}
                      </td>
                    )}
                    {visibleCols.has('clients') && (
                      <td className="py-2.5 px-4 text-right tabular-nums">{counts.clients.toLocaleString('en-IN')}</td>
                    )}
                    {visibleCols.has('employees') && (
                      <td className="py-2.5 px-4 text-right tabular-nums">{counts.employees.toLocaleString('en-IN')}</td>
                    )}
                    {visibleCols.has('users') && (
                      <td className="py-2.5 px-4 text-right tabular-nums">{counts.users.toLocaleString('en-IN')}</td>
                    )}
                    {visibleCols.has('createdAt') && (
                      <td className="py-2.5 px-4 text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    )}
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

// ---- Parent card -----------------------------------------------------------

function ParentCard({
  company,
  aggregate,
}: {
  company: Company
  aggregate: { users: number; clients: number; employees: number; tenants: number }
}) {
  return (
    <Card className="w-full max-w-2xl bg-primary text-primary-foreground border-primary shadow-md">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-lg bg-primary-foreground/15 ring-1 ring-primary-foreground/20 flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold leading-tight">{company.name}</h3>
                <Badge variant="secondary" className="bg-primary-foreground/15 text-primary-foreground border-primary-foreground/20">
                  PARENT
                </Badge>
              </div>
              <div className="text-xs opacity-80 mt-0.5">{company.code} · Group HQ</div>
            </div>
          </div>
          <Badge
            variant="outline"
            className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/30"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                company.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            {company.status === 'ACTIVE' ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <KpiTile icon={<Network className="h-3.5 w-3.5" />} label="Tenants" value={aggregate.tenants} />
          <KpiTile icon={<Briefcase className="h-3.5 w-3.5" />} label="Clients" value={aggregate.clients} />
          <KpiTile icon={<UsersRound className="h-3.5 w-3.5" />} label="Employees" value={aggregate.employees} />
          <KpiTile icon={<Users className="h-3.5 w-3.5" />} label="Users" value={aggregate.users} />
        </div>
      </CardContent>
    </Card>
  )
}

function KpiTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-primary-foreground/10 ring-1 ring-primary-foreground/15 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide opacity-80 font-semibold">
        {icon}
        {label}
      </div>
      <div className="text-xl font-bold mt-1 tabular-nums">{value.toLocaleString('en-IN')}</div>
    </div>
  )
}

// ---- Tenant card -----------------------------------------------------------

function TenantCard({ company, accent }: { company: Company | CompanyChild; accent: string }) {
  const c = company as Company
  const counts = c._count ?? { users: 0, clients: 0, employees: 0 }
  return (
    <Card className={`shadow-sm hover:shadow-md transition-shadow ${accent}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-9 w-9 rounded-md bg-background/70 ring-1 ring-border flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{company.name}</div>
              <Badge variant="secondary" className="font-mono text-[10px] mt-0.5">
                {company.code}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <Badge variant="outline" className="text-[10px]">Tenant</Badge>
          <Badge
            variant="outline"
            className={
              company.status === 'ACTIVE'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                company.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            {company.status === 'ACTIVE' ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <StatTile icon={<Briefcase className="h-3 w-3" />} label="Clients" value={counts.clients} />
          <StatTile icon={<UsersRound className="h-3 w-3" />} label="Employees" value={counts.employees} />
          <StatTile icon={<Users className="h-3 w-3" />} label="Users" value={counts.users} />
        </div>
      </CardContent>
    </Card>
  )
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md bg-background/70 ring-1 ring-border p-2 text-center">
      <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wide text-muted-foreground font-semibold">
        {icon}
        {label}
      </div>
      <div className="text-base font-bold tabular-nums mt-0.5">{value.toLocaleString('en-IN')}</div>
    </div>
  )
}

// ---- Add Tenant Dialog -----------------------------------------------------

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
  const [parents, setParents] = useState<{ id: string; name: string; code: string }[]>([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [parentId, setParentId] = useState<string>(parentCompanyId ?? '')
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE')
  const [submitting, setSubmitting] = useState(false)

  // Load parent options each time the dialog opens.
  useEffect(() => {
    if (!open) return
    ;(async () => {
      try {
        const { companies } = await fetchJson<{ companies: Company[] }>('/api/companies')
        const parentList = companies.filter((c) => c.type === 'PARENT')
        setParents(parentList.map((p) => ({ id: p.id, name: p.name, code: p.code })))
        if (!parentId && parentCompanyId) setParentId(parentCompanyId)
      } catch {
        // ignore — dropdown will be empty
      }
    })()
  }, [open])

  // Reset form fields when dialog closes.
  useEffect(() => {
    if (open) return
    setName('')
    setCode('')
    setStatus('ACTIVE')
    setParentId(parentCompanyId ?? '')
  }, [open])

  const canSubmit = !!name.trim() && !!code.trim() && !!parentId && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const { company } = await fetchJson<{ company: Company }>('/api/companies', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          type: 'TENANT',
          parentId,
          status,
        }),
      })
      toast.success('Tenant added', { description: `${company.name} · ${company.code}` })
      onCreated(company)
      onOpenChange(false)
    } catch (err) {
      toast.error('Failed to add tenant', { description: (err as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> Add tenant company
          </DialogTitle>
          <DialogDescription>
            Register a new tenant under the parent group. Tenants are isolated business units with
            their own clients, employees and financials.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label className="text-xs">Tenant name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Drona Logistics"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Code *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. DRL"
                maxLength={12}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'ACTIVE' | 'INACTIVE')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Parent company *</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select parent" />
              </SelectTrigger>
              <SelectContent>
                {parents.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {p.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Saving…' : 'Add tenant'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
