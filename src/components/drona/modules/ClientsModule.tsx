'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Users, UserPlus, Building2, MapPin, Filter, ShieldAlert, Loader2, Plus,
} from 'lucide-react'
import { toast } from 'sonner'

import { useApp, fetchJson, type AppUser } from '@/lib/app-store'
import { formatINR, formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

type ClientCompany = { id: string; name: string; code: string }
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
  createdAt: string
  updatedAt: string
  company: ClientCompany
  clientType: ClientTypeItem | null
  location: LocationItem | null
  _count: { revenues: number; allocations: number }
}

type StatusFilter = 'all' | 'ACTIVE' | 'INACTIVE'

// ---- Component -------------------------------------------------------------

export function ClientsModule() {
  const { user, filterCompanyId, filterLocationId, filterClientTypeId } = useApp()

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [addOpen, setAddOpen] = useState(false)

  const isGroupAdmin = user?.role === 'GROUP_ADMIN'
  const isViewOnly = user?.role === 'STANDARD_USER'

  // Reload when any filter (or status pill) changes.
  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (filterCompanyId) params.set('companyId', filterCompanyId)
    if (filterLocationId) params.set('locationId', filterLocationId)
    if (filterClientTypeId) params.set('clientTypeId', filterClientTypeId)
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
  }, [filterCompanyId, filterLocationId, filterClientTypeId, statusFilter])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clients"
        subtitle="Master list of all clients across accessible tenants"
        action={
          isViewOnly ? (
            <Badge variant="outline" className="gap-1.5 text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" /> View-only access
            </Badge>
          ) : (
            <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
              <UserPlus className="h-4 w-4" /> Add Client
            </Button>
          )
        }
      />

      {/* Status filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
          <Filter className="h-3.5 w-3.5" /> Status
        </div>
        {(['all', 'ACTIVE', 'INACTIVE'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`h-7 px-3 rounded-full text-xs font-medium transition border ${
              statusFilter === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:bg-muted/60 text-muted-foreground'
            }`}
          >
            {s === 'all' ? 'All' : s === 'ACTIVE' ? 'Active' : 'Inactive'}
          </button>
        ))}
        <div className="ml-auto text-xs text-muted-foreground">
          {clients.length} {clients.length === 1 ? 'client' : 'clients'}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <LoadingState label="Loading clients…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : clients.length === 0 ? (
        <EmptyState
          title="No clients found"
          desc="Adjust the filters above or add a new client to get started."
          icon={<Users className="h-8 w-8 text-muted-foreground/60" />}
        />
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto scroll-thin max-h-[70vh]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="pl-4">Client</TableHead>
                    {isGroupAdmin && <TableHead>Company</TableHead>}
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Contract Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Revenue</TableHead>
                    <TableHead className="text-center pr-4">Allocations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/40">
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 flex items-center justify-center text-xs font-semibold">
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="leading-tight">
                            <div className="text-sm font-medium">{c.name}</div>
                            <div className="text-[11px] text-muted-foreground">{c.code}</div>
                          </div>
                        </div>
                      </TableCell>
                      {isGroupAdmin && (
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">{c.company.name}</span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        {c.clientType ? (
                          <Badge variant="secondary" className="bg-violet-50 text-violet-700 border-violet-200">
                            {c.clientType.name}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.location ? (
                          <div className="flex items-center gap-1.5 text-sm">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{c.location.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {c.contractValue != null ? formatINR(c.contractValue, true) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            c.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              c.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          {c.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{c._count.revenues}</Badge>
                      </TableCell>
                      <TableCell className="text-center pr-4">
                        <Badge variant="secondary">{c._count.allocations}</Badge>
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
      <AddClientDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        isGroupAdmin={isGroupAdmin}
        defaultCompanyId={filterCompanyId ?? user?.companyId ?? null}
        onCreated={(c) => {
          setClients((prev) => {
            // Respect current status filter client-side to avoid flicker.
            if (statusFilter !== 'all' && c.status !== statusFilter) return prev
            const next = [c, ...prev]
            return next.sort((a, b) => a.name.localeCompare(b.name))
          })
        }}
      />
    </div>
  )
}

// ---- Add Client Dialog -----------------------------------------------------

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
  const [locationId, setLocationId] = useState('')
  const [contractValue, setContractValue] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Load dropdown options each time the dialog opens.
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
        // Default company selection when admin opens for the first time.
        if (isGroupAdmin && !companyId && defaultCompanyId) setCompanyId(defaultCompanyId)
      } catch (e) {
        // ignore — selects will be empty
      }
    })()
  }, [open])

  // Reset form fields when dialog closes.
  useEffect(() => {
    if (open) return
    setName('')
    setCode('')
    setClientTypeId('')
    setLocationId('')
    setContractValue('')
    setContactName('')
    setContactEmail('')
  }, [open])

  const canSubmit =
    name.trim() &&
    code.trim() &&
    clientTypeId &&
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
        clientTypeId,
        locationId,
        contractValue: contractValue ? Number(contractValue) : undefined,
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
      }
      if (isGroupAdmin) body.companyId = companyId
      const { client } = await fetchJson<{ client: Client }>('/api/clients', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      toast.success('Client added', { description: `${client.name} · ${client.code}` })
      onCreated(client)
      onOpenChange(false)
    } catch (err) {
      toast.error('Failed to add client', { description: (err as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" /> Add new client
          </DialogTitle>
          <DialogDescription>
            Register a new client under a tenant. Required fields are marked with *.
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
              <Label className="text-xs">Client name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corp"
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Code *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. ACME"
                maxLength={12}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Client type *</Label>
              <Select value={clientTypeId} onValueChange={setClientTypeId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {clientTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Contract value (₹)</Label>
            <Input
              type="number"
              min="0"
              step="1000"
              value={contractValue}
              onChange={(e) => setContractValue(e.target.value)}
              placeholder="Optional — annual contract value"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Contact name</Label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Contact email</Label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Saving…' : 'Add client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
