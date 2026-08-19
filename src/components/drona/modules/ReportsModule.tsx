'use client'

import { useEffect, useState } from 'react'
import {
  TrendingUp, TrendingDown, Percent, IndianRupee, Wallet, Receipt, Building2,
  Network, AlertCircle, Info, Download, Printer, Sparkles, ShieldCheck, SlidersHorizontal,
  CalendarClock, Users, FileSpreadsheet, ArrowUpRight, ArrowDownRight, RefreshCw, ChevronRight, Layers
} from 'lucide-react'
import { toast } from 'sonner'

import { useApp, fetchJson } from '@/lib/app-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatINR, formatPercent, formatDate, MONTH_LABELS } from '@/lib/format'
import { LoadingState, ErrorState, EmptyState, PageHeader } from './shared'

type ReportTab = 'profitability' | 'receivables' | 'payables' | 'cashflow' | 'ledger'

export function ReportsModule() {
  const [activeTab, setActiveTab] = useState<ReportTab>('profitability')
  
  // Date Filters
  const [pageFrom, setPageFrom] = useState('2024-04-01')
  const [pageTo, setPageTo] = useState('2024-09-30')

  // Profitability State
  const [profitabilityData, setProfitabilityData] = useState<any>(null)
  const [profLoading, setProfLoading] = useState(true)

  // Receivables Aging State
  const [receivablesData, setReceivablesData] = useState<any>(null)
  const [recLoading, setRecLoading] = useState(false)

  // Payables Aging State
  const [payablesData, setPayablesData] = useState<any>(null)
  const [payLoading, setPayLoading] = useState(false)

  // Cash Flow State
  const [cashFlowData, setCashFlowData] = useState<any>(null)
  const [cfLoading, setCfLoading] = useState(false)

  // Partner Ledger State
  const [partnerType, setPartnerType] = useState<'CLIENT' | 'VENDOR'>('CLIENT')
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('')
  const [clients, setClients] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [ledgerData, setLedgerData] = useState<any>(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerError, setLedgerError] = useState<string | null>(null)

  useEffect(() => {
    // Initial fetch of clients and vendors for Partner Ledger tab
    Promise.all([
      fetchJson<{ clients: any[] }>('/api/clients').catch(() => ({ clients: [] })),
      fetchJson<{ vendors: any[] }>('/api/vendors').catch(() => ({ vendors: [] })),
    ]).then(([c, v]) => {
      setClients(c.clients || [])
      setVendors(v.vendors || [])
      if (partnerType === 'CLIENT' && c.clients && c.clients.length > 0) {
        setSelectedPartnerId(c.clients[0].id)
      } else if (partnerType === 'VENDOR' && v.vendors && v.vendors.length > 0) {
        setSelectedPartnerId(v.vendors[0].id)
      }
    })
  }, [])

  function handlePartnerTypeChange(type: 'CLIENT' | 'VENDOR') {
    setPartnerType(type)
    setLedgerData(null)
    setLedgerError(null)
    if (type === 'CLIENT') {
      if (clients.length > 0) setSelectedPartnerId(clients[0].id)
      else setSelectedPartnerId('')
    } else {
      if (vendors.length > 0) setSelectedPartnerId(vendors[0].id)
      else setSelectedPartnerId('')
    }
  }

  // Fetch data based on active tab
  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    params.set('from', pageFrom)
    params.set('to', pageTo)

    if (activeTab === 'profitability') {
      fetchJson<any>(`/api/reports/profitability?${params.toString()}`)
        .then((d) => active && setProfitabilityData(d))
        .catch(() => {})
        .finally(() => active && setProfLoading(false))
    } else if (activeTab === 'receivables') {
      fetchJson<any>(`/api/reports/receivables-aging`)
        .then((d) => active && setReceivablesData(d.report))
        .catch(() => {})
        .finally(() => active && setRecLoading(false))
    } else if (activeTab === 'payables') {
      fetchJson<any>(`/api/reports/payables-aging`)
        .then((d) => active && setPayablesData(d.report))
        .catch(() => {})
        .finally(() => active && setPayLoading(false))
    } else if (activeTab === 'cashflow') {
      fetchJson<any>(`/api/reports/cash-flow?${params.toString()}`)
        .then((d) => active && setCashFlowData(d.statement))
        .catch(() => {})
        .finally(() => active && setCfLoading(false))
    } else if (activeTab === 'ledger' && selectedPartnerId) {
      fetchJson<any>(`/api/reports/partner-ledger?partnerType=${partnerType}&partnerId=${selectedPartnerId}&${params.toString()}`)
        .then((d) => {
          if (active) {
            setLedgerData(d.statement)
            setLedgerError(null)
          }
        })
        .catch((err) => {
          if (active) {
            setLedgerData(null)
            setLedgerError(err.message || 'Failed to load statement')
          }
        })
        .finally(() => active && setLedgerLoading(false))
    }

    return () => { active = false }
  }, [activeTab, pageFrom, pageTo, partnerType, selectedPartnerId])

  const periodLabel = `${formatDate(pageFrom)} – ${formatDate(pageTo)}`

  function handleExport(format: 'CSV' | 'PDF') {
    toast.success(`Exporting Drona Financial Report (${format})`, {
      description: `Report view: ${activeTab.toUpperCase()} · Period: ${periodLabel}`,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Intelligence & Financial Reports"
        subtitle={`Consolidated financial reports, receivables/payables aging, partner ledgers, and cash flow analysis`}
        action={
          <div className="flex items-center gap-2">
            <Button onClick={() => handleExport('CSV')} variant="outline" size="sm" className="h-9 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg gap-1.5">
              <Download className="h-4 w-4 text-[#08B6D8]" /> Export CSV
            </Button>
            <Button onClick={() => window.print()} size="sm" className="h-9 bg-[#0B2148] hover:bg-[#102B63] text-white text-xs font-semibold rounded-lg gap-1.5 shadow-sm">
              <Printer className="h-4 w-4 text-[#08B6D8]" /> Print Report
            </Button>
          </div>
        }
      />

      {/* Interactive Financial Report Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto scroll-thin bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('profitability')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 ${
            activeTab === 'profitability' ? 'bg-[#0B2148] text-white shadow-sm' : 'text-slate-600 hover:bg-white/60'
          }`}
        >
          <TrendingUp className="h-4 w-4 text-[#08B6D8]" /> Profitability Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('receivables')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 ${
            activeTab === 'receivables' ? 'bg-[#0B2148] text-white shadow-sm' : 'text-slate-600 hover:bg-white/60'
          }`}
        >
          <CalendarClock className="h-4 w-4 text-emerald-400" /> Receivables Aging
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('payables')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 ${
            activeTab === 'payables' ? 'bg-[#0B2148] text-white shadow-sm' : 'text-slate-600 hover:bg-white/60'
          }`}
        >
          <Receipt className="h-4 w-4 text-rose-400" /> Payables Aging
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cashflow')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 ${
            activeTab === 'cashflow' ? 'bg-[#0B2148] text-white shadow-sm' : 'text-slate-600 hover:bg-white/60'
          }`}
        >
          <Wallet className="h-4 w-4 text-[#08B6D8]" /> Cash Flow Statement
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 ${
            activeTab === 'ledger' ? 'bg-[#0B2148] text-white shadow-sm' : 'text-slate-600 hover:bg-white/60'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4 text-[#08B6D8]" /> Partner Ledger
        </button>
      </div>

      {/* TAB 1: PROFITABILITY OVERVIEW */}
      {activeTab === 'profitability' && (
        profLoading ? (
          <LoadingState label="Compiling profitability breakdown…" />
        ) : profitabilityData ? (
          <div className="space-y-6">
            <Card className="border border-[#08B6D8]/30 bg-gradient-to-r from-[#0B2148] via-[#102B63] to-[#0B2148] text-white shadow-xl rounded-2xl p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-white/10 border border-white/10 backdrop-blur">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Total Billed Revenue</div>
                  <div className="text-2xl font-extrabold text-white mt-1">{formatINR(profitabilityData.summary.revenue, true)}</div>
                </div>
                <div className="p-4 rounded-xl bg-white/10 border border-white/10 backdrop-blur">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Total Expenses & Labor</div>
                  <div className="text-2xl font-extrabold text-white mt-1">{formatINR(profitabilityData.summary.totalCost, true)}</div>
                </div>
                <div className="p-4 rounded-xl bg-[#08B6D8]/20 border border-[#08B6D8]/40 backdrop-blur">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#16C4E8]">Net Retained Profit</div>
                  <div className="text-2xl font-extrabold text-white mt-1">{formatINR(profitabilityData.summary.profit, true)}</div>
                </div>
                <div className="p-4 rounded-xl bg-white/10 border border-white/10 backdrop-blur">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#16C4E8]">Profit Margin Ratio</div>
                  <div className="text-2xl font-extrabold text-[#16C4E8] mt-1">{formatPercent(profitabilityData.summary.margin)}</div>
                </div>
              </div>
            </Card>

            <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
              <CardHeader className="p-5 border-b border-slate-100">
                <CardTitle className="text-base font-bold text-[#0B2148]">Profitability by Company Scope</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-left font-bold uppercase text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-4">Company</th>
                      <th className="py-3 px-4 text-right">Revenue</th>
                      <th className="py-3 px-4 text-right">Labor Cost</th>
                      <th className="py-3 px-4 text-right">Ops Cost</th>
                      <th className="py-3 px-4 text-right">Total Cost</th>
                      <th className="py-3 px-4 text-right">Net Profit</th>
                      <th className="py-3 px-4 text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {profitabilityData.rows.map((r: any) => (
                      <tr key={r.companyId} className="hover:bg-[#E8F8FC]/40">
                        <td className="py-3 px-4 font-bold text-[#0B2148]">{r.companyName}</td>
                        <td className="py-3 px-4 text-right font-bold text-[#08B6D8]">{formatINR(r.revenue, true)}</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-600">{formatINR(r.empCost, true)}</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-600">{formatINR(r.otherExpenses, true)}</td>
                        <td className="py-3 px-4 text-right font-bold text-rose-600">{formatINR(r.totalCost, true)}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-[#0B2148]">{formatINR(r.profit, true)}</td>
                        <td className="py-3 px-4 text-right"><Badge className="bg-[#08B6D8]/15 text-[#0B2148] font-bold">{formatPercent(r.margin)}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        ) : null
      )}

      {/* TAB 2: RECEIVABLES AGING REPORT */}
      {activeTab === 'receivables' && (
        recLoading ? (
          <LoadingState label="Calculating Receivables Aging buckets…" />
        ) : receivablesData ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <Card className="border border-slate-200 bg-white rounded-2xl p-4 text-center">
                <div className="text-[10px] uppercase font-bold text-slate-400">Current (Not Due)</div>
                <div className="text-xl font-extrabold text-[#0B2148] mt-1">{formatINR(receivablesData.buckets.current, true)}</div>
              </Card>
              <Card className="border border-amber-200 bg-amber-50/50 rounded-2xl p-4 text-center">
                <div className="text-[10px] uppercase font-bold text-amber-700">1–30 Days Overdue</div>
                <div className="text-xl font-extrabold text-amber-700 mt-1">{formatINR(receivablesData.buckets.days1To30, true)}</div>
              </Card>
              <Card className="border border-orange-200 bg-orange-50/50 rounded-2xl p-4 text-center">
                <div className="text-[10px] uppercase font-bold text-orange-700">31–60 Days Overdue</div>
                <div className="text-xl font-extrabold text-orange-700 mt-1">{formatINR(receivablesData.buckets.days31To60, true)}</div>
              </Card>
              <Card className="border border-rose-200 bg-rose-50/50 rounded-2xl p-4 text-center">
                <div className="text-[10px] uppercase font-bold text-rose-700">61–90 Days Overdue</div>
                <div className="text-xl font-extrabold text-rose-700 mt-1">{formatINR(receivablesData.buckets.days61To90, true)}</div>
              </Card>
              <Card className="border border-red-300 bg-red-100/60 rounded-2xl p-4 text-center">
                <div className="text-[10px] uppercase font-bold text-red-900">90+ Days Overdue</div>
                <div className="text-xl font-extrabold text-red-900 mt-1">{formatINR(receivablesData.buckets.days90Plus, true)}</div>
              </Card>
            </div>

            <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
              <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-[#0B2148]">Accounts Receivable Aging Ledger</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Total Outstanding Receivables: {formatINR(receivablesData.totalReceivables, true)}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-left font-bold uppercase text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Client Name</th>
                      <th className="py-3 px-4">Invoice Date</th>
                      <th className="py-3 px-4 text-right">Total Invoice</th>
                      <th className="py-3 px-4 text-right">Paid Amount</th>
                      <th className="py-3 px-4 text-right">Outstanding</th>
                      <th className="py-3 px-4 text-center">Days Overdue</th>
                      <th className="py-3 px-4 text-center">Aging Bucket</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receivablesData.invoices.map((inv: any) => (
                      <tr key={inv.revenueId} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-[#0B2148]">{inv.invoiceNo}</td>
                        <td className="py-3 px-4 font-bold text-[#0B2148]">{inv.clientName}</td>
                        <td className="py-3 px-4 text-slate-600">{formatDate(inv.invoiceDate)}</td>
                        <td className="py-3 px-4 text-right font-semibold">{formatINR(inv.totalAmount)}</td>
                        <td className="py-3 px-4 text-right text-emerald-600 font-semibold">{formatINR(inv.paidAmount)}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-[#08B6D8]">{formatINR(inv.outstandingAmount)}</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700">{inv.daysOverdue} days</td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={`text-[10px] font-bold ${
                            inv.bucket === 'CURRENT' ? 'bg-slate-100 text-slate-800' :
                            inv.bucket === '1-30 DAYS' ? 'bg-amber-100 text-amber-900' :
                            inv.bucket === '31-60 DAYS' ? 'bg-orange-100 text-orange-900' : 'bg-rose-100 text-rose-900'
                          }`}>{inv.bucket}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        ) : null
      )}

      {/* TAB 3: PAYABLES AGING REPORT */}
      {activeTab === 'payables' && (
        payLoading ? (
          <LoadingState label="Calculating Payables Aging buckets…" />
        ) : payablesData ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <Card className="border border-slate-200 bg-white rounded-2xl p-4 text-center">
                <div className="text-[10px] uppercase font-bold text-slate-400">Current Payables</div>
                <div className="text-xl font-extrabold text-[#0B2148] mt-1">{formatINR(payablesData.buckets.current, true)}</div>
              </Card>
              <Card className="border border-amber-200 bg-amber-50/50 rounded-2xl p-4 text-center">
                <div className="text-[10px] uppercase font-bold text-amber-700">1–30 Days</div>
                <div className="text-xl font-extrabold text-amber-700 mt-1">{formatINR(payablesData.buckets.days1To30, true)}</div>
              </Card>
              <Card className="border border-orange-200 bg-orange-50/50 rounded-2xl p-4 text-center">
                <div className="text-[10px] uppercase font-bold text-orange-700">31–60 Days</div>
                <div className="text-xl font-extrabold text-orange-700 mt-1">{formatINR(payablesData.buckets.days31To60, true)}</div>
              </Card>
              <Card className="border border-rose-200 bg-rose-50/50 rounded-2xl p-4 text-center">
                <div className="text-[10px] uppercase font-bold text-rose-700">61–90 Days</div>
                <div className="text-xl font-extrabold text-rose-700 mt-1">{formatINR(payablesData.buckets.days61To90, true)}</div>
              </Card>
              <Card className="border border-red-300 bg-red-100/60 rounded-2xl p-4 text-center">
                <div className="text-[10px] uppercase font-bold text-red-900">90+ Days</div>
                <div className="text-xl font-extrabold text-red-900 mt-1">{formatINR(payablesData.buckets.days90Plus, true)}</div>
              </Card>
            </div>

            <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
              <CardHeader className="p-5 border-b border-slate-100">
                <CardTitle className="text-base font-bold text-[#0B2148]">Accounts Payable Aging Ledger</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-left font-bold uppercase text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-4">Bill #</th>
                      <th className="py-3 px-4">Vendor Name</th>
                      <th className="py-3 px-4">Bill Date</th>
                      <th className="py-3 px-4 text-right">Total Bill</th>
                      <th className="py-3 px-4 text-right">Paid Amount</th>
                      <th className="py-3 px-4 text-right">Outstanding</th>
                      <th className="py-3 px-4 text-center">Aging Bucket</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payablesData.bills.length === 0 ? (
                      <tr><td colSpan={7} className="py-6 text-center text-slate-400">No vendor bills recorded.</td></tr>
                    ) : (
                      payablesData.bills.map((b: any) => (
                        <tr key={b.billId} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono font-bold text-[#0B2148]">{b.billNumber}</td>
                          <td className="py-3 px-4 font-bold text-[#0B2148]">{b.vendorName}</td>
                          <td className="py-3 px-4 text-slate-600">{formatDate(b.billDate)}</td>
                          <td className="py-3 px-4 text-right font-semibold">{formatINR(b.totalAmount)}</td>
                          <td className="py-3 px-4 text-right text-emerald-600 font-semibold">{formatINR(b.paidAmount)}</td>
                          <td className="py-3 px-4 text-right font-extrabold text-rose-600">{formatINR(b.outstandingAmount)}</td>
                          <td className="py-3 px-4 text-center"><Badge variant="outline">{b.bucket}</Badge></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        ) : null
      )}

      {/* TAB 4: CASH FLOW STATEMENT */}
      {activeTab === 'cashflow' && (
        cfLoading ? (
          <LoadingState label="Calculating Monthly Cash Flow (Inflows vs Outflows)…" />
        ) : cashFlowData ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border border-emerald-200 bg-emerald-50/50 rounded-2xl p-5">
                <div className="text-xs font-bold uppercase text-emerald-700">Total Cash Inflow</div>
                <div className="text-2xl font-extrabold text-emerald-700 mt-1">{formatINR(cashFlowData.summary.totalInflow, true)}</div>
              </Card>
              <Card className="border border-rose-200 bg-rose-50/50 rounded-2xl p-5">
                <div className="text-xs font-bold uppercase text-rose-700">Total Cash Outflow</div>
                <div className="text-2xl font-extrabold text-rose-700 mt-1">{formatINR(cashFlowData.summary.totalOutflow, true)}</div>
              </Card>
              <Card className="border border-[#08B6D8]/40 bg-[#E8F8FC]/60 rounded-2xl p-5">
                <div className="text-xs font-bold uppercase text-[#0B2148]">Net Cash Movement</div>
                <div className="text-2xl font-extrabold text-[#08B6D8] mt-1">{formatINR(cashFlowData.summary.netCashFlow, true)}</div>
              </Card>
            </div>

            <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
              <CardHeader className="p-5 border-b border-slate-100">
                <CardTitle className="text-base font-bold text-[#0B2148]">Monthly Cash Flow Statement</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-left font-bold uppercase text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-4">Month</th>
                      <th className="py-3 px-4 text-right">Cash Inflow (Payments Received)</th>
                      <th className="py-3 px-4 text-right">Vendor Outflow</th>
                      <th className="py-3 px-4 text-right">Expense Outflow</th>
                      <th className="py-3 px-4 text-right">Payroll Outflow</th>
                      <th className="py-3 px-4 text-right">Total Cash Outflow</th>
                      <th className="py-3 px-4 text-right">Net Cash Flow</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cashFlowData.monthly.map((row: any) => (
                      <tr key={row.yearMonth} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-[#0B2148]">{row.month}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-emerald-600">{formatINR(row.inflow, true)}</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-600">{formatINR(row.outflow.vendorPayments, true)}</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-600">{formatINR(row.outflow.expenses, true)}</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-600">{formatINR(row.outflow.employeeCosts, true)}</td>
                        <td className="py-3 px-4 text-right font-bold text-rose-600">{formatINR(row.outflow.totalOutflow, true)}</td>
                        <td className={`py-3 px-4 text-right font-extrabold text-sm ${row.netCashFlow >= 0 ? 'text-[#08B6D8]' : 'text-rose-600'}`}>
                          {formatINR(row.netCashFlow, true)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        ) : null
      )}

      {/* TAB 5: PARTNER LEDGER */}
      {activeTab === 'ledger' && (
        <div className="space-y-6">
          <Card className="border border-slate-200/80 bg-white p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => handlePartnerTypeChange('CLIENT')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg ${partnerType === 'CLIENT' ? 'bg-[#0B2148] text-white' : 'text-slate-600'}`}
                >
                  Client Account
                </button>
                <button
                  type="button"
                  onClick={() => handlePartnerTypeChange('VENDOR')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg ${partnerType === 'VENDOR' ? 'bg-[#0B2148] text-white' : 'text-slate-600'}`}
                >
                  Vendor Account
                </button>
              </div>

              {(partnerType === 'CLIENT' ? clients : vendors).length > 0 ? (
                <select
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  className="h-9 text-xs font-bold border-slate-200 rounded-lg px-3 bg-white focus:border-[#08B6D8]"
                >
                  {partnerType === 'CLIENT'
                    ? clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)
                    : vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              ) : (
                <span className="text-xs text-slate-400 italic">No partners available</span>
              )}
            </div>
          </Card>

          {ledgerLoading ? (
            <LoadingState label="Computing Partner Statement of Accounts…" />
          ) : ledgerError ? (
            <ErrorState message={ledgerError} />
          ) : ledgerData ? (
            <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
              <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-[#0B2148]">
                    Statement of Account — {ledgerData.partnerName} ({ledgerData.partnerCode})
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Running Balance Statement · Period: {ledgerData.period.from} to {ledgerData.period.to}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Closing Balance</div>
                  <div className="text-lg font-extrabold text-[#08B6D8]">{formatINR(ledgerData.closingBalance, true)}</div>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-left font-bold uppercase text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Reference #</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4 text-right">Debit (Dr)</th>
                      <th className="py-3 px-4 text-right">Credit (Cr)</th>
                      <th className="py-3 px-4 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledgerData.transactions.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-semibold text-slate-600">{formatDate(tx.date)}</td>
                        <td className="py-3 px-4 font-mono font-bold text-[#0B2148]">{tx.referenceNo}</td>
                        <td className="py-3 px-4"><Badge variant="outline">{tx.type}</Badge></td>
                        <td className="py-3 px-4 text-slate-600">{tx.description}</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-800">{tx.debit > 0 ? formatINR(tx.debit) : '—'}</td>
                        <td className="py-3 px-4 text-right font-semibold text-emerald-600">{tx.credit > 0 ? formatINR(tx.credit) : '—'}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-[#08B6D8]">{formatINR(tx.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : (
            <EmptyState title="No Ledger Selected" desc="Select a valid partner to view statement of accounts." />
          )}
        </div>
      )}
    </div>
  )
}
