'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  IndianRupee, Plus, Receipt, ShieldAlert, Loader2, Building2, Hash, CalendarDays,
} from 'lucide-react'
import { toast } from 'sonner'

import { useApp, fetchJson } from '@/lib/app-store'
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

type Revenue = {
  id: string
  clientId: string
  date: string
  invoiceNo: string
  description: string | null
  quantity: number
  rate: number
  amount: number
  createdAt: string
  client: {
    id: string
    name: string
    code: string
    company: { id: string; name: string } | null
  }
}

type ClientOption = {
  id: string
  name: string
  code: string
  company?: { id: string; name: string; code: string } | null
}

// ---- Component -------------------------------------------------------------

export function RevenueModule() {
  const { user, filterCompanyId, filterFrom, filterTo } = useApp()

  const [revenues, setRevenues] = useState<Revenue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const isGroupAdmin = user?.role === 'GROUP_ADMIN'
  const isViewOnly = user?.role === 'STANDARD_USER'

  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (filterCompanyId) params.set('companyId', filterCompanyId)
    if (filterFrom) params.set('from', filterFrom)
    if (filterTo) params.set('to', filterTo)
    fetchJson<{ revenues: Revenue[] }>(`/api/revenue?${params.toString()}`)
      .then((d) => {
        if (!active) return
        setRevenues(d.revenues)
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
  }, [filterCompanyId, filterFrom, filterTo])

  // Summary totals (the API already sorts by date desc).
  const totals = useMemo(() => {
    let sum = 0
    for (const r of revenues) sum += Number(r.amount) || 0
    return { count: revenues.length, sum }
  }, [revenues])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Revenue"
        subtitle="Invoices & revenue entries within the selected period"
        action={
          isViewOnly ? (
            <Badge variant="outline" className="gap-1.5 text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" /> View-only access
            </Badge>
          ) : (
            <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Revenue
            </Button>
          )
        }
      />

      {/* Totals summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Entries</div>
                <div className="text-2xl font-bold mt-0.5">{totals.count}</div>
              </div>
              <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-200 flex items-center justify-center">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total amount</div>
                <div className="text-2xl font-bold mt-0.5 text-emerald-700">{formatINR(totals.sum, true)}</div>
              </div>
              <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 flex items-center justify-center">
                <IndianRupee className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Period</div>
                <div className="text-sm font-semibold mt-0.5">
                  {formatDate(filterFrom)} — {formatDate(filterTo)}
                </div>
              </div>
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 flex items-center justify-center">
                <CalendarDays className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      {loading ? (
        <LoadingState label="Loading revenue entries…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : revenues.length === 0 ? (
        <EmptyState
          title="No revenue entries"
          desc="Try widening the date range, pick a different company filter, or add a new invoice."
          icon={<Receipt className="h-8 w-8 text-muted-foreground/60" />}
        />
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto scroll-thin max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="pl-4">Date</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right pr-4">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenues.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/40">
                      <TableCell className="pl-4 text-sm whitespace-nowrap">
                        {formatDate(r.date)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono">
                          <Hash className="h-3 w-3 text-muted-foreground" />
                          {r.invoiceNo}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="leading-tight">
                          <div className="text-sm font-medium">{r.client.name}</div>
                          {isGroupAdmin && r.client.company && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                              <Building2 className="h-2.5 w-2.5" />
                              {r.client.company.name}
                            </div>
                          )}
                          <div className="text-[10px] text-muted-foreground">{r.client.code}</div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <span className="text-sm text-muted-foreground line-clamp-2">
                          {r.description || <span className="italic">—</span>}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{r.quantity}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {formatINR(Number(r.rate))}
                      </TableCell>
                      <TableCell className="text-right pr-4 font-semibold tabular-nums text-emerald-700">
                        {formatINR(Number(r.amount))}
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
      <AddRevenueDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        isGroupAdmin={isGroupAdmin}
        activeCompanyId={filterCompanyId ?? user?.companyId ?? null}
        onCreated={(rev) => {
          // Insert at top — API sorts by date desc — so place by date comparison.
          setRevenues((prev) => {
            const next = [...prev, rev]
            next.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            return next
          })
        }}
      />
    </div>
  )
}

// ---- Add Revenue Dialog ----------------------------------------------------

function AddRevenueDialog({
  open,
  onOpenChange,
  isGroupAdmin,
  activeCompanyId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  isGroupAdmin: boolean
  activeCompanyId: string | null
  onCreated: (r: Revenue) => void
}) {
  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientId, setClientId] = useState('')
  const [date, setDate] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [rate, setRate] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Computed: client list filtered by the currently active company.
  // For GROUP_ADMIN with no company picked, show all accessible clients (backend already restricts).
  const clientList = useMemo<ClientOption[]>(() => {
    if (isGroupAdmin && activeCompanyId) {
      return clients.filter((c) => c.company?.id === activeCompanyId)
    }
    return clients
  }, [clients, isGroupAdmin, activeCompanyId])

  // Load clients each time the dialog opens.
  useEffect(() => {
    if (!open) return
    ;(async () => {
      try {
        const params = new URLSearchParams()
        if (activeCompanyId) params.set('companyId', activeCompanyId)
        params.set('status', 'ACTIVE')
        const { clients: list } = await fetchJson<{ clients: ClientOption[] }>(
          `/api/clients?${params.toString()}`,
        )
        setClients(list)
      } catch {
        setClients([])
      }
    })()
  }, [open, activeCompanyId])

  // Reset form on close.
  useEffect(() => {
    if (open) return
    setClientId('')
    setDate('')
    setInvoiceNo('')
    setDescription('')
    setQuantity('1')
    setRate('')
    setAmount('')
  }, [open])

  // Default date to today when opening.
  useEffect(() => {
    if (open && !date) {
      const d = new Date()
      const iso = d.toISOString().slice(0, 10)
      setDate(iso)
    }
  }, [open, date])

  // Live preview of computed amount (rate × qty) when amount is blank.
  const computedAmount = useMemo(() => {
    if (amount) return Number(amount)
    const r = Number(rate)
    const q = Number(quantity)
    if (Number.isFinite(r) && Number.isFinite(q)) return r * q
    return 0
  }, [amount, rate, quantity])

  const canSubmit =
    clientId && date && invoiceNo.trim() && Number(rate) > 0 && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        clientId,
        date,
        invoiceNo: invoiceNo.trim(),
        description: description.trim() || undefined,
        quantity: quantity ? Number(quantity) : undefined,
        rate: Number(rate),
        amount: amount ? Number(amount) : undefined,
      }
      const { revenue } = await fetchJson<{ revenue: Revenue }>('/api/revenue', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      toast.success('Revenue entry added', {
        description: `${revenue.invoiceNo} · ${formatINR(Number(revenue.amount))}`,
      })
      onCreated(revenue)
      onOpenChange(false)
    } catch (err) {
      toast.error('Failed to add revenue', { description: (err as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> Add revenue entry
          </DialogTitle>
          <DialogDescription>
            Record an invoice against a client. Amount defaults to rate × quantity.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label className="text-xs">Client *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clientList.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    No active clients available
                  </SelectItem>
                ) : (
                  clientList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.code}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Invoice # *</Label>
              <Input
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="e.g. INV-2024-001"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short note about the invoice (optional)"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Quantity</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Rate (₹) *</Label>
              <Input
                type="number"
                min="0"
                step="100"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Amount (₹)</Label>
              <Input
                type="number"
                min="0"
                step="100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={computedAmount ? String(computedAmount) : 'auto'}
              />
            </div>
          </div>

          <div className="rounded-md border bg-muted/40 px-3 py-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Computed amount</span>
            <span className="font-semibold tabular-nums">{formatINR(computedAmount)}</span>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Saving…' : 'Add entry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
