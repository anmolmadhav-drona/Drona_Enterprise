'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import {
  IndianRupee, Plus, Receipt, ShieldAlert, Loader2, Building2, Hash, CalendarDays, Search, Sparkles,
  Paperclip, FileText, Image as ImageIcon, Eye, Download, CheckCircle2, X, FileCheck, Printer,
  ArrowLeft, ChevronRight, Users, Layers
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
  invoiceNo: string
  description: string | null
  quantity: number
  rate: number
  amount: number
  items?: string | null
  subtotal?: number | null
  taxAmount?: number | null
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

export function RevenueModule() {
  const { user } = useApp()
  const [revenues, setRevenues] = useState<Revenue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<{ name: string; url: string; invoiceNo: string } | null>(null)
  const [viewInvoice, setViewInvoice] = useState<Revenue | null>(null)

  // Two-tier View States: 'clients' (Summary View per Client) | 'invoices' (Flat Invoice List)
  const [viewMode, setViewMode] = useState<'clients' | 'invoices'>('clients')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  // Page-scoped Local Filters
  const [pageFrom, setPageFrom] = useState('')
  const [pageTo, setPageTo] = useState('')

  const isGroupAdmin = user?.role === 'GROUP_ADMIN'
  const isViewOnly = user?.role === 'STANDARD_USER'

  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (pageFrom) params.set('from', pageFrom)
    if (pageTo) params.set('to', pageTo)
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
  }, [pageFrom, pageTo])

  // Overall Financial Totals
  const totals = useMemo(() => {
    let sum = 0
    for (const r of revenues) sum += Number(r.amount) || 0
    return { count: revenues.length, sum }
  }, [revenues])

  // Client Billed Revenue Summaries (Total Billed Amount Till Today per Client)
  const clientSummaries = useMemo(() => {
    const map = new Map<string, {
      clientId: string
      clientName: string
      clientCode: string
      companyName: string
      invoiceCount: number
      totalBilledAmount: number
      lastBilledDate: string
      revenues: Revenue[]
    }>()

    for (const r of revenues) {
      const cId = r.clientId || r.client?.id || 'unknown'
      const cName = r.client?.name || 'Unassigned Client'
      const cCode = r.client?.code || '—'
      const compName = r.client?.company?.name || 'Group Headquarters'

      const existing = map.get(cId)
      if (existing) {
        existing.invoiceCount += 1
        existing.totalBilledAmount += Number(r.amount) || 0
        if (r.date > existing.lastBilledDate) {
          existing.lastBilledDate = r.date
        }
        existing.revenues.push(r)
      } else {
        map.set(cId, {
          clientId: cId,
          clientName: cName,
          clientCode: cCode,
          companyName: compName,
          invoiceCount: 1,
          totalBilledAmount: Number(r.amount) || 0,
          lastBilledDate: r.date,
          revenues: [r],
        })
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalBilledAmount - a.totalBilledAmount)
  }, [revenues])

  // Currently Selected Client Summary for Drilldown View
  const activeClientSummary = useMemo(() => {
    if (!selectedClientId) return null
    return clientSummaries.find((cs) => cs.clientId === selectedClientId) ?? null
  }, [selectedClientId, clientSummaries])

  // Filtered Client Summaries for Main View
  const filteredClientSummaries = useMemo(() => {
    if (!searchQuery.trim()) return clientSummaries
    const q = searchQuery.toLowerCase()
    return clientSummaries.filter(
      (cs) => cs.clientName.toLowerCase().includes(q) || cs.clientCode.toLowerCase().includes(q)
    )
  }, [clientSummaries, searchQuery])

  // Filtered Invoices List
  const filteredRevenues = useMemo(() => {
    let list = revenues
    if (selectedClientId) {
      list = list.filter((r) => r.clientId === selectedClientId)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (r) => r.invoiceNo.toLowerCase().includes(q) || (r.client?.name ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [revenues, selectedClientId, searchQuery])

  return (
    <div className="space-y-6">
      <PageHeader
        title={selectedClientId ? `Revenue Ledger — ${activeClientSummary?.clientName}` : 'Revenue & Client Billed Ledger'}
        subtitle={
          selectedClientId
            ? `Comprehensive breakdown of all billing invoices generated for ${activeClientSummary?.clientName} (${activeClientSummary?.clientCode})`
            : 'Client-wise total billed revenue till today, itemized invoice breakdown, and supportive document attachments'
        }
        action={
          <div className="flex items-center gap-2">
            {selectedClientId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedClientId(null)}
                className="gap-1.5 border-slate-200 text-[#0B2148] hover:bg-slate-50 text-xs font-semibold rounded-lg"
              >
                <ArrowLeft className="h-4 w-4 text-[#08B6D8]" /> Back to All Clients
              </Button>
            )}
            {isViewOnly ? (
              <Badge variant="outline" className="gap-1.5 text-slate-500 border-slate-200">
                <ShieldAlert className="h-3.5 w-3.5" /> View-only access
              </Badge>
            ) : (
              <Button onClick={() => setAddOpen(true)} size="sm" className="bg-[#0B2148] hover:bg-[#102B63] text-white font-semibold text-xs gap-1.5 rounded-lg shadow-sm">
                <Plus className="h-4 w-4 text-[#08B6D8]" /> + Add Billed Revenue
              </Button>
            )}
          </div>
        }
      />

      {/* Selected Client Specific Banner & KPIs */}
      {selectedClientId && activeClientSummary ? (
        <Card className="border border-[#08B6D8]/30 bg-gradient-to-r from-[#0B2148] via-[#102B63] to-[#0B2148] text-white shadow-md rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-[#08B6D8]/20 flex items-center justify-center font-bold text-white border border-[#08B6D8]/30">
                <Users className="h-6 w-6 text-[#08B6D8]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-extrabold text-white tracking-tight">{activeClientSummary.clientName}</h3>
                  <Badge className="font-mono text-[10px] bg-[#08B6D8] text-[#0B2148] font-bold">{activeClientSummary.clientCode}</Badge>
                </div>
                <div className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-[#08B6D8]" />
                  <span>{activeClientSummary.companyName}</span>
                  <span>•</span>
                  <span>Last Billed: {formatDate(activeClientSummary.lastBilledDate)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/15 text-center min-w-[120px]">
                <div className="text-[10px] uppercase font-bold text-slate-300">Total Invoices</div>
                <div className="text-lg font-extrabold text-white mt-0.5">{activeClientSummary.invoiceCount}</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/15 text-center min-w-[150px]">
                <div className="text-[10px] uppercase font-bold text-slate-300">Total Billed Amount</div>
                <div className="text-lg font-extrabold text-[#08B6D8] mt-0.5">{formatINR(activeClientSummary.totalBilledAmount, true)}</div>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        /* Overall Financial Summary Cards */
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
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Billed Invoices</div>
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
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gross Billed Amount (Till Today)</div>
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
          {/* Date Scope Pickers */}
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

          {/* View Mode Switcher (Only when not inspecting a single client) */}
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
                <Receipt className="h-3.5 w-3.5 text-[#08B6D8]" /> All Invoices
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState label="Fetching revenue ledgers & client totals…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : selectedClientId || viewMode === 'invoices' ? (
        /* INVOICES LEDGER TABLE VIEW */
        filteredRevenues.length === 0 ? (
          <EmptyState
            title="No billing invoices found"
            desc="No invoices recorded matching your search or date criteria."
            icon={<Receipt className="h-8 w-8 text-slate-400" />}
          />
        ) : (
          <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-4">Billing Date</th>
                      <th className="py-3 px-4">Invoice #</th>
                      {!selectedClientId && <th className="py-3 px-4">Client Name</th>}
                      <th className="py-3 px-4">Description / Terms</th>
                      <th className="py-3 px-4 text-center">Supportive Document</th>
                      <th className="py-3 px-4 text-right">Qty</th>
                      <th className="py-3 px-4 text-right">Subtotal Rate</th>
                      <th className="py-3 px-4 text-right">Billed Amount</th>
                      <th className="py-3 px-4 text-center">Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRevenues.map((r) => (
                      <tr key={r.id} className="hover:bg-[#E8F8FC]/40 transition group">
                        <td className="py-3 px-4 font-semibold text-slate-600">{formatDate(r.date)}</td>
                        <td className="py-3 px-4 font-mono font-bold text-[#0B2148]">
                          <button
                            type="button"
                            onClick={() => setViewInvoice(r)}
                            className="inline-flex items-center gap-1.5 hover:text-[#08B6D8] hover:underline cursor-pointer text-left"
                            title="Click to view full billing summary"
                          >
                            <span>{r.invoiceNo}</span>
                            <Eye className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition text-[#08B6D8]" />
                          </button>
                        </td>
                        {!selectedClientId && (
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#0B2148]">{r.client?.name ?? '—'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{r.client?.code ?? '—'}</div>
                          </td>
                        )}
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{r.description || '—'}</td>

                        {/* Supportive Document Column */}
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
                              className="h-7 text-[11px] border-[#08B6D8]/40 bg-[#E8F8FC]/50 hover:bg-[#08B6D8]/20 text-[#0B2148] font-semibold gap-1.5 rounded-lg"
                            >
                              <ImageIcon className="h-3.5 w-3.5 text-[#08B6D8]" /> View Document
                            </Button>
                          ) : (
                            <span className="text-[11px] text-slate-300 italic">No File</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right font-semibold text-slate-700">{r.quantity}</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-600">{formatINR(Number(r.rate))}</td>
                        <td className="py-3 px-4 text-right font-bold text-[#08B6D8] text-sm">{formatINR(Number(r.amount))}</td>

                        {/* View Billing Summary Column */}
                        <td className="py-3 px-4 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewInvoice(r)}
                            className="h-7 px-2.5 text-[11px] text-[#0B2148] hover:text-[#08B6D8] hover:bg-[#E8F8FC] font-bold gap-1 rounded-lg border border-slate-200"
                          >
                            <FileText className="h-3.5 w-3.5 text-[#08B6D8]" /> View Summary
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        /* CLIENT-WISE BILLED REVENUE SUMMARY TABLE VIEW */
        filteredClientSummaries.length === 0 ? (
          <EmptyState
            title="No client billed revenue recorded"
            desc="Log a billed revenue invoice to inspect client accounts."
            icon={<Users className="h-8 w-8 text-slate-400" />}
          />
        ) : (
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
                      <th className="py-3.5 px-4 text-center">Invoices Action</th>
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
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-[#08B6D8]" />
                            <span>{cs.companyName}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Badge className="bg-[#0B2148] text-white font-mono font-bold text-[11px] px-2.5 py-0.5">
                            {cs.invoiceCount} {cs.invoiceCount === 1 ? 'Invoice' : 'Invoices'}
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
                            className="h-8 px-3 text-xs border-[#08B6D8]/40 bg-[#E8F8FC] hover:bg-[#08B6D8] hover:text-white text-[#0B2148] font-bold gap-1 rounded-xl transition"
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
        )
      )}

      {/* Invoice Summary Modal */}
      <InvoiceSummaryModal
        revenue={viewInvoice}
        onClose={() => setViewInvoice(null)}
        onViewDoc={(doc) => setPreviewDoc(doc)}
      />

      {/* Add Revenue Modal */}
      <AddRevenueDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        isGroupAdmin={isGroupAdmin}
        activeCompanyId={user?.companyId ?? null}
        onCreated={(rev) => setRevenues([rev, ...revenues])}
      />

      {/* View Supportive Document Image Modal */}
      {previewDoc && (
        <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
          <DialogContent className="sm:max-w-3xl p-6 rounded-2xl flex flex-col">
            <DialogHeader className="border-b border-slate-100 pb-3">
              <DialogTitle className="text-base font-bold text-[#0B2148] flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-[#08B6D8]" /> Supportive Document Image — {previewDoc.invoiceNo}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {previewDoc.name}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-auto py-4 flex items-center justify-center bg-slate-900 rounded-xl my-2 p-4 min-h-[400px]">
              {previewDoc.url.startsWith('data:application/pdf') || previewDoc.url.endsWith('.pdf') ? (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.name}
                  className="w-full h-[60vh] rounded-lg border-0 bg-white"
                />
              ) : previewDoc.url.startsWith('data:image/') || previewDoc.url.startsWith('http') || previewDoc.url.startsWith('/') ? (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.name}
                  className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-2xl"
                />
              ) : (
                <div className="text-center text-white space-y-3">
                  <FileText className="h-16 w-16 mx-auto text-[#08B6D8]" />
                  <p className="text-sm font-semibold">Document Attached ({previewDoc.name})</p>
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
                <Download className="h-4 w-4 text-[#08B6D8]" /> Download Document Image
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

function InvoiceSummaryModal({
  revenue,
  onClose,
  onViewDoc,
}: {
  revenue: Revenue | null
  onClose: () => void
  onViewDoc?: (doc: { name: string; url: string; invoiceNo: string }) => void
}) {
  if (!revenue) return null

  // Parse items JSON safely
  let itemsList: LineItem[] = []
  if (revenue.items) {
    try {
      itemsList = typeof revenue.items === 'string' ? JSON.parse(revenue.items) : revenue.items
    } catch {
      itemsList = []
    }
  }

  // Fallback if legacy entry without items array
  if (itemsList.length === 0) {
    const q = revenue.quantity || 1
    const total = revenue.amount || 0
    const sub = revenue.subtotal || (revenue.rate ? revenue.rate * q : total)

    itemsList = [
      {
        name: revenue.description || 'Billed Services / Contract Earnings',
        quantity: q,
        rate: revenue.rate || sub / q,
      },
    ]
  }

  // Compute subtotal across items
  let calcSubtotal = 0
  const itemsWithTotals = itemsList.map((item) => {
    const q = Number(item.quantity) || 0
    const r = Number(item.rate) || 0
    const lineTotal = q * r
    calcSubtotal += lineTotal
    return { ...item, lineTotal }
  })

  const finalSubtotal = revenue.subtotal ?? calcSubtotal
  const finalGrandTotal = revenue.amount ?? calcSubtotal
  const finalTaxAmount = revenue.taxAmount ?? (finalGrandTotal > finalSubtotal ? finalGrandTotal - finalSubtotal : 0)
  const gstEffectivePercent = finalSubtotal > 0 ? Math.round((finalTaxAmount / finalSubtotal) * 100) : 0

  return (
    <Dialog open={!!revenue} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl p-0 rounded-3xl overflow-hidden border border-slate-200 shadow-2xl bg-white">
        {/* Printable Invoice Header */}
        <div className="bg-[#0B2148] text-white p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 h-40 w-40 rounded-full bg-[#08B6D8]/10 blur-2xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2">
                <Receipt className="h-6 w-6 text-[#08B6D8]" />
                <h2 className="text-xl font-extrabold tracking-tight">Invoice Billing Summary</h2>
              </div>
              <div className="text-xs text-slate-300 mt-1 flex items-center gap-2">
                <span>Invoice No: <b className="font-mono text-[#08B6D8]">{revenue.invoiceNo}</b></span>
                <span>•</span>
                <span>Date: <b>{formatDate(revenue.date)}</b></span>
              </div>
            </div>

            <Badge className="bg-[#08B6D8]/20 text-[#08B6D8] border-[#08B6D8]/30 px-3 py-1 text-xs font-bold font-mono">
              Billed Invoice Logged
            </Badge>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto scroll-thin">
          {/* Client & Vendor Meta Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/70 text-xs">
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Billed Client Account</div>
              <div className="font-extrabold text-sm text-[#0B2148]">{revenue.client?.name ?? 'Client Account'}</div>
              <div className="font-mono text-slate-500">Client Code: {revenue.client?.code ?? '—'}</div>
              {revenue.client?.company && (
                <div className="text-slate-500">Tenant Scope: <span className="font-semibold text-slate-700">{revenue.client.company.name}</span></div>
              )}
            </div>

            <div className="space-y-1 text-left sm:text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Invoice Details</div>
              <div className="font-semibold text-slate-700">Created: {formatDate(revenue.createdAt)}</div>
              {revenue.description && (
                <div className="text-slate-500 italic mt-1 max-w-xs ml-auto">"{revenue.description}"</div>
              )}
            </div>
          </div>

          {/* Itemized Line Items Table */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-[#0B2148] flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-[#08B6D8]" /> Itemized Billing Breakdown
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-xs">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <th className="py-3 px-4">Item Description</th>
                    <th className="py-3 px-4 text-right">Qty</th>
                    <th className="py-3 px-4 text-right">Rate (₹)</th>
                    <th className="py-3 px-4 text-right">Line Total (Excl. Tax)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itemsWithTotals.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-semibold text-[#0B2148]">
                        {item.name || `Line Item #${idx + 1}`}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700">{item.quantity}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">{formatINR(item.rate, true)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#0B2148]">{formatINR(item.lineTotal, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grand Totals & GST Summary */}
          <div className="bg-[#E8F8FC]/80 border border-[#08B6D8]/40 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1.5 text-xs text-slate-700 w-full sm:w-auto">
              <div className="flex items-center gap-4 flex-wrap">
                <span>Subtotal (Excl. Tax): <b className="text-[#0B2148] font-mono font-bold">{formatINR(finalSubtotal, true)}</b></span>
                <span>•</span>
                <span>GST ({gstEffectivePercent}%): <b className="text-[#08B6D8] font-mono font-bold">{formatINR(finalTaxAmount, true)}</b></span>
              </div>
            </div>

            <div className="text-right w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-[#08B6D8]/30">
              <div className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Grand Total (Incl. GST)</div>
              <div className="text-2xl font-black text-[#0B2148] font-mono">{formatINR(finalGrandTotal, true)}</div>
            </div>
          </div>

          {/* Supportive Document Preview Card if Attached */}
          {revenue.documentUrl && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#08B6D8]/15 text-[#0B2148] flex items-center justify-center font-bold">
                  {revenue.documentUrl.startsWith('data:image/') ? (
                    <ImageIcon className="h-5 w-5 text-[#08B6D8]" />
                  ) : (
                    <FileText className="h-5 w-5 text-[#08B6D8]" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0B2148]">Supportive Document Attached</div>
                  <div className="text-[11px] text-slate-500 font-mono">{revenue.documentName || `Invoice ${revenue.invoiceNo} Document`}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onClose()
                    onViewDoc?.({
                      name: revenue.documentName || `Invoice ${revenue.invoiceNo}`,
                      url: revenue.documentUrl!,
                      invoiceNo: revenue.invoiceNo,
                    })
                  }}
                  className="h-8 text-xs border-[#08B6D8]/40 text-[#0B2148] font-semibold gap-1.5 rounded-xl bg-white hover:bg-[#E8F8FC]"
                >
                  <Eye className="h-3.5 w-3.5 text-[#08B6D8]" /> View Document Scan
                </Button>

                <a
                  href={revenue.documentUrl}
                  download={revenue.documentName || `Invoice-${revenue.invoiceNo}`}
                  className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#0B2148] hover:bg-[#102B63] rounded-xl transition"
                >
                  <Download className="h-3.5 w-3.5 text-[#08B6D8]" /> Download
                </a>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
            className="h-9 text-xs gap-2 font-bold text-[#0B2148] border-slate-300 rounded-xl"
          >
            <Printer className="h-4 w-4 text-[#08B6D8]" /> Print / Save PDF Invoice
          </Button>

          <Button
            type="button"
            onClick={onClose}
            className="h-9 text-xs bg-[#0B2148] hover:bg-[#102B63] text-white font-semibold rounded-xl px-5"
          >
            Close Summary
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type LineItem = {
  name: string
  quantity: number
  rate: number
}

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

  // Multi-Item Line Items (No per-item GST)
  const [items, setItems] = useState<LineItem[]>([
    { name: '', quantity: 1, rate: 0 },
  ])

  // Single Overall GST Rate Selector (%)
  const [gstPercent, setGstPercent] = useState<number>(18)

  // Supportive Document Upload States (PDF or Image)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [documentName, setDocumentName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    ;(async () => {
      try {
        const params = new URLSearchParams()
        if (activeCompanyId) params.set('companyId', activeCompanyId)
        params.set('status', 'ACTIVE')
        const { clients: list } = await fetchJson<{ clients: ClientOption[] }>(`/api/clients?${params.toString()}`)
        setClients(list)
      } catch {
        setClients([])
      }
    })()
  }, [open, activeCompanyId])

  useEffect(() => {
    if (open && !date) setDate(new Date().toISOString().slice(0, 10))
    if (open && !invoiceNo) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000)
      setInvoiceNo(`INV-${new Date().getFullYear()}-${randomSuffix}`)
    }
  }, [open, date, invoiceNo])

  // Invoice Overall Summary
  const invoiceSummary = useMemo(() => {
    let subtotal = 0
    let totalQty = 0
    items.forEach((item) => {
      const q = Number(item.quantity) || 0
      const r = Number(item.rate) || 0
      subtotal += q * r
      totalQty += q
    })
    const taxAmount = subtotal * (Number(gstPercent) / 100)
    const grandTotal = subtotal + taxAmount
    return { subtotal, taxAmount, grandTotal, totalQty, gstPercent }
  }, [items, gstPercent])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setDocumentUrl(reader.result as string)
      setDocumentName(file.name)
      toast.success(`Supportive document "${file.name}" attached!`)
    }
    reader.readAsDataURL(file)
  }

  const removeFile = () => {
    setDocumentUrl(null)
    setDocumentName(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !date || !invoiceNo.trim() || invoiceSummary.grandTotal <= 0) {
      toast.error('Please enter valid client, date, invoice #, and at least one item with rate > 0')
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        clientId,
        date,
        invoiceNo: invoiceNo.trim(),
        description: description.trim() || undefined,
        quantity: invoiceSummary.totalQty,
        rate: invoiceSummary.subtotal,
        amount: invoiceSummary.grandTotal,
        subtotal: invoiceSummary.subtotal,
        taxAmount: invoiceSummary.taxAmount,
        items,
        documentUrl: documentUrl || undefined,
        documentName: documentName || undefined,
      }

      const { revenue } = await fetchJson<{ revenue: Revenue }>('/api/revenue', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      toast.success(`Invoice ${revenue.invoiceNo} generated & logged!`)
      onCreated(revenue)
      onOpenChange(false)

      // Reset Form State
      setClientId('')
      setInvoiceNo('')
      setDescription('')
      setItems([{ name: '', quantity: 1, rate: 0 }])
      setGstPercent(18)
      setDocumentUrl(null)
      setDocumentName(null)
    } catch (err: any) {
      toast.error(err.message || 'Failed to add revenue entry')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col p-6 rounded-2xl overflow-y-auto scroll-thin">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <DialogTitle className="text-xl font-extrabold text-[#0B2148] flex items-center gap-2">
            <Receipt className="h-6 w-6 text-[#08B6D8]" /> Dedicated Revenue & Invoice Generator
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Create itemized billed revenue entries with quantity, unit rate, overall GST calculation, subtotal breakdown, and supportive document upload (PDF or Image).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Header Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label className="text-xs font-semibold text-slate-700">Client Account *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select client account" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Invoice Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-xs" required />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Invoice # *</Label>
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="e.g. INV-2024-001" className="h-9 text-xs font-mono font-bold text-[#0B2148]" required />
            </div>
          </div>

          {/* Description Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Description / Terms</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Invoice notes, milestone references, or payment terms..." className="text-xs" rows={2} />
          </div>

          {/* Multi-Item Line Items Table */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-[#0B2148] flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-[#08B6D8]" /> Itemized Billing Items
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems([...items, { name: '', quantity: 1, rate: 0 }])}
                className="h-8 text-xs text-[#08B6D8] border-[#08B6D8]/40 hover:bg-[#E8F8FC] font-semibold gap-1.5 rounded-lg"
              >
                <Plus className="h-3.5 w-3.5" /> + Add Line Item
              </Button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-slate-50/50">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <th className="py-2.5 px-3">Item Name / Service Description</th>
                    <th className="py-2.5 px-3 w-24 text-right">Qty</th>
                    <th className="py-2.5 px-3 w-36 text-right">Unit Rate (₹)</th>
                    <th className="py-2.5 px-3 w-36 text-right">Line Total (Excl. Tax)</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 bg-white">
                  {items.map((item, idx) => {
                    const lineTotal = (Number(item.quantity) || 0) * (Number(item.rate) || 0)
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="p-2">
                          <Input
                            placeholder="e.g. Software Consulting / Server Logistics"
                            value={item.name}
                            onChange={(e) => {
                              const copy = [...items]
                              copy[idx].name = e.target.value
                              setItems(copy)
                            }}
                            className="h-8 text-xs border-slate-200"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const copy = [...items]
                              copy[idx].quantity = Math.max(1, Number(e.target.value) || 1)
                              setItems(copy)
                            }}
                            className="h-8 text-xs text-right border-slate-200 font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={item.rate || ''}
                            onChange={(e) => {
                              const copy = [...items]
                              copy[idx].rate = Math.max(0, Number(e.target.value) || 0)
                              setItems(copy)
                            }}
                            className="h-8 text-xs text-right border-slate-200 font-mono"
                          />
                        </td>
                        <td className="p-2 text-right font-bold text-[#0B2148] font-mono">
                          {formatINR(lineTotal, true)}
                        </td>
                        <td className="p-2 text-center">
                          {items.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setItems(items.filter((_, i) => i !== idx))}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grand Totals Summary Card with Single Overall GST Selector */}
          <div className="bg-[#E8F8FC]/60 border border-[#08B6D8]/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-2 text-xs text-slate-600 w-full sm:w-auto">
              <div className="flex items-center gap-3 flex-wrap">
                <span>Subtotal (Excl. Tax): <b className="text-[#0B2148] font-mono font-bold">{formatINR(invoiceSummary.subtotal, true)}</b></span>
                <span>•</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[#0B2148]">GST Rate:</span>
                  <Select value={String(gstPercent)} onValueChange={(v) => setGstPercent(Number(v))}>
                    <SelectTrigger className="h-7 text-xs w-28 bg-white border-[#08B6D8]/40 font-bold text-[#08B6D8]">
                      <SelectValue placeholder="18%" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0% (Exempt)</SelectItem>
                      <SelectItem value="5">5% GST</SelectItem>
                      <SelectItem value="12">12% GST</SelectItem>
                      <SelectItem value="18">18% GST</SelectItem>
                      <SelectItem value="28">28% GST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <span>•</span>
                <span>Total GST Tax: <b className="text-[#08B6D8] font-mono font-bold">{formatINR(invoiceSummary.taxAmount, true)}</b></span>
              </div>
              <div className="text-[11px] text-slate-400">Applied {gstPercent}% GST on subtotal of {items.length} line item(s)</div>
            </div>

            <div className="text-right w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-[#08B6D8]/20">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Grand Total (Incl. GST)</div>
              <div className="text-2xl font-black text-[#0B2148] font-mono">{formatINR(invoiceSummary.grandTotal, true)}</div>
            </div>
          </div>

          {/* Supportive Document Upload (PDF or Image) */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-[#08B6D8]" /> Supportive Document (PDF or Image Scan)
              </span>
              {documentName && (
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Document Attached
                </span>
              )}
            </Label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            {!documentUrl ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-slate-300 hover:border-[#08B6D8] bg-slate-50 hover:bg-[#E8F8FC]/30 rounded-xl p-3.5 text-center cursor-pointer transition flex items-center justify-center gap-2.5 text-slate-500 text-xs"
              >
                <FileText className="h-4 w-4 text-[#08B6D8]" />
                <span>Click to upload supportive document (PDF contract/receipt or Image scan)</span>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-[#E8F8FC]/60 border border-[#08B6D8]/30 rounded-xl p-2.5 px-3">
                <div className="flex items-center gap-2.5 text-xs truncate max-w-[80%]">
                  {documentUrl.startsWith('data:image/') ? (
                    <img src={documentUrl} alt="Thumbnail" className="h-8 w-8 rounded object-cover border border-slate-200 shrink-0" />
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 font-bold text-[10px]">
                      PDF
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-[#0B2148] truncate">{documentName}</div>
                    <div className="text-[10px] text-slate-400 uppercase">
                      {documentUrl.startsWith('data:image/') ? 'Image Scan' : 'PDF Document'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={removeFile}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                  title="Remove document"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-[#0B2148] hover:bg-[#102B63] text-white font-semibold gap-1.5 px-5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileCheck className="h-4 w-4 text-[#08B6D8]" /> Generate & Log Billed Invoice</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
