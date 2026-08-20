'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import {
  Plus, ShieldAlert, Loader2, Building2, Wallet, Percent, Hash, Search,
  Paperclip, Image as ImageIcon, FileText, Download, CheckCircle2, X, FileCheck
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
import { LoadingState, EmptyState, ErrorState, PageHeader } from './shared'

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
  documentUrl?: string | null
  documentName?: string | null
  company: { id: string; name: string }
  category: { id: string; name: string; type: ExpenseType }
}

type CompanyListItem = { id: string; name: string; code: string; type: string }

export function ExpensesModule() {
  const { user } = useApp()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<{ name: string; url: string; category?: string; fileType?: string } | null>(null)

  // Page-scoped Local Filters
  const [pageFrom, setPageFrom] = useState('2024-04-01')
  const [pageTo, setPageTo] = useState('2024-09-30')

  const isGroupAdmin = user?.role === 'GROUP_ADMIN'
  const isViewOnly = user?.role === 'STANDARD_USER'

  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (categoryFilter !== 'all') params.set('categoryId', categoryFilter)
    if (pageFrom) params.set('from', pageFrom)
    if (pageTo) params.set('to', pageTo)
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
  }, [pageFrom, pageTo, categoryFilter])

  useEffect(() => {
    let active = true
    fetchJson<{ categories: Category[] }>('/api/expense-categories')
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
  }, [])

  const summary = useMemo(() => {
    let total = 0
    const byType = { OPERATIONAL: 0, ADMINISTRATIVE: 0, CAPITAL: 0 }
    for (const e of expenses) {
      const amt = Number(e.amount) || 0
      total += amt
      const t = e.category?.type || 'OPERATIONAL'
      if (t in byType) byType[t as ExpenseType] += amt
    }
    return { total, count: expenses.length, byType }
  }, [expenses])

  const filteredExpenses = expenses.filter((e) =>
    (e.description && e.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (e.category?.name && e.category.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational & Overhead Expenses"
        subtitle="Logistics overhead, facilities rent, technology licenses, and supporting receipt document management"
        action={
          isViewOnly ? (
            <Badge variant="outline" className="gap-1.5 text-slate-500 border-slate-200">
              <ShieldAlert className="h-3.5 w-3.5" /> View-only access
            </Badge>
          ) : (
            <Button onClick={() => setAddOpen(true)} size="sm" className="bg-[#0B2148] hover:bg-[#102B63] text-white font-semibold text-xs gap-1.5 rounded-lg shadow-sm">
              <Plus className="h-4 w-4 text-[#08B6D8]" /> + Add Operational Expense
            </Button>
          )
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Operational Cost</div>
                <div className="text-2xl font-extrabold text-rose-600 mt-1">{formatINR(summary.total, true)}</div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl">
          <CardContent className="p-5">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Cost Allocation By Type</div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between font-medium">
                <span className="text-slate-600">Operational:</span>
                <span className="font-bold text-[#0B2148]">{formatINR(summary.byType.OPERATIONAL, true)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-600">Administrative:</span>
                <span className="font-bold text-[#0B2148]">{formatINR(summary.byType.ADMINISTRATIVE, true)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-600">Capital:</span>
                <span className="font-bold text-[#0B2148]">{formatINR(summary.byType.CAPITAL, true)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Expense Record Count</div>
                <div className="text-2xl font-extrabold text-[#0B2148] mt-1">{summary.count} Entries</div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-slate-100 text-[#0B2148] flex items-center justify-center font-bold">
                <Hash className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search description or category..."
              className="pl-8 h-9 text-xs border-slate-200 rounded-lg focus:border-[#08B6D8]"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 w-48 text-xs rounded-lg border-slate-200">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500 text-[11px]">From:</span>
            <Input
              type="date"
              value={pageFrom}
              onChange={(e) => setPageFrom(e.target.value)}
              className="h-8 text-xs w-32 rounded-lg border-slate-200"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500 text-[11px]">To:</span>
            <Input
              type="date"
              value={pageTo}
              onChange={(e) => setPageTo(e.target.value)}
              className="h-8 text-xs w-32 rounded-lg border-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingState label="Fetching expense records…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : filteredExpenses.length === 0 ? (
        <EmptyState
          title="No expenses found"
          desc="Adjust filters or log a new operational expense."
          icon={<Wallet className="h-8 w-8 text-slate-400" />}
        />
      ) : (
        <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Expense Date</th>
                    <th className="py-3 px-4">Category Name</th>
                    {isGroupAdmin && <th className="py-3 px-4">Company Scope</th>}
                    <th className="py-3 px-4">Expense Notes</th>
                    <th className="py-3 px-4 text-center">Supporting Document</th>
                    <th className="py-3 px-4 text-right">Amount Billed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.map((e) => (
                    <tr key={e.id} className="hover:bg-[#E8F8FC]/40 transition">
                      <td className="py-3 px-4 font-semibold text-slate-600">{formatDate(e.date)}</td>
                      <td className="py-3 px-4 font-bold text-[#0B2148]">
                        <Badge className="bg-slate-100 text-slate-800 text-[10px] font-bold">
                          {e.category?.name}
                        </Badge>
                      </td>
                      {isGroupAdmin && (
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-[#08B6D8]" />
                            {e.company?.name}
                          </div>
                        </td>
                      )}
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{e.description || '—'}</td>
                      
                      {/* Supporting Document / Receipt Column */}
                      <td className="py-3 px-4 text-center">
                        {e.documentUrl ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/expenses/${e.id}/download`)
                                const data = await response.json()

                                if (!response.ok) {
                                  throw new Error(data.error || 'Failed to load receipt')
                                }

                                setPreviewDoc({
                                  name: e.documentName || `${e.category?.name || 'Expense'} Receipt`,
                                  url: data.url,
                                  category: e.category?.name,
                                  fileType: data.fileType,
                                })
                              } catch (err: any) {
                                toast.error(err.message || 'Failed to load receipt')
                              }
                            }}
                            className="h-7 text-[11px] border-[#08B6D8]/40 bg-[#E8F8FC]/50 hover:bg-[#08B6D8]/20 text-[#0B2148] font-semibold gap-1.5 rounded-lg"
                          >
                            <ImageIcon className="h-3.5 w-3.5 text-[#08B6D8]" /> View Receipt
                          </Button>
                        ) : (
                          <span className="text-[11px] text-slate-300 italic">No Receipt</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-rose-600 text-sm">{formatINR(Number(e.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Expense Modal */}
      <AddExpenseDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        isGroupAdmin={isGroupAdmin}
        activeCompanyId={user?.companyId ?? null}
        onCreated={(exp) => setExpenses([exp, ...expenses])}
      />

      {/* View Supporting Document / Receipt Image Modal */}
      {previewDoc && (
        <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
          <DialogContent className="sm:max-w-3xl p-6 rounded-2xl flex flex-col">
            <DialogHeader className="border-b border-slate-100 pb-3">
              <DialogTitle className="text-base font-bold text-[#0B2148] flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-[#08B6D8]" /> Supporting Expense Receipt — {previewDoc.category || 'Expense Log'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {previewDoc.name}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-auto py-4 flex items-center justify-center bg-slate-900 rounded-xl my-2 p-4 min-h-[300px]">
              {previewDoc.fileType?.startsWith('image/') ? (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.name}
                  className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-2xl"
                />
              ) : previewDoc.fileType === 'application/pdf' ? (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.name}
                  className="w-full h-[60vh] rounded-lg border-0 bg-white"
                />
              ) : (
                <div className="text-center text-white space-y-3">
                  <FileText className="h-16 w-16 mx-auto text-[#08B6D8]" />
                  <p className="text-sm font-semibold">
                    Supporting Document Attached
                  </p>
                  <a
                    href={previewDoc.url}
                    download={previewDoc.name}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#08B6D8] text-[#081B3A] rounded-xl font-bold text-xs"
                  >
                    <Download className="h-4 w-4" /> Download Document
                  </a>
                </div>
              )}
            </div>

            <DialogFooter className="border-t border-slate-100 pt-3 flex items-center justify-between">
              <a
                href={previewDoc.url}
                download={previewDoc.name}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#0B2148] text-white rounded-xl text-xs font-semibold hover:bg-[#102B63] transition"
              >
                <Download className="h-4 w-4 text-[#08B6D8]" /> Download Receipt Image
              </a>
              <Button variant="outline" onClick={() => setPreviewDoc(null)} className="h-8 text-xs">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

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
  const [customCategoryName, setCustomCategoryName] = useState('')
  const [customCategoryType, setCustomCategoryType] = useState<'OPERATIONAL' | 'ADMINISTRATIVE' | 'CAPITAL'>('OPERATIONAL')
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  
  // Supporting Document / Receipt Upload States
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [documentName, setDocumentName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [submitting, setSubmitting] = useState(false)

  const effectiveCompanyId = isGroupAdmin ? companyId : activeCompanyId

  useEffect(() => {
    if (!open || !isGroupAdmin) return
    ;(async () => {
      try {
        const { companies: list } = await fetchJson<{ companies: CompanyListItem[] }>('/api/companies')
        setCompanies(list.filter((c) => c.type !== 'PARENT'))
        if (!companyId && activeCompanyId) setCompanyId(activeCompanyId)
      } catch {}
    })()
  }, [open, isGroupAdmin])

  useEffect(() => {
    if (!open) return
    ;(async () => {
      try {
        const params = new URLSearchParams()
        if (effectiveCompanyId) params.set('companyId', effectiveCompanyId)
        const { categories: list } = await fetchJson<{ categories: Category[] }>(`/api/expense-categories?${params.toString()}`)
        setCategories(list)
      } catch {
        setCategories([])
      }
    })()
  }, [open, effectiveCompanyId])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]

    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF and image files are allowed')
      e.target.value = ''
      return
    }

    setDocumentFile(file)
    setDocumentName(file.name)

    toast.success(`Supporting document "${file.name}" attached!`)
  }

  const removeFile = () => {
    setDocumentFile(null)
    setDocumentName(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!categoryId || !date || Number(amount) <= 0) return
    setSubmitting(true)
    try {
      let finalCategoryId = categoryId

      // If user selected "+ Other (Add Custom Category)", auto-persist the new category to DB first!
      if (categoryId === 'OTHER_CUSTOM') {
        if (!customCategoryName.trim()) {
          toast.error('Please enter a name for the custom category')
          setSubmitting(false)
          return
        }
        const { category: createdCat } = await fetchJson<{ category: Category }>('/api/expense-categories', {
          method: 'POST',
          body: JSON.stringify({
            name: customCategoryName.trim(),
            type: customCategoryType,
            companyId: effectiveCompanyId,
          }),
        })
        finalCategoryId = createdCat.id
        setCategories((prev) => [...prev, createdCat])
        toast.success(`Custom category "${createdCat.name}" added to database!`)
      }

      const formData = new FormData()

      formData.append('categoryId', finalCategoryId)
      formData.append('date', date)
      formData.append('amount', String(Number(amount)))

      if (description.trim()) {
        formData.append('description', description.trim())
      }

      if (isGroupAdmin && companyId) {
        formData.append('companyId', companyId)
      }

      if (documentFile) {
        formData.append('file', documentFile)
      }

      const { expense } = await fetchJson<{ expense: Expense }>(
        '/api/expenses',
        {
          method: 'POST',
          body: formData,
        }
      )
      toast.success('Expense recorded!')
      onCreated(expense)
      onOpenChange(false)
      // Reset custom field states
      setCategoryId('')
      setCustomCategoryName('')
      setAmount('')
      setDescription('')
      setDocumentFile(null)
      setDocumentName(null)
    } catch (err: any) {
      toast.error(err.message || 'Failed to record expense')
    } finally {
      setSubmitting(false)
    }
  }

  const uniqueCategories = useMemo(() => {
    const seen = new Set<string>()
    return categories.filter((c) => {
      const key = c.name.trim().toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [categories])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#0B2148] flex items-center gap-2">
            <Wallet className="h-5 w-5 text-[#08B6D8]" /> Record Operational Expense
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">Log overhead, labor support, or administrative costs with optional receipt upload.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {isGroupAdmin && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Tenant Scope *</Label>
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

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Category *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {uniqueCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
                <SelectItem value="OTHER_CUSTOM" className="font-bold text-[#08B6D8] border-t border-slate-100">
                  + Other (Add Custom Category)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Inline Custom Category Creator */}
          {categoryId === 'OTHER_CUSTOM' && (
            <div className="space-y-2.5 p-3 bg-[#E8F8FC]/50 border border-[#08B6D8]/30 rounded-xl">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#0B2148]">Custom Category Name *</Label>
                <Input
                  value={customCategoryName}
                  onChange={(e) => setCustomCategoryName(e.target.value)}
                  placeholder="e.g. Legal & Professional Fees"
                  className="h-8 text-xs bg-white"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#0B2148]">Expense Type Classification *</Label>
                <Select value={customCategoryType} onValueChange={(v: any) => setCustomCategoryType(v)}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPERATIONAL">Operational Expense</SelectItem>
                    <SelectItem value="ADMINISTRATIVE">Administrative Expense</SelectItem>
                    <SelectItem value="CAPITAL">Capital Expenditure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-xs" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Amount (INR) *</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="h-9 text-xs" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Expense note or invoice reference..." className="text-xs" rows={2} />
          </div>

          {/* Supporting Receipt Document Upload Field */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-[#08B6D8]" /> Supporting Document / Receipt Image (Optional)
              </span>
              {documentName && (
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Receipt Attached
                </span>
              )}
            </Label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            {!documentFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-slate-300 hover:border-[#08B6D8] bg-slate-50 hover:bg-[#E8F8FC]/30 rounded-xl p-3 text-center cursor-pointer transition flex items-center justify-center gap-2 text-slate-500 text-xs"
              >
                <ImageIcon className="h-4 w-4 text-[#08B6D8]" />
                <span>Click to upload receipt image or bills scan</span>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-[#E8F8FC]/60 border border-[#08B6D8]/30 rounded-xl p-2.5 px-3">
                <div className="flex items-center gap-2 text-xs truncate max-w-[80%]">
                  {documentFile.type.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(documentFile)}
                      alt="Thumbnail"
                      className="h-7 w-7 rounded object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <FileCheck className="h-4 w-4 text-[#08B6D8] shrink-0" />
                  )}
                  <span className="font-semibold text-[#0B2148] truncate">{documentName}</span>
                </div>

                <button
                  type="button"
                  onClick={removeFile}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                  title="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-[#0B2148] hover:bg-[#102B63] text-white font-semibold">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log Expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
