'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Plus, ShieldAlert, Loader2, Building2, Wallet, Percent, Hash,
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

type ExpenseType = 'OPERATIONAL' | 'ADMINISTRATIVE' | 'CAPITAL'

type Category = {
  id: string
  companyId: string
  name: string
  type: ExpenseType
}

type Expense = {
  id: string
  companyId: string
  categoryId: string
  date: string
  amount: number
  description: string | null
  company: { id: string; name: string }
  category: { id: string; name: string; type: ExpenseType }
}

type CompanyListItem = { id: string; name: string; code: string; type: string }

const TYPE_BADGE_CLASSES: Record<ExpenseType, string> = {
  OPERATIONAL: 'bg-blue-50 text-blue-700 border-blue-200',
  ADMINISTRATIVE: 'bg-amber-50 text-amber-700 border-amber-200',
  CAPITAL: 'bg-violet-50 text-violet-700 border-violet-200',
}

const TYPE_DOT_CLASSES: Record<ExpenseType, string> = {
  OPERATIONAL: 'bg-blue-500',
  ADMINISTRATIVE: 'bg-amber-500',
  CAPITAL: 'bg-violet-500',
}

const TYPE_ORDER: ExpenseType[] = ['OPERATIONAL', 'ADMINISTRATIVE', 'CAPITAL']

// ---- Component -------------------------------------------------------------

export function ExpensesModule() {
  const { user, filterCompanyId, filterFrom, filterTo } = useApp()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [addOpen, setAddOpen] = useState(false)

  const isGroupAdmin = user?.role === 'GROUP_ADMIN'
  const isViewOnly = user?.role === 'STANDARD_USER'

  // Reload expenses when filters change.
  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (filterCompanyId) params.set('companyId', filterCompanyId)
    if (categoryFilter !== 'all') params.set('categoryId', categoryFilter)
    if (filterFrom) params.set('from', filterFrom)
    if (filterTo) params.set('to', filterTo)
    fetchJson<{ expenses: Expense[] }>(`/api/expenses?${params.toString()}`)
      .then((d) => {
        if (!active) return
        setExpenses(d.expenses)
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
  }, [filterCompanyId, filterFrom, filterTo, categoryFilter])

  // Load expense categories (for the filter row).
  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (filterCompanyId) params.set('companyId', filterCompanyId)
    fetchJson<{ categories: Category[] }>(`/api/expense-categories?${params.toString()}`)
      .then((d) => {
        if (!active) return
        setCategories(d.categories)
      })
      .catch(() => {
        if (active) setCategories([])
      })
    return () => {
      active = false
    }
  }, [filterCompanyId])

  // Summary totals.
  const summary = useMemo(() => {
    let total = 0
    const byType: Record<ExpenseType, number> = {
      OPERATIONAL: 0,
      ADMINISTRATIVE: 0,
      CAPITAL: 0,
    }
    for (const e of expenses) {
      const amt = Number(e.amount) || 0
      total += amt
      const t = e.category?.type
      if (t) byType[t] += amt
    }
    return { total, count: expenses.length, byType }
  }, [expenses])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Expenses"
        subtitle="Operational, administrative & capital expenses"
        action={
          isViewOnly ? (
            <Badge variant="outline" className="gap-1.5 text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" /> View-only access
            </Badge>
          ) : (
            <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Expense
            </Button>
          )
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Expenses</div>
                <div className="text-2xl font-bold mt-0.5 tabular-nums">{formatINR(summary.total, true)}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {formatDate(filterFrom)} — {formatDate(filterTo)}
                </div>
              </div>
              <div className="h-9 w-9 rounded-lg bg-rose-50 text-rose-700 ring-1 ring-rose-200 flex items-center justify-center shrink-0">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">By Type</div>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              {TYPE_ORDER.map((t) => (
                <div key={t} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${TYPE_DOT_CLASSES[t]}`} />
                    <span className="capitalize text-muted-foreground">{t.toLowerCase()}</span>
                  </div>
                  <span className="font-medium tabular-nums">{formatINR(summary.byType[t], true)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Entry Count</div>
                <div className="text-2xl font-bold mt-0.5 tabular-nums">{summary.count}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {summary.count === 1 ? 'entry' : 'entries'} recorded
                </div>
              </div>
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                <Hash className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Category</span>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[240px] h-8">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} · {c.type.toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground">
          {expenses.length} {expenses.length === 1 ? 'entry' : 'entries'}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingState label="Loading expenses…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : expenses.length === 0 ? (
        <EmptyState
          title="No expenses found"
          desc="Adjust the filters above or add a new expense to get started."
          icon={<Wallet className="h-8 w-8 text-muted-foreground/60" />}
        />
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto scroll-thin max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="pl-4">Date</TableHead>
                    <TableHead>Category</TableHead>
                    {isGroupAdmin && <TableHead>Company</TableHead>}
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right pr-4">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((e) => {
                    const t = e.category?.type
                    return (
                      <TableRow key={e.id} className="hover:bg-muted/40">
                        <TableCell className="pl-4 text-sm whitespace-nowrap">
                          {formatDate(e.date)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {t && (
                              <Badge variant="outline" className={TYPE_BADGE_CLASSES[t]}>
                                {e.category?.name}
                              </Badge>
                            )}
                            {t && (
                              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {t.toLowerCase()}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        {isGroupAdmin && (
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm">{e.company?.name}</span>
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="max-w-xs">
                          <span className="text-sm text-muted-foreground line-clamp-2">
                            {e.description || <span className="italic">—</span>}
                          </span>
                        </TableCell>
                        <TableCell className="text-right pr-4 font-semibold tabular-nums">
                          {formatINR(Number(e.amount))}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add dialog */}
      <AddExpenseDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        isGroupAdmin={isGroupAdmin}
        activeCompanyId={filterCompanyId ?? user?.companyId ?? null}
        onCreated={(exp) => {
          setExpenses((prev) => {
            const next = [...prev, exp]
            next.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            return next
          })
        }}
      />
    </div>
  )
}

// ---- Add Expense Dialog ----------------------------------------------------

function AddExpenseDialog({
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
  onCreated: (e: Expense) => void
}) {
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [companyId, setCompanyId] = useState<string>(activeCompanyId ?? '')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Effective companyId used to fetch categories: GROUP_ADMIN picks from select;
  // tenant users fall back to their own company.
  const effectiveCompanyId = isGroupAdmin ? companyId : activeCompanyId

  // Load companies once when GROUP_ADMIN opens the dialog.
  useEffect(() => {
    if (!open || !isGroupAdmin) return
    ;(async () => {
      try {
        const { companies: list } = await fetchJson<{ companies: CompanyListItem[] }>(
          '/api/companies',
        )
        setCompanies(list.filter((c) => c.type !== 'PARENT'))
        if (!companyId && activeCompanyId) setCompanyId(activeCompanyId)
      } catch {
        setCompanies([])
      }
    })()
  }, [open, isGroupAdmin])

  // Load categories whenever the effective company changes.
  useEffect(() => {
    if (!open) return
    ;(async () => {
      try {
        const params = new URLSearchParams()
        if (effectiveCompanyId) params.set('companyId', effectiveCompanyId)
        const { categories: list } = await fetchJson<{ categories: Category[] }>(
          `/api/expense-categories?${params.toString()}`,
        )
        setCategories(list)
      } catch {
        setCategories([])
      }
    })()
  }, [open, effectiveCompanyId])

  // Reset form fields when the dialog closes.
  useEffect(() => {
    if (open) return
    setCategoryId('')
    setDate('')
    setAmount('')
    setDescription('')
  }, [open])

  // Default date to today when opening.
  useEffect(() => {
    if (open && !date) {
      const iso = new Date().toISOString().slice(0, 10)
      setDate(iso)
    }
  }, [open, date])

  const canSubmit =
    (!isGroupAdmin || companyId) &&
    categoryId &&
    date &&
    Number(amount) > 0 &&
    !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        categoryId,
        date,
        amount: Number(amount),
        description: description.trim() || undefined,
      }
      if (isGroupAdmin) body.companyId = companyId
      const { expense } = await fetchJson<{ expense: Expense }>('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      toast.success('Expense added', {
        description: `${expense.category?.name} · ${formatINR(Number(expense.amount))}`,
      })
      onCreated(expense)
      onOpenChange(false)
    } catch (err) {
      toast.error('Failed to add expense', { description: (err as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> Add expense
          </DialogTitle>
          <DialogDescription>
            Record a new expense entry. Required fields are marked with *.
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
                  {companies.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No tenants available
                    </SelectItem>
                  ) : (
                    companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} · {c.code}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label className="text-xs">Category *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    {isGroupAdmin && !companyId ? 'Select a company first' : 'No categories available'}
                  </SelectItem>
                ) : (
                  categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.type.toLowerCase()}
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
              <Label className="text-xs">Amount (₹) *</Label>
              <Input
                type="number"
                min="0"
                step="100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                autoFocus
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional note about the expense"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Saving…' : 'Add expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
