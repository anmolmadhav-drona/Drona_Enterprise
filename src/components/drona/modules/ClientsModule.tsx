'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Users, UserPlus, Building2, MapPin, ShieldAlert, Loader2, Plus, Search,
  ArrowLeft, FileText, Upload, Download, Eye, Trash2, IndianRupee,
  Briefcase, TrendingUp, CheckCircle, AlertCircle, FilePlus, Image as ImageIcon,
  ExternalLink, Layers, Sparkles, Filter, X, Phone, Mail, Columns3
} from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { toast } from 'sonner'

import { useApp, fetchJson } from '@/lib/app-store'
import { formatINR } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { LoadingState, EmptyState, ErrorState, PageHeader } from './shared'

type ClientCompany = { id: string; name: string; code: string; type?: string }
type ClientTypeItem = { id: string; name: string }
type LocationItem = { id: string; name: string; country: string | null }
type CompanyListItem = { id: string; name: string; code: string; type: string }

type Client = {
  id: string
  companyId: string
  name: string
  code: string
  clientTypeId: string
  locationId: string
  status: string
  contractValue: number | null
  contactName: string | null
  contactEmail: string | null
  contactPhone?: string | null
  customFields?: string | null
  createdAt: string
  updatedAt: string
  company: ClientCompany
  clientType: ClientTypeItem | null
  location: LocationItem | null
  _count?: { revenues: number; allocations: number }
}

type ClientDocument = {
  id: string
  clientId: string
  name: string
  category: string
  fileUrl: string
  fileType: string
  fileSize: number | null
  createdAt: string
}

type ClientDetailData = {
  client: Client & {
    allocations: Array<{
      id: string
      allocationPercent: number
      employee: {
        id: string
        name: string
        code: string
        designation: string | null
        salary: number
        department: { name: string } | null
        location: { name: string } | null
      }
    }>
    revenues: Array<{
      id: string
      date: string
      invoiceNo: string
      description: string | null
      quantity: number
      rate: number
      amount: number
    }>
    documents: ClientDocument[]
  }
  summary: {
    totalRevenue: number
    totalWorkforceCost: number
    profit: number
    marginPercent: number
    allocatedEmployeesCount: number
    billedInvoicesCount: number
    documentsCount: number
  }
}

type StatusFilter = 'all' | 'ACTIVE' | 'INACTIVE'

export function ClientsModule() {
  const { user } = useApp()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  // Page-scoped Local Filters
  const [pageCompanyId, setPageCompanyId] = useState<string | null>(null)
  const [pageLocationId, setPageLocationId] = useState<string | null>(null)
  const [pageClientTypeId, setPageClientTypeId] = useState<string | null>(null)

  const [locations, setLocations] = useState<LocationItem[]>([])
  const [clientTypes, setClientTypes] = useState<ClientTypeItem[]>([])
  const [companies, setCompanies] = useState<CompanyListItem[]>([])

  // Column Visibility & Custom Column Pill Button State
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    name: true,
    company: true,
    type: true,
    location: true,
    contact: true,
    contractValue: true,
    status: true,
    invoices: true,
    allocations: true,
  })
  const [extraCols, setExtraCols] = useState<string[]>([])
  const [newColHeader, setNewColHeader] = useState('')

  const isGroupAdmin = user?.role === 'GROUP_ADMIN'
  const isViewOnly = user?.role === 'STANDARD_USER'

  // Fetch filter options on mount
  useEffect(() => {
    ;(async () => {
      try {
        const [l, t, c] = await Promise.all([
          fetchJson<{ items: LocationItem[] }>('/api/locations').then((r) => r.items),
          fetchJson<{ items: ClientTypeItem[] }>('/api/client-types').then((r) => r.items),
          isGroupAdmin
            ? fetchJson<{ companies: CompanyListItem[] }>('/api/companies').then((r) => r.companies.filter((x) => x.type !== 'PARENT'))
            : Promise.resolve<CompanyListItem[]>([]),
        ])
        setLocations(l)
        setClientTypes(t)
        setCompanies(c)
      } catch {}
    })()
  }, [isGroupAdmin])

  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (pageCompanyId) params.set('companyId', pageCompanyId)
    if (pageLocationId) params.set('locationId', pageLocationId)
    if (pageClientTypeId) params.set('clientTypeId', pageClientTypeId)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    fetchJson<{ clients: Client[] }>(`/api/clients?${params.toString()}`)
      .then((d) => {
        if (!active) return
        setClients(d.clients)
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
  }, [pageCompanyId, pageLocationId, pageClientTypeId, statusFilter])

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // If a client is selected, render the detailed view for that specific client!
  if (selectedClientId) {
    return (
      <ClientDetailView
        clientId={selectedClientId}
        onBack={() => setSelectedClientId(null)}
        isViewOnly={isViewOnly}
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients & Customer Contracts"
        subtitle="Master directory of client accounts, contract values, and billing allocations. Click any client to view dedicated workforce, revenue & document management."
        action={
          isViewOnly ? (
            <Badge variant="outline" className="gap-1.5 text-slate-500 border-slate-200">
              <ShieldAlert className="h-3.5 w-3.5" /> View-only access
            </Badge>
          ) : (
            <Button onClick={() => setAddOpen(true)} size="sm" className="bg-[#0B2148] hover:bg-[#102B63] text-white font-semibold text-xs gap-1.5 rounded-lg shadow-sm">
              <UserPlus className="h-4 w-4 text-[#08B6D8]" /> + Add New Client
            </Button>
          )
        }
      />

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by client or code..."
              className="pl-8 h-9 text-xs border-slate-200 rounded-lg focus:border-[#08B6D8]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {/* Unified Filter Box Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="h-8 px-3.5 rounded-full bg-white border border-slate-200 shadow-xs hover:border-slate-300 flex items-center gap-2 text-xs font-bold text-[#0B2148] transition cursor-pointer">
                <Filter className="h-4 w-4 text-[#08B6D8]" />
                <span>Filter</span>
                {(pageCompanyId !== null || pageLocationId !== null || pageClientTypeId !== null || statusFilter !== 'all') && (
                  <span className="px-2 py-0.5 rounded-full bg-[#08B6D8] text-white text-[10px] font-mono font-bold">
                    {[
                      pageCompanyId !== null,
                      pageLocationId !== null,
                      pageClientTypeId !== null,
                      statusFilter !== 'all',
                    ].filter(Boolean).length}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 bg-white rounded-2xl shadow-xl border border-slate-200 z-50">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-[#0B2148]">Filter Clients</span>
                  <button
                    onClick={() => {
                      setPageCompanyId(null)
                      setPageLocationId(null)
                      setPageClientTypeId(null)
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

                  {/* Client Type */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">Client Type</Label>
                    <Select value={pageClientTypeId ?? 'all'} onValueChange={(v) => setPageClientTypeId(v === 'all' ? null : v)}>
                      <SelectTrigger className="h-8 text-xs rounded-lg border-slate-200">
                        <SelectValue placeholder="All Client Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Client Types</SelectItem>
                        {clientTypes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">Status</Label>
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'ACTIVE' | 'INACTIVE')}>
                      <SelectTrigger className="h-8 text-xs rounded-lg border-slate-200">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Clients</SelectItem>
                        <SelectItem value="ACTIVE">Active Only</SelectItem>
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
                    { id: 'name', label: 'Client Name' },
                    { id: 'company', label: 'Company Scope' },
                    { id: 'type', label: 'Client Type' },
                    { id: 'location', label: 'Location' },
                    { id: 'contact', label: 'Contact & Mobile' },
                    { id: 'contractValue', label: 'Contract Value' },
                    { id: 'status', label: 'Status' },
                    { id: 'invoices', label: 'Billed Invoices' },
                    { id: 'allocations', label: 'Allocations' },
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

      {/* Clients Table */}
      {loading ? (
        <LoadingState label="Loading client master list…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : filteredClients.length === 0 ? (
        <EmptyState
          title="No clients found"
          desc="Adjust your search parameters or register your first client account."
          icon={<Users className="h-8 w-8 text-slate-400" />}
        />
      ) : (
        <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    {columnVisibility.name !== false && <th className="py-3 px-4">Client Name</th>}
                    {isGroupAdmin && columnVisibility.company !== false && <th className="py-3 px-4">Company Scope</th>}
                    {columnVisibility.type !== false && <th className="py-3 px-4">Client Type</th>}
                    {columnVisibility.location !== false && <th className="py-3 px-4">Location</th>}
                    {columnVisibility.contact !== false && <th className="py-3 px-4">Contact & Mobile</th>}
                    {extraCols.map((c) => columnVisibility[c] !== false && <th key={c} className="py-3 px-4">{c}</th>)}
                    {columnVisibility.contractValue !== false && <th className="py-3 px-4 text-right">Contract Value</th>}
                    {columnVisibility.status !== false && <th className="py-3 px-4">Status</th>}
                    {columnVisibility.invoices !== false && <th className="py-3 px-4 text-center">Billed Invoices</th>}
                    {columnVisibility.allocations !== false && <th className="py-3 px-4 text-center">Allocations</th>}
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClients.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedClientId(c.id)}
                      className="hover:bg-[#E8F8FC]/60 transition cursor-pointer group"
                    >
                      {columnVisibility.name !== false && (
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-[#0B2148] group-hover:bg-[#08B6D8] transition-colors text-white flex items-center justify-center font-bold text-xs shadow-sm">
                              {c.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-[#0B2148] group-hover:text-[#08B6D8] transition-colors text-sm flex items-center gap-1.5">
                                {c.name}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">{c.code}</div>
                            </div>
                          </div>
                        </td>
                      )}
                      {isGroupAdmin && columnVisibility.company !== false && (
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-[#08B6D8]" />
                            {c.company.name}
                          </div>
                        </td>
                      )}
                      {columnVisibility.type !== false && (
                        <td className="py-3 px-4">
                          {c.clientType ? (
                            <Badge className="bg-[#08B6D8]/15 text-[#0B2148] font-semibold text-[10px]">
                              {c.clientType.name}
                            </Badge>
                          ) : '—'}
                        </td>
                      )}
                      {columnVisibility.location !== false && (
                        <td className="py-3 px-4 text-slate-600">
                          {c.location ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              {c.location.name}
                            </div>
                          ) : '—'}
                        </td>
                      )}
                      {columnVisibility.contact !== false && (
                        <td className="py-3 px-4">
                          {c.contactName || c.contactPhone || c.contactEmail ? (
                            <div className="space-y-0.5">
                              {c.contactName && <div className="font-semibold text-[#0B2148]">{c.contactName}</div>}
                              {c.contactPhone && (
                                <div className="text-[11px] font-medium text-slate-700 flex items-center gap-1 font-mono">
                                  <Phone className="h-3 w-3 text-[#08B6D8]" />
                                  {c.contactPhone}
                                </div>
                              )}
                              {c.contactEmail && (
                                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <Mail className="h-2.5 w-2.5 text-slate-400" />
                                  {c.contactEmail}
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
                              if (!c.customFields) return '—'
                              try {
                                const parsed = JSON.parse(c.customFields)
                                return parsed[colName] ?? '—'
                              } catch {
                                return '—'
                              }
                            })()}
                          </td>
                        )
                      ))}
                      {columnVisibility.contractValue !== false && (
                        <td className="py-3 px-4 text-right font-bold text-[#0B2148]">
                          {c.contractValue != null ? formatINR(c.contractValue, true) : '—'}
                        </td>
                      )}
                      {columnVisibility.status !== false && (
                        <td className="py-3 px-4">
                          <Badge className={`text-[10px] font-bold ${c.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {c.status}
                          </Badge>
                        </td>
                      )}
                      {columnVisibility.invoices !== false && (
                        <td className="py-3 px-4 text-center">
                          <Badge variant="secondary" className="font-bold">{c._count?.revenues ?? 0}</Badge>
                        </td>
                      )}
                      {columnVisibility.allocations !== false && (
                        <td className="py-3 px-4 text-center">
                          <Badge variant="secondary" className="font-bold">{c._count?.allocations ?? 0}</Badge>
                        </td>
                      )}
                      <td className="py-3 px-4 text-center">
                        <Button size="sm" variant="ghost" className="h-7 text-[11px] font-semibold text-[#08B6D8] hover:text-[#0B2148] hover:bg-[#08B6D8]/20 gap-1 rounded-lg">
                          <Eye className="h-3.5 w-3.5" /> View Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Client Dialog */}
      <AddClientDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        isGroupAdmin={isGroupAdmin}
        defaultCompanyId={pageCompanyId ?? user?.companyId ?? null}
        onCreated={(c) => setClients([c, ...clients])}
      />
    </div>
  )
}

/**
 * Add Client Dialog with "+ Other" option for Client Type & Location dropdowns.
 * When "Other" is selected, custom fields pop up and get automatically persisted to DB.
 */
function AddClientDialog({
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
  onCreated: (c: Client) => void
}) {
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [clientTypes, setClientTypes] = useState<ClientTypeItem[]>([])
  const [locations, setLocations] = useState<LocationItem[]>([])

  const [companyId, setCompanyId] = useState<string>(defaultCompanyId ?? '')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [clientTypeId, setClientTypeId] = useState('')
  const [customClientType, setCustomClientType] = useState('')
  const [locationId, setLocationId] = useState('')
  const [customLocation, setCustomLocation] = useState('')
  const [contractValue, setContractValue] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [customFieldsList, setCustomFieldsList] = useState<{ key: string; value: string }[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    ;(async () => {
      try {
        const [c, t, l] = await Promise.all([
          isGroupAdmin
            ? fetchJson<{ companies: CompanyListItem[] }>('/api/companies').then((r) => r.companies.filter((x) => x.type !== 'PARENT'))
            : Promise.resolve<CompanyListItem[]>([]),
          fetchJson<{ items: ClientTypeItem[] }>('/api/client-types').then((r) => r.items),
          fetchJson<{ items: LocationItem[] }>('/api/locations').then((r) => r.items),
        ])
        setCompanies(c)
        setClientTypes(t)
        setLocations(l)
        if (isGroupAdmin && !companyId && defaultCompanyId) setCompanyId(defaultCompanyId)
      } catch (e) {}
    })()
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !code.trim() || !clientTypeId || !locationId || (isGroupAdmin && !companyId)) return
    if (clientTypeId === '__OTHER__' && !customClientType.trim()) {
      toast.error('Please enter a custom client type name')
      return
    }
    if (locationId === '__OTHER__' && !customLocation.trim()) {
      toast.error('Please enter a custom location name')
      return
    }

    setSubmitting(true)
    try {
      let finalClientTypeId = clientTypeId
      let finalLocationId = locationId

      // 1. Handle Custom Client Type ("Other") -> Persist to DB
      if (clientTypeId === '__OTHER__') {
        const res = await fetchJson<{ item: ClientTypeItem }>('/api/client-types', {
          method: 'POST',
          body: JSON.stringify({ name: customClientType.trim() }),
        })
        finalClientTypeId = res.item.id
        setClientTypes((prev) => [...prev.filter((x) => x.id !== res.item.id), res.item])
      }

      // 2. Handle Custom Location ("Other") -> Persist to DB
      if (locationId === '__OTHER__') {
        const res = await fetchJson<{ item: LocationItem }>('/api/locations', {
          method: 'POST',
          body: JSON.stringify({ name: customLocation.trim() }),
        })
        finalLocationId = res.item.id
        setLocations((prev) => [...prev.filter((x) => x.id !== res.item.id), res.item])
      }

      // 3. Create the Client Account
      const customObj: Record<string, string> = {}
      for (const item of customFieldsList) {
        if (item.key.trim() && item.value.trim()) {
          customObj[item.key.trim()] = item.value.trim()
        }
      }

      const body: Record<string, unknown> = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        clientTypeId: finalClientTypeId,
        locationId: finalLocationId,
        contractValue: contractValue ? Number(contractValue) : undefined,
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        customFields: Object.keys(customObj).length > 0 ? customObj : undefined,
      }
      if (isGroupAdmin) body.companyId = companyId

      const { client } = await fetchJson<{ client: Client }>('/api/clients', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      toast.success(`Client ${client.name} created successfully!`)
      onCreated(client)
      onOpenChange(false)
      // Reset state
      setName('')
      setCode('')
      setContractValue('')
      setContactName('')
      setContactEmail('')
      setContactPhone('')
      setCustomFieldsList([])
      setClientTypeId('')
      setCustomClientType('')
      setLocationId('')
      setCustomLocation('')
    } catch (err: any) {
      toast.error(err.message || 'Failed to create client')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-6 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#0B2148] flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[#08B6D8]" /> Add New Client Account
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Register a client company under the workspace scope. Custom Client Types or Locations created via "Other" are automatically added to the database.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {isGroupAdmin && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Tenant Company *</Label>
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
              <Label className="text-xs font-semibold text-slate-700">Client Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Corp" className="h-9 text-xs" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Code *</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. ACME" className="h-9 text-xs font-mono" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Client Type Dropdown with "Other" */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Client Type *</Label>
              <Select value={clientTypeId} onValueChange={setClientTypeId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {clientTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                  <SelectItem value="__OTHER__" className="font-semibold text-[#08B6D8]">
                    + Other (Add Custom Type)
                  </SelectItem>
                </SelectContent>
              </Select>
              {clientTypeId === '__OTHER__' && (
                <div className="mt-2 space-y-1">
                  <Input
                    value={customClientType}
                    onChange={(e) => setCustomClientType(e.target.value)}
                    placeholder="Enter new Client Type..."
                    className="h-8 text-xs border-[#08B6D8] focus:ring-1 focus:ring-[#08B6D8]"
                    required
                  />
                  <p className="text-[10px] text-slate-400">Will be saved to DB for future selection.</p>
                </div>
              )}
            </div>

            {/* Location Dropdown with "Other" */}
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
                  <SelectItem value="__OTHER__" className="font-semibold text-[#08B6D8]">
                    + Other (Add Custom Location)
                  </SelectItem>
                </SelectContent>
              </Select>
              {locationId === '__OTHER__' && (
                <div className="mt-2 space-y-1">
                  <Input
                    value={customLocation}
                    onChange={(e) => setCustomLocation(e.target.value)}
                    placeholder="Enter new Location..."
                    className="h-8 text-xs border-[#08B6D8] focus:ring-1 focus:ring-[#08B6D8]"
                    required
                  />
                  <p className="text-[10px] text-slate-400">Will be saved to DB for future selection.</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Annual Contract Value (INR)</Label>
              <Input type="number" value={contractValue} onChange={(e) => setContractValue(e.target.value)} placeholder="e.g. 15000000" className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Contact Person Name</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="e.g. Rajesh Sharma" className="h-9 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Mobile / Phone Number</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="e.g. +91 98765 43210" className="h-9 text-xs font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Contact Email Address</Label>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="e.g. rajesh@acme.com" className="h-9 text-xs" />
            </div>
          </div>

          {/* Dynamic Custom Columns & Fields Manager */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-[#0B2148] flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-[#08B6D8]" /> Custom Columns / Custom Attributes
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
                      placeholder="Column Name (e.g. GSTIN)"
                      value={field.key}
                      onChange={(e) => {
                        const copy = [...customFieldsList]
                        copy[idx].key = e.target.value
                        setCustomFieldsList(copy)
                      }}
                      className="h-8 text-xs flex-1 border-slate-200"
                    />
                    <Input
                      placeholder="Value (e.g. 27AAACB1234F1ZN)"
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
            <Button type="submit" disabled={submitting} className="bg-[#0B2148] hover:bg-[#102B63] text-white">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Full Detailed View Component for a specific Client.
 * Includes Header, Financial Metrics, Allocated Workforce, Billed Invoices, and Document Upload/Viewer.
 */
function ClientDetailView({
  clientId,
  onBack,
  isViewOnly,
}: {
  clientId: string
  onBack: () => void
  isViewOnly: boolean
}) {
  const [data, setData] = useState<ClientDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Document Upload States
  const [uploadCategory, setUploadCategory] = useState('Invoice')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Document Lightbox Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<ClientDocument | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Document Category Filter
  const [docCategoryFilter, setDocCategoryFilter] = useState<string>('all')
  const loadClientDetails = async () => {
    try {
      setLoading(true)

      const res = await fetchJson<ClientDetailData>(
        `/api/clients/${clientId}`
      )

      setData(res)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to load client details')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
  let cancelled = false

  const load = async () => {
    try {
      setLoading(true)

      const res = await fetchJson<ClientDetailData>(
        `/api/clients/${clientId}`
      )

      if (!cancelled) {
        setData(res)
        setError(null)
      }
    } catch (e: any) {
      if (!cancelled) {
        setError(e.message || 'Failed to load client details')
      }
    } finally {
      if (!cancelled) {
        setLoading(false)
      }
    }
  }

  void load()

  return () => {
    cancelled = true
  }
}, [clientId])

const getDocumentUrl = async (docId: string) => {
  const response = await fetch(
    `/api/clients/${clientId}/documents/${docId}/download`
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Failed to get document URL')
  }

  return data.url as string
}

  // File Upload Handler
const handleFileUpload = async (
  e: React.ChangeEvent<HTMLInputElement>
) => {
  const files = Array.from(e.target.files || [])
  if (files.length === 0) return

  const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB

  const validFiles = files.filter((file) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(
        `"${file.name}" exceeds the 25 MB file size limit`
      )
      return false
    }

    return true
  })

  if (validFiles.length === 0) {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    return
  }

  setUploading(true)
  setUploadProgress({
    current: 0,
    total: validFiles.length,
  })

  let uploadedCount = 0
  let failedCount = 0

  try {
    for (const file of validFiles) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('category', uploadCategory)

        const response = await fetch(
          `/api/clients/${clientId}/documents`,
          {
            method: 'POST',
            body: formData,
          }
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(
            data.error || 'Failed to upload document'
          )
        }

        uploadedCount++
      } catch (error: any) {
        failedCount++

        toast.error(
          `${file.name}: ${
            error.message || 'Upload failed'
          }`
        )
      }

      setUploadProgress((prev) => ({
        ...prev,
        current: prev.current + 1,
      }))
    }

    if (uploadedCount > 0) {
      toast.success(
        `${uploadedCount} document${
          uploadedCount > 1 ? 's' : ''
        } uploaded successfully!`
      )
    }

    if (failedCount > 0) {
      toast.error(
        `${failedCount} document${
          failedCount > 1 ? 's' : ''
        } failed to upload`
      )
    }

    await loadClientDetails()
  } finally {
    setUploading(false)
    setUploadProgress({
      current: 0,
      total: 0,
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
}
  const handleDeleteDocument = async (docId: string, docName: string) => {
    if (!confirm(`Are you sure you want to delete "${docName}"?`)) return
    try {
      await fetchJson(`/api/clients/${clientId}/documents/${docId}`, {
        method: 'DELETE',
      })
      toast.success('Document deleted')
      if (previewDoc?.id === docId) setPreviewDoc(null)
      loadClientDetails()
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete document')
    }
  }

  if (loading) return <LoadingState label="Fetching complete client record…" />
  if (error || !data) return <ErrorState message={error || 'Client not found'} />

  const { client, summary } = data

  const filteredDocs = client.documents.filter(
    (d) => docCategoryFilter === 'all' || d.category === docCategoryFilter
  )

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            onClick={onBack}
            variant="outline"
            size="sm"
            className="h-9 px-3 border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold gap-1.5 rounded-xl"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Clients List
          </Button>
          <div className="h-5 w-[1px] bg-slate-200 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Clients</span>
            <span className="text-xs text-slate-300">/</span>
            <span className="text-xs font-bold text-[#0B2148]">{client.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge className={`text-xs font-bold px-2.5 py-1 ${client.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
            {client.status} CLIENT
          </Badge>
        </div>
      </div>

      {/* Client Profile Header Banner */}
      <Card className="border border-slate-200/80 shadow-sm bg-gradient-to-r from-[#081B3A] via-[#0B2148] to-[#0A2D6C] text-white rounded-2xl overflow-hidden relative">
        <div className="p-6 sm:p-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-2xl bg-[#08B6D8] text-[#081B3A] flex items-center justify-center font-black text-2xl shadow-lg shrink-0">
                {client.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{client.name}</h1>
                  <span className="px-2 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-xs">
                    {client.code}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-300 flex-wrap">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Building2 className="h-3.5 w-3.5 text-[#08B6D8]" /> {client.company.name}
                  </span>
                  <span>•</span>
                  {client.clientType && (
                    <Badge className="bg-[#08B6D8]/20 text-[#16C4E8] border border-[#08B6D8]/40 text-[11px]">
                      {client.clientType.name}
                    </Badge>
                  )}
                  {client.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" /> {client.location.name}
                    </span>
                  )}
                  {client.contactPhone && (
                    <a href={`tel:${client.contactPhone}`} className="flex items-center gap-1 text-[#16C4E8] font-semibold hover:underline">
                      <Phone className="h-3.5 w-3.5 text-[#08B6D8]" /> {client.contactPhone}
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 text-right min-w-[200px]">
              <div className="text-[11px] text-slate-300 uppercase tracking-wider font-semibold">Annual Contract Value</div>
              <div className="text-2xl font-black text-[#16C4E8] mt-0.5">
                {client.contractValue != null ? formatINR(client.contractValue, true) : 'Not Specified'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Financial Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Billed Revenue */}
        <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Total Billed Revenue</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <IndianRupee className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#0B2148]">
            {formatINR(summary.totalRevenue, true)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            From {summary.billedInvoicesCount} billed invoice entries
          </div>
        </Card>

        {/* Allocated Workforce Cost */}
        <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Workforce Cost</span>
            <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Briefcase className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#0B2148]">
            {formatINR(summary.totalWorkforceCost, true)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            {summary.allocatedEmployeesCount} employees allocated
          </div>
        </Card>

        {/* Client Net Profit */}
        <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Net Client Profit</span>
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${summary.profit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className={`text-2xl font-extrabold ${summary.profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
            {formatINR(summary.profit, true)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Revenue − Allocated Workforce Cost
          </div>
        </Card>

        {/* Profit Margin % */}
        <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Profit Margin</span>
            <div className="h-8 w-8 rounded-xl bg-cyan-50 text-[#08B6D8] flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#0B2148]">
            {summary.marginPercent.toFixed(1)}%
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
            <div
              className={`h-full rounded-full ${summary.marginPercent >= 30 ? 'bg-emerald-500' : summary.marginPercent >= 10 ? 'bg-amber-500' : 'bg-rose-500'}`}
              style={{ width: `${Math.min(Math.max(summary.marginPercent, 0), 100)}%` }}
            />
          </div>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs defaultValue="documents" className="space-y-6">
        <TabsList className="bg-white p-1 rounded-2xl border border-slate-200/80 shadow-sm h-12 inline-flex">
          <TabsTrigger value="documents" className="data-[state=active]:bg-[#0B2148] data-[state=active]:text-white rounded-xl px-4 py-2 text-xs font-bold gap-2">
            <FileText className="h-4 w-4 text-[#08B6D8]" /> Uploaded Documents & Invoices ({client.documents.length})
          </TabsTrigger>
          <TabsTrigger value="workforce" className="data-[state=active]:bg-[#0B2148] data-[state=active]:text-white rounded-xl px-4 py-2 text-xs font-bold gap-2">
            <Users className="h-4 w-4 text-[#08B6D8]" /> Allocated Workforce ({client.allocations.length})
          </TabsTrigger>
          <TabsTrigger value="revenue" className="data-[state=active]:bg-[#0B2148] data-[state=active]:text-white rounded-xl px-4 py-2 text-xs font-bold gap-2">
            <IndianRupee className="h-4 w-4 text-[#08B6D8]" /> Revenue & Invoices ({client.revenues.length})
          </TabsTrigger>
          <TabsTrigger value="custom-fields" className="data-[state=active]:bg-[#0B2148] data-[state=active]:text-white rounded-xl px-4 py-2 text-xs font-bold gap-2">
            <Layers className="h-4 w-4 text-[#08B6D8]" /> Custom Columns & Attributes
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Client Documents & Media */}
        <TabsContent value="documents" className="space-y-6">
          {/* Upload Drop Zone Card */}
          {!isViewOnly && (
            <Card className="border-2 border-dashed border-[#08B6D8]/40 hover:border-[#08B6D8] bg-[#E8F8FC]/20 rounded-2xl p-6 transition">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-[#08B6D8]/20 text-[#08B6D8] flex items-center justify-center shrink-0">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#0B2148]">Upload Client Document / Image / Invoice</h3>
                    <p className="text-xs text-slate-500">
                      Upload scanned invoices, contracts, receipts, or client images. Available instantly in this client's separate storage.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Select value={uploadCategory} onValueChange={setUploadCategory}>
                    <SelectTrigger className="h-9 text-xs w-32 rounded-xl bg-white border-slate-200">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Invoice">Invoice</SelectItem>
                      <SelectItem value="Contract">Contract</SelectItem>
                      <SelectItem value="Receipt">Receipt</SelectItem>
                      <SelectItem value="Image">Image</SelectItem>
                      <SelectItem value="Document">Document</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="bg-[#0B2148] hover:bg-[#102B63] text-white text-xs font-semibold h-9 px-4 rounded-xl shadow-sm gap-2 shrink-0"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FilePlus className="h-4 w-4 text-[#08B6D8]" />
                    )}

                    {uploading
                      ? `Uploading ${uploadProgress.current}/${uploadProgress.total}...`
                      : 'Select Files to Upload'}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Document Gallery Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0B2148]">
                <Layers className="h-4 w-4 text-[#08B6D8]" /> Dedicated Client Storage
                <span className="text-slate-400 font-normal">({filteredDocs.length} available)</span>
              </div>

              {/* Category Filter Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {['all', 'Invoice', 'Contract', 'Receipt', 'Image', 'Document', 'Other'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setDocCategoryFilter(cat)}
                    className={`h-7 px-3 rounded-lg text-xs font-semibold transition border ${
                      docCategoryFilter === cat
                        ? 'bg-[#0B2148] text-white border-[#0B2148]'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {cat === 'all' ? 'All Docs' : cat}
                  </button>
                ))}
              </div>
            </div>

            {filteredDocs.length === 0 ? (
              <EmptyState
                title="No documents uploaded for this client"
                desc="Use the upload tool above to attach invoices, contracts, or images for this client."
                icon={<FileText className="h-8 w-8 text-slate-400" />}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredDocs.map((doc) => {
                  const isImage = doc.fileType.startsWith('image/')
                  return (
                    <Card
                      key={doc.id}
                      className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden hover:shadow-md transition group flex flex-col"
                    >
                      {/* Image Thumbnail Preview */}
                      <div
                        onClick={async () => {
                          try {
                            const url = await getDocumentUrl(doc.id)
                            setPreviewUrl(url)
                            setPreviewDoc(doc)
                          } catch (err: any) {
                            toast.error(err.message || 'Failed to open document')
                          }
                        }}
                        className="h-40 bg-slate-100 relative cursor-pointer overflow-hidden flex items-center justify-center group-hover:opacity-95 transition"
                      >
                        {isImage ? (
                          <div className="flex flex-col items-center gap-2 text-slate-400">
                            <FileText className="h-12 w-12" />
                            <span className="text-[10px] uppercase tracking-wider font-bold">
                              IMAGE
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-slate-400">
                            <FileText className="h-12 w-12" />
                            <span className="text-[10px] uppercase tracking-wider font-bold">{doc.fileType.split('/')[1] || 'DOC'}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white">
                          <Eye className="h-5 w-5" />
                          <span className="text-xs font-bold">View Document</span>
                        </div>
                        <Badge className="absolute top-2 left-2 bg-[#0B2148]/80 backdrop-blur-md text-white text-[10px] font-semibold">
                          {doc.category}
                        </Badge>
                      </div>

                      {/* Card Meta Info */}
                      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <h4 className="text-xs font-bold text-[#0B2148] truncate" title={doc.name}>
                            {doc.name}
                          </h4>
                          <div className="text-[10px] text-slate-400 flex items-center justify-between mt-1">
                            <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                            <span>{doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : 'Data'}</span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <Button
                            onClick={async () => {
                              try {
                                const url = await getDocumentUrl(doc.id)
                                setPreviewUrl(url)
                                setPreviewDoc(doc)
                              } catch (err: any) {
                                toast.error(err.message || 'Failed to open document')
                              }
                            }}
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] border-slate-200 hover:bg-[#08B6D8]/10 hover:text-[#0B2148] gap-1 px-2.5 rounded-lg font-semibold"
                          >
                            <Eye className="h-3 w-3 text-[#08B6D8]" /> View
                          </Button>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={async () => {
                                try {
                                  const url = await getDocumentUrl(doc.id)
                                  window.open(url, '_blank', 'noopener,noreferrer')
                                } catch (err: any) {
                                  toast.error(err.message || 'Failed to download document')
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-[#0B2148] rounded-lg hover:bg-slate-100 transition"
                              title="Download File"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            {!isViewOnly && (
                              <button
                                onClick={() => handleDeleteDocument(doc.id, doc.name)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                                title="Delete Document"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 2: Allocated Workforce */}
        <TabsContent value="workforce">
          <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-200 px-6 py-4">
              <CardTitle className="text-sm font-bold text-[#0B2148] flex items-center justify-between">
                <span>Employees Assigned to {client.name}</span>
                <Badge variant="outline" className="text-xs border-slate-300">
                  Total Allocated Cost: {formatINR(summary.totalWorkforceCost, true)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {client.allocations.length === 0 ? (
                <EmptyState
                  title="No employees currently allocated"
                  desc="Assign workforce to this client in the Allocations module."
                  icon={<Users className="h-8 w-8 text-slate-400" />}
                />
              ) : (
                <div className="overflow-x-auto scroll-thin">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <th className="py-3 px-4">Employee Name</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Designation</th>
                        <th className="py-3 px-4 text-center">Allocation %</th>
                        <th className="py-3 px-4 text-right">Monthly Salary</th>
                        <th className="py-3 px-4 text-right">Allocated Cost Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {client.allocations.map((alloc) => {
                        const emp = alloc.employee
                        const costShare = (emp.salary * alloc.allocationPercent) / 100
                        return (
                          <tr key={alloc.id} className="hover:bg-[#E8F8FC]/40 transition">
                            <td className="py-3 px-4 font-bold text-[#0B2148]">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-lg bg-[#0B2148] text-white flex items-center justify-center text-[10px] font-bold">
                                  {emp.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div>{emp.name}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{emp.code}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-600 font-medium">
                              {emp.department?.name || '—'}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {emp.designation || '—'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Badge className="bg-[#08B6D8]/20 text-[#0B2148] font-bold text-xs">
                                {alloc.allocationPercent}%
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right font-medium text-slate-700">
                              {formatINR(emp.salary, true)}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-700">
                              {formatINR(costShare, true)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Billed Invoices & Revenue */}
        <TabsContent value="revenue">
          <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-200 px-6 py-4">
              <CardTitle className="text-sm font-bold text-[#0B2148] flex items-center justify-between">
                <span>Revenue & Invoices Billed to {client.name}</span>
                <Badge variant="outline" className="text-xs border-slate-300">
                  Total Billed: {formatINR(summary.totalRevenue, true)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {client.revenues.length === 0 ? (
                <EmptyState
                  title="No billed invoices found"
                  desc="Log billing entries for this client under the Revenue module."
                  icon={<IndianRupee className="h-8 w-8 text-slate-400" />}
                />
              ) : (
                <div className="overflow-x-auto scroll-thin">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Invoice No</th>
                        <th className="py-3 px-4">Description</th>
                        <th className="py-3 px-4 text-right">Quantity</th>
                        <th className="py-3 px-4 text-right">Rate</th>
                        <th className="py-3 px-4 text-right">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {client.revenues.map((rev) => (
                        <tr key={rev.id} className="hover:bg-[#E8F8FC]/40 transition">
                          <td className="py-3 px-4 text-slate-600 font-medium">
                            {new Date(rev.date).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[#0B2148]">
                            {rev.invoiceNo}
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                            {rev.description || 'Standard Service Invoice'}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600 font-medium">
                            {rev.quantity}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600">
                            {formatINR(rev.rate, true)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-700">
                            {formatINR(rev.amount, true)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: Custom Columns & Attributes */}
        <TabsContent value="custom-fields">
          <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-200 px-6 py-4">
              <CardTitle className="text-sm font-bold text-[#0B2148]">
                Custom Columns & Attributes for {client.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {(() => {
                if (!client.customFields) {
                  return (
                    <EmptyState
                      title="No custom columns defined"
                      desc="Add custom fields when creating or editing a client."
                      icon={<Layers className="h-8 w-8 text-slate-400" />}
                    />
                  )
                }

                let entries: [string, unknown][] = []

                try {
                  const parsed = JSON.parse(client.customFields)
                  entries = Object.entries(parsed)
                } catch {
                  entries = []
                }

                if (entries.length === 0) {
                  return (
                    <EmptyState
                      title="No custom columns defined"
                      desc="Add custom fields when creating or editing a client."
                      icon={<Layers className="h-8 w-8 text-slate-400" />}
                    />
                  )
                }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {entries.map(([k, v]) => (
                      <div
                        key={k}
                        className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1"
                      >
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          {k}
                        </div>

                        <div className="text-sm font-bold text-[#0B2148]">
                          {String(v)}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Document Lightbox / Modal Viewer */}
      {previewDoc && (
        <Dialog
          open={!!previewDoc}
          onOpenChange={() => {
            setPreviewDoc(null)
            setPreviewUrl(null)
          }}
        >
          <DialogContent className="sm:max-w-4xl max-h-[90vh] p-6 rounded-2xl flex flex-col">
            <DialogHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <DialogTitle className="text-base font-bold text-[#0B2148] flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#08B6D8]" />
                  {previewDoc.name}
                </DialogTitle>

                <DialogDescription className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                  <span>
                    Category: <b>{previewDoc.category}</b>
                  </span>
                  <span>•</span>
                  <span>
                    Uploaded:{' '}
                    <b>
                      {new Date(previewDoc.createdAt).toLocaleDateString()}
                    </b>
                  </span>
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-auto py-4 flex items-center justify-center bg-slate-900 rounded-xl my-2 p-4 min-h-[350px]">
              {previewDoc.fileType.startsWith('image/') ? (
                previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={previewDoc.name}
                    className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-2xl"
                  />
                ) : (
                  <div className="text-center text-white">
                    <Loader2 className="h-8 w-8 mx-auto animate-spin text-[#08B6D8]" />
                    <p className="text-sm mt-3">Loading document...</p>
                  </div>
                )
              ) : (
                <div className="text-center text-white space-y-3">
                  <FileText className="h-16 w-16 mx-auto text-[#08B6D8]" />

                  <p className="text-sm font-semibold">
                    Document preview not directly embeddable
                  </p>

                  <button
                    onClick={async () => {
                      try {
                        const url = await getDocumentUrl(previewDoc.id)
                        window.open(url, '_blank', 'noopener,noreferrer')
                      } catch (err: any) {
                        toast.error(
                          err.message || 'Failed to download document'
                        )
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#08B6D8] text-[#081B3A] rounded-xl font-bold text-xs"
                  >
                    <Download className="h-4 w-4" />
                    Download Document
                  </button>
                </div>
              )}
            </div>

            <DialogFooter className="border-t border-slate-100 pt-3 flex items-center justify-between sm:justify-between">
              <button
                onClick={async () => {
                  try {
                    const url = await getDocumentUrl(previewDoc.id)
                    window.open(url, '_blank', 'noopener,noreferrer')
                  } catch (err: any) {
                    toast.error(
                      err.message || 'Failed to download document'
                    )
                  }
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0B2148] text-white rounded-xl text-xs font-semibold hover:bg-[#102B63] transition"
              >
                <Download className="h-4 w-4 text-[#08B6D8]" />
                Download High-Res File
              </button>

              <Button
                variant="outline"
                onClick={() => {
                  setPreviewDoc(null)
                  setPreviewUrl(null)
                }}
                className="h-8 text-xs"
              >
                Close Preview
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}