'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import {
  IndianRupee, Plus, Receipt, ShieldAlert, Loader2, Building2, Hash, CalendarDays, Search, Sparkles,
  Paperclip, FileText, Image as ImageIcon, Eye, Download, CheckCircle2, X, FileCheck, Printer,
  ArrowLeft, ChevronRight, Users, Layers, CreditCard, RotateCcw, History, AlertCircle, Trash2
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

type Revenue = {
  id: string
  clientId: string
  date: string
  dueDate?: string | null
  invoiceNo: string
  description: string | null
  quantity: number
  rate: number
  amount: number
  items?: string | null
  subtotal?: number | null
  taxAmount?: number | null
  status?: string | null
  documentUrl?: string | null
  documentName?: string | null
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

type PaymentRecord = {
  id: string
  paymentDate: string
  amount: number
  paymentMethod: string
  referenceNumber?: string | null
  notes?: string | null
  status: string
}

type LineItem = {
  id: string
  name: string
  quantity: number
  rate: number
  amount: number
}

export function RevenueModule() {
  const { user } = useApp()
  const [revenues, setRevenues] = useState<Revenue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<{ name: string; url: string; invoiceNo: string } | null>(null)
  const [viewInvoice, setViewInvoice] = useState<Revenue | null>(null)

  // Payment Recording State
  const [payInvoice, setPayInvoice] = useState<Revenue | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('BANK_TRANSFER')
  const [payRef, setPayRef] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [submittingPay, setSubmittingPay] = useState(false)

  // Payment History State
  const [historyInvoice, setHistoryInvoice] = useState<Revenue | null>(null)
  const [historyPayments, setHistoryPayments] = useState<PaymentRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Two-tier View States: 'clients' (Summary View per Client) | 'invoices' (Flat Invoice List)
  const [viewMode, setViewMode] = useState<'clients' | 'invoices'>('clients')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  // Page-scoped Local Filters
  const [pageFrom, setPageFrom] = useState('')
  const [pageTo, setPageTo] = useState('')
  const isViewOnly = user?.role === 'STANDARD_USER'
  const loadRevenues = () => {
    setLoading(true)

    const params = new URLSearchParams()

    if (pageFrom) params.set('from', pageFrom)
    if (pageTo) params.set('to', pageTo)

    fetchJson<{ revenues: Revenue[] }>(
      `/api/revenue?${params.toString()}`
    )
      .then((d) => {
        setRevenues(d.revenues)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    let active = true

    const load = async () => {
      const params = new URLSearchParams()

      if (pageFrom) params.set('from', pageFrom)
      if (pageTo) params.set('to', pageTo)

      try {
        const data = await fetchJson<{ revenues: Revenue[] }>(
          `/api/revenue?${params.toString()}`
        )

        if (!active) return

        setRevenues(data.revenues)
        setError(null)
      } catch (e: any) {
        if (!active) return

        setError(e.message)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [pageFrom, pageTo])

  // Aggregate Client-wise Summaries
  const clientSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        clientId: string
        clientName: string
        clientCode: string
        companyName: string
        invoiceCount: number
        totalBilledAmount: number
        lastBilledDate: string
        invoices: Revenue[]
      }
    >()

    revenues.forEach((r) => {
      const cId = r.clientId
      const existing = map.get(cId)
      if (existing) {
        existing.invoiceCount += 1
        existing.totalBilledAmount += Number(r.amount)
        existing.invoices.push(r)
        if (new Date(r.date) > new Date(existing.lastBilledDate)) {
          existing.lastBilledDate = r.date
        }
      } else {
        map.set(cId, {
          clientId: cId,
          clientName: r.client?.name ?? 'Unknown Client',
          clientCode: r.client?.code ?? '—',
          companyName: r.client?.company?.name ?? 'Parent Company',
          invoiceCount: 1,
          totalBilledAmount: Number(r.amount),
          lastBilledDate: r.date,
          invoices: [r],
        })
      }
    })

    return Array.from(map.values()).sort((a, b) => b.totalBilledAmount - a.totalBilledAmount)
  }, [revenues])

  // Overall Financial Totals
  const totals = useMemo(() => {
    const sum = revenues.reduce((acc, r) => acc + Number(r.amount), 0)
    return { count: revenues.length, sum }
  }, [revenues])

  // Filtered Client Summaries
  const filteredClientSummaries = useMemo(() => {
    if (!searchQuery.trim()) return clientSummaries
    const q = searchQuery.toLowerCase().trim()
    return clientSummaries.filter(
      (cs) =>
        cs.clientName.toLowerCase().includes(q) ||
        cs.clientCode.toLowerCase().includes(q) ||
        cs.companyName.toLowerCase().includes(q)
    )
  }, [clientSummaries, searchQuery])

  // Filtered Invoices (Flat or Client-specific)
  const filteredInvoices = useMemo(() => {
    let list = revenues
    if (selectedClientId) {
      list = list.filter((r) => r.clientId === selectedClientId)
    }
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase().trim()
    return list.filter(
      (r) =>
        r.invoiceNo.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.client?.name && r.client.name.toLowerCase().includes(q)) ||
        (r.client?.code && r.client.code.toLowerCase().includes(q))
    )
  }, [revenues, selectedClientId, searchQuery])

  const activeClientSummary = useMemo(() => {
    if (!selectedClientId) return null
    return clientSummaries.find((cs) => cs.clientId === selectedClientId) || null
  }, [clientSummaries, selectedClientId])

  // Record Payment Submit Handler
  async function handleRecordPayment() {
    if (!payInvoice || !payAmount || Number(payAmount) <= 0) {
      toast.error('Please enter a valid payment amount')
      return
    }

    setSubmittingPay(true)
    try {
      await fetchJson('/api/payments/customer', {
        method: 'POST',
        body: JSON.stringify({
          companyId: payInvoice.client?.company?.id,
          revenueId: payInvoice.id,
          paymentDate: new Date().toISOString(),
          amount: Number(payAmount),
          paymentMethod: payMethod,
          referenceNumber: payRef,
          notes: payNotes,
        }),
      })

      toast.success(`Payment of ${formatINR(Number(payAmount))} recorded for Invoice #${payInvoice.invoiceNo}`)
      setPayInvoice(null)
      setPayAmount('')
      setPayRef('')
      setPayNotes('')
      loadRevenues()
    } catch (e: any) {
      toast.error(e.message || 'Failed to record payment')
    } finally {
      setSubmittingPay(false)
    }
  }

  // Load Payment History
  async function openPaymentHistory(rev: Revenue) {
    setHistoryInvoice(rev)
    setLoadingHistory(true)
    try {
      const data = await fetchJson<{ payments: PaymentRecord[] }>(`/api/payments/customer?revenueId=${rev.id}`)
      setHistoryPayments(data.payments || [])
    } catch (e) {
      toast.error('Failed to load payment history')
    } finally {
      setLoadingHistory(false)
    }
  }

  // Reverse Payment Handler
  async function handleReversePayment(paymentId: string) {
    if (!confirm('Are you sure you want to reverse/void this payment?')) return
    try {
      await fetchJson(`/api/payments/customer/${paymentId}/reverse`, { method: 'POST' })
      toast.success('Payment successfully reversed')
      if (historyInvoice) openPaymentHistory(historyInvoice)
      loadRevenues()
    } catch (e: any) {
      toast.error(e.message || 'Failed to reverse payment')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue & Customer Invoicing Engine"
        subtitle="Manage client contracts, itemized GST billing, customer payment collection & AR tracking"
        action={
          !isViewOnly && (
            <Button
              onClick={() => setAddOpen(true)}
              size="sm"
              className="h-9 bg-[#0B2148] hover:bg-[#102B63] text-white text-xs font-semibold rounded-xl gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4 text-[#08B6D8]" /> Add New Invoice
            </Button>
          )
        }
      />

      {/* Drilldown Back Header (When inspecting a single client account) */}
      {selectedClientId && activeClientSummary && (
        <div className="bg-[#0B2148] text-white p-4 rounded-2xl shadow-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedClientId(null)}
              className="h-8 border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg gap-1.5"
            >
              <ArrowLeft className="h-4 w-4 text-[#08B6D8]" /> Back to All Clients
            </Button>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#16C4E8]">Client Billed Summary</div>
              <div className="text-lg font-extrabold flex items-center gap-2">
                <span>{activeClientSummary.clientName}</span>
                <Badge className="bg-[#08B6D8] text-[#0B2148] text-xs font-mono font-bold">
                  {activeClientSummary.clientCode}
                </Badge>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-slate-300 font-bold uppercase">Total Billed till Date</div>
            <div className="text-xl font-black text-[#16C4E8] font-mono">
              {formatINR(activeClientSummary.totalBilledAmount, true)}
            </div>
          </div>
        </div>
      )}

      {/* Financial Summary Cards */}
      {!selectedClientId && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Billed Client Accounts</div>
                  <div className="text-2xl font-extrabold text-[#0B2148] mt-1">{clientSummaries.length}</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-[#08B6D8]/15 text-[#0B2148] flex items-center justify-center font-bold">
                  <Users className="h-5 w-5 text-[#08B6D8]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Invoices</div>
                  <div className="text-2xl font-extrabold text-[#0B2148] mt-1">{totals.count}</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-slate-100 text-[#0B2148] flex items-center justify-center font-bold">
                  <Receipt className="h-5 w-5 text-[#0B2148]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gross Billed Revenue</div>
                  <div className="text-2xl font-extrabold text-[#08B6D8] mt-1">{formatINR(totals.sum, true)}</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-[#08B6D8]/15 text-[#08B6D8] flex items-center justify-center font-bold">
                  <IndianRupee className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toolbar & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              selectedClientId
                ? `Search invoices for ${activeClientSummary?.clientName}...`
                : viewMode === 'clients'
                ? 'Search client name or code...'
                : 'Search invoice # or client...'
            }
            className="pl-8 h-9 text-xs border-slate-200 rounded-lg focus:border-[#08B6D8]"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          {!selectedClientId && (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode('clients')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                  viewMode === 'clients'
                    ? 'bg-[#0B2148] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="h-3.5 w-3.5 text-[#08B6D8]" /> Client Summary
              </button>
              <button
                type="button"
                onClick={() => setViewMode('invoices')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                  viewMode === 'invoices'
                    ? 'bg-[#0B2148] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className="h-3.5 w-3.5 text-[#08B6D8]" /> Flat Invoices List
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Data Section */}
      {loading ? (
        <LoadingState label="Loading billed invoices database…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : viewMode === 'invoices' || selectedClientId ? (
        /* INVOICES TABLE VIEW WITH PAYMENT STATUS & PAYMENT ACTIONS */
        filteredInvoices.length === 0 ? (
          <EmptyState
            title="No billed revenue entries found"
            desc={
              selectedClientId
                ? `No invoices logged for ${activeClientSummary?.clientName} yet.`
                : 'Start by creating your first client billing invoice.'
            }
            icon={<Receipt className="h-8 w-8 text-slate-400" />}
          />
        ) : (
          <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-4">Invoice Date</th>
                      <th className="py-3 px-4">Invoice #</th>
                      {!selectedClientId && <th className="py-3 px-4">Client Account</th>}
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4 text-center">Attachment</th>
                      <th className="py-3 px-4 text-right">Grand Total</th>
                      <th className="py-3 px-4 text-center">Payment Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInvoices.map((r) => {
                      const status = r.status || 'UNPAID'
                      return (
                        <tr key={r.id} className="hover:bg-[#E8F8FC]/40 transition group">
                          <td className="py-3 px-4 font-semibold text-slate-600">{formatDate(r.date)}</td>
                          <td className="py-3 px-4 font-mono font-bold text-[#0B2148]">
                            <button
                              type="button"
                              onClick={() => setViewInvoice(r)}
                              className="inline-flex items-center gap-1.5 hover:text-[#08B6D8] hover:underline cursor-pointer text-left"
                            >
                              <span>{r.invoiceNo}</span>
                            </button>
                          </td>
                          {!selectedClientId && (
                            <td className="py-3 px-4">
                              <div className="font-bold text-[#0B2148]">{r.client?.name ?? '—'}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{r.client?.code ?? '—'}</div>
                            </td>
                          )}
                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{r.description || '—'}</td>
                          <td className="py-3 px-4 text-center">
                            {r.documentUrl ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setPreviewDoc({
                                    name: r.documentName || `Invoice ${r.invoiceNo}`,
                                    url: r.documentUrl!,
                                    invoiceNo: r.invoiceNo,
                                  })
                                }
                                className="h-7 text-[11px] border-[#08B6D8]/40 bg-[#E8F8FC]/50 text-[#0B2148] font-semibold gap-1 rounded-lg"
                              >
                                <ImageIcon className="h-3.5 w-3.5 text-[#08B6D8]" /> File
                              </Button>
                            ) : (
                              <span className="text-[11px] text-slate-300 italic">No File</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-[#08B6D8] text-sm">{formatINR(Number(r.amount))}</td>
                          <td className="py-3 px-4 text-center">
                            <Badge className={`text-[10px] font-bold ${
                              status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                              status === 'PARTIAL' ? 'bg-[#08B6D8]/20 text-[#0B2148]' :
                              status === 'OVERDUE' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-900'
                            }`}>
                              {status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPayInvoice(r)
                                  setPayAmount(String(r.amount))
                                }}
                                className="h-7 px-2.5 text-[11px] bg-[#0B2148] hover:bg-[#102B63] text-white font-bold gap-1 rounded-lg shadow-sm"
                              >
                                <CreditCard className="h-3.5 w-3.5 text-[#08B6D8]" /> Pay
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openPaymentHistory(r)}
                                className="h-7 px-2 text-[11px] text-slate-600 hover:text-[#0B2148] hover:bg-slate-100 rounded-lg border border-slate-200"
                                title="View Payment History"
                              >
                                <History className="h-3.5 w-3.5" />
                              </Button>
                            </div>
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
      ) : (
        /* CLIENT SUMMARY VIEW */
        <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="py-3.5 px-4">Client Account Name</th>
                    <th className="py-3.5 px-4">Client Code</th>
                    <th className="py-3.5 px-4">Tenant Scope</th>
                    <th className="py-3.5 px-4 text-center">Invoices Count</th>
                    <th className="py-3.5 px-4">Last Billed Date</th>
                    <th className="py-3.5 px-4 text-right">Total Billed Amount (Till Today)</th>
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClientSummaries.map((cs) => (
                    <tr
                      key={cs.clientId}
                      onClick={() => setSelectedClientId(cs.clientId)}
                      className="hover:bg-[#E8F8FC]/50 cursor-pointer transition group"
                    >
                      <td className="py-3.5 px-4 font-bold text-[#0B2148] text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-[#08B6D8]/15 text-[#0B2148] flex items-center justify-center font-bold text-xs">
                            <Users className="h-3.5 w-3.5 text-[#08B6D8]" />
                          </div>
                          <span className="group-hover:text-[#08B6D8] transition">{cs.clientName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge className="font-mono text-[10px] bg-slate-100 text-slate-800 border-slate-200 font-bold">
                          {cs.clientCode}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">{cs.companyName}</td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge className="bg-[#0B2148] text-white font-mono font-bold text-[11px] px-2.5 py-0.5">
                          {cs.invoiceCount} Invoices
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-semibold">{formatDate(cs.lastBilledDate)}</td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-[#08B6D8] text-base font-mono">
                        {formatINR(cs.totalBilledAmount, true)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedClientId(cs.clientId)
                          }}
                          className="h-8 px-3 text-xs border-[#08B6D8]/40 bg-[#E8F8FC] text-[#0B2148] font-bold gap-1 rounded-xl transition"
                        >
                          <span>View Invoices</span>
                          <ChevronRight className="h-3.5 w-3.5" />
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

      {/* Add New Invoice Dialog */}
      <AddRevenueDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => loadRevenues()}
      />

      {/* Record Payment Dialog */}
      <Dialog open={!!payInvoice} onOpenChange={(open) => !open && setPayInvoice(null)}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0B2148]">Record Customer Payment</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Record invoice payment for Invoice #{payInvoice?.invoiceNo} ({payInvoice?.client?.name})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
              <span className="text-slate-500 font-medium">Invoice Total:</span>
              <span className="font-extrabold text-[#08B6D8] text-base">{formatINR(payInvoice?.amount || 0)}</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#0B2148]">Payment Amount (₹)</Label>
              <Input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Enter amount"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#0B2148]">Payment Method</Label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full h-9 text-xs border border-slate-200 rounded-lg px-3 bg-white"
              >
                <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="CHEQUE">Cheque / Demand Draft</option>
                <option value="UPI">UPI Payment</option>
                <option value="CASH">Cash Payment</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#0B2148]">Reference Number (UTR / Cheque No)</Label>
              <Input
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="e.g. UTR192837465"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#0B2148]">Notes / Remarks</Label>
              <Textarea
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="Optional notes"
                className="text-xs h-16"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayInvoice(null)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} disabled={submittingPay} className="h-8 text-xs bg-[#0B2148] text-white">
              {submittingPay ? 'Recording...' : 'Submit Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={!!historyInvoice} onOpenChange={(open) => !open && setHistoryInvoice(null)}>
        <DialogContent className="sm:max-w-lg bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0B2148]">
              Payment History — Invoice #{historyInvoice?.invoiceNo}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              List of all recorded customer payments and reversals
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {loadingHistory ? (
              <LoadingState label="Loading payment history..." />
            ) : historyPayments.length === 0 ? (
              <EmptyState title="No payments recorded" desc="No payments logged for this invoice yet." />
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {historyPayments.map((p) => (
                  <div key={p.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-[#0B2148]">{formatINR(p.amount)}</div>
                      <div className="text-[10px] text-slate-500">{formatDate(p.paymentDate)} via {p.paymentMethod}</div>
                      {p.referenceNumber && <div className="text-[10px] text-slate-400 font-mono">Ref: {p.referenceNumber}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={p.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}>
                        {p.status}
                      </Badge>
                      {p.status === 'ACTIVE' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReversePayment(p.id)}
                          className="h-7 text-rose-600 hover:bg-rose-50 font-bold"
                          title="Reverse Payment"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Void
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Supporting Document / Image Lightbox Modal */}
      {previewDoc && (
        <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
          <DialogContent className="sm:max-w-3xl p-[#0B2148] p-6 rounded-2xl flex flex-col bg-white">
            <DialogHeader className="border-b border-slate-100 pb-3">
              <DialogTitle className="text-base font-bold text-[#0B2148] flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-[#08B6D8]" /> Supporting Document Attachment — Invoice #{previewDoc.invoiceNo}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {previewDoc.name}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-auto py-4 flex items-center justify-center bg-slate-900 rounded-xl my-2 p-4 min-h-[350px]">
              {previewDoc.url.startsWith('data:image/') || previewDoc.url.startsWith('http') || previewDoc.url.startsWith('/') || previewDoc.url.endsWith('.png') || previewDoc.url.endsWith('.jpg') || previewDoc.url.endsWith('.jpeg') || previewDoc.url.endsWith('.gif') ? (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.name}
                  className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-2xl"
                />
              ) : previewDoc.url.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.name}
                  className="w-full h-[60vh] rounded-lg border-0 bg-white"
                />
              ) : (
                <div className="text-center text-white space-y-3">
                  <FileText className="h-16 w-16 mx-auto text-[#08B6D8]" />
                  <p className="text-sm font-semibold">Supporting Attachment File</p>
                  <a
                    href={previewDoc.url}
                    download={previewDoc.name}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#08B6D8] text-[#081B3A] rounded-xl font-bold text-xs hover:bg-[#16C4E8]"
                  >
                    <Download className="h-4 w-4" /> Download File Attachment
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
                <Download className="h-4 w-4 text-[#08B6D8]" /> Download Attachment
              </a>
              <Button variant="outline" onClick={() => setPreviewDoc(null)} className="h-8 text-xs">
                Close Preview
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function AddRevenueDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (r: Revenue) => void
}) {
  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientId, setClientId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [invoiceNo, setInvoiceNo] = useState(
    () => `INV-${Date.now().toString(36).toUpperCase()}`
  )
  const [description, setDescription] = useState('')
  const [gstPercent, setGstPercent] = useState('18')

  // Line items state
  const [items, setItems] = useState<LineItem[]>([
    { id: '1', name: 'Professional Services / Billing Item 1', quantity: 1, rate: 100000, amount: 100000 },
  ])

  // File upload state
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [documentName, setDocumentName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    ;(async () => {
      try {
        const { clients: list } = await fetchJson<{ clients: ClientOption[] }>('/api/clients')
        setClients(list || [])
        if (list && list.length > 0) setClientId(list[0].id)
      } catch {
        setClients([])
      }
    })()
  }, [open])

  // Subtotal & Tax math
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.rate || 0)), 0)
  }, [items])

  const taxAmount = useMemo(() => {
    return subtotal * (Number(gstPercent || 0) / 100)
  }, [subtotal, gstPercent])

  const grandTotal = useMemo(() => {
    return subtotal + taxAmount
  }, [subtotal, taxAmount])

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const updated = { ...item, [field]: value }
        if (field === 'quantity' || field === 'rate') {
          updated.amount = Number(updated.quantity || 0) * Number(updated.rate || 0)
        }
        return updated
      })
    )
  }

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: Date.now().toString(), name: `Billing Item ${prev.length + 1}`, quantity: 1, rate: 0, amount: 0 },
    ])
  }

  const removeItem = (id: string) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setDocumentUrl(reader.result as string)
      setDocumentName(file.name)
      toast.success(`Supporting document "${file.name}" attached!`)
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !date || !invoiceNo || grandTotal <= 0) {
      toast.error('Please fill in all required fields and ensure total is greater than 0')
      return
    }

    setSubmitting(true)
    try {
      const { revenue } = await fetchJson<{ revenue: Revenue }>('/api/revenue', {
        method: 'POST',
        body: JSON.stringify({
          clientId,
          date,
          dueDate: dueDate || undefined,
          invoiceNo,
          description: description.trim() || undefined,
          quantity: 1,
          rate: subtotal,
          subtotal,
          taxAmount,
          amount: grandTotal,
          items,
          documentUrl: documentUrl || undefined,
          documentName: documentName || undefined,
        }),
      })

      toast.success(`Invoice #${invoiceNo} created successfully!`)
      onCreated(revenue)
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to create invoice')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-6 rounded-2xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#0B2148] flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#08B6D8]" /> Create Billed Revenue Invoice
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Generate a client invoice with itemized line items and grand total GST tax.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#0B2148]">Client Account *</Label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full h-9 text-xs border border-slate-200 rounded-lg px-3 bg-white focus:border-[#08B6D8]"
                required
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#0B2148]">Invoice Number *</Label>
              <div className="flex gap-1.5">
                <Input
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  className="h-9 text-xs font-mono font-bold"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInvoiceNo(`INV-${Date.now().toString(36).toUpperCase()}`)}
                  className="h-9 px-2 text-[11px]"
                  title="Generate Invoice Number"
                >
                  Gen
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#0B2148]">Invoice Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-xs" required />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#0B2148]">Due Date (Optional)</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-[#0B2148]">Invoice Description / Subject</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Q2 Software Development Services"
              className="text-xs h-16"
            />
          </div>

          {/* Line Items Table */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-[#0B2148]">Line Items Breakdown</Label>
              <Button type="button" onClick={addItem} variant="ghost" size="sm" className="h-7 text-xs text-[#08B6D8] font-bold">
                + Add Item
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <div className="col-span-5">
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                      placeholder="Item name"
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                      placeholder="Qty"
                      className="h-8 text-xs bg-white text-right"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      value={item.rate}
                      onChange={(e) => updateItem(item.id, 'rate', Number(e.target.value))}
                      placeholder="Rate"
                      className="h-8 text-xs bg-white text-right"
                    />
                  </div>
                  <div className="col-span-2 text-right font-extrabold text-[#0B2148] text-xs">
                    {formatINR(item.quantity * item.rate)}
                  </div>
                  <div className="col-span-1 text-center">
                    <button type="button" onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-rose-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Grand Total GST Selector Section */}
          <div className="p-4 bg-[#E8F8FC]/50 border border-[#08B6D8]/30 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-[#0B2148]">GST Tax Rate (Applied at Grand Total)</Label>
              <select
                value={gstPercent}
                onChange={(e) => setGstPercent(e.target.value)}
                className="h-8 text-xs font-bold border border-slate-200 rounded-lg px-2 bg-white"
              >
                <option value="0">0% (GST Exempt)</option>
                <option value="5">5% GST</option>
                <option value="12">12% GST</option>
                <option value="18">18% GST (Standard)</option>
                <option value="28">28% GST</option>
              </select>
            </div>

            <div className="space-y-1 pt-2 border-t border-[#08B6D8]/20 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal (Excl. GST):</span>
                <span className="font-bold">{formatINR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST Tax Amount ({gstPercent}%):</span>
                <span className="font-bold text-amber-700">{formatINR(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-[#0B2148] font-extrabold text-sm pt-1 border-t border-slate-200">
                <span>Grand Total (Incl. GST):</span>
                <span className="text-[#08B6D8] font-mono">{formatINR(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Attachment Upload */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-bold text-[#0B2148] flex items-center justify-between">
              <span>Supporting Invoice Document / Scan (Optional)</span>
              {documentName && <span className="text-emerald-600 text-[10px] font-bold">Attached</span>}
            </Label>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-slate-300 hover:border-[#08B6D8] bg-slate-50 p-2.5 rounded-xl text-center cursor-pointer text-xs text-slate-500 flex items-center justify-center gap-2"
            >
              <Paperclip className="h-4 w-4 text-[#08B6D8]" />
              <span>{documentName || 'Click to attach invoice scan or purchase order'}</span>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="h-8 text-xs bg-[#0B2148] text-white">
              {submitting ? 'Creating...' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
