'use client'

import { useEffect, useState } from 'react'
import {
  TrendingUp, TrendingDown, Percent, IndianRupee, Wallet, Receipt, Building2,
  Network, AlertCircle, Info, Download, Printer, Sparkles, ShieldCheck, SlidersHorizontal
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

type CompanyRow = {
  companyId: string
  companyName: string
  companyCode: string
  type: 'PARENT' | 'TENANT'
  revenue: number
  empCost: number
  otherExpenses: number
  totalCost: number
  profit: number
  margin: number
}

type Summary = {
  revenue: number
  empCost: number
  otherExpenses: number
  totalCost: number
  profit: number
  margin: number
}

type ReportData = { rows: CompanyRow[]; summary: Summary }

export function ReportsModule() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Page-scoped Local Filters for Reports
  const [pageFrom, setPageFrom] = useState('2024-04-01')
  const [pageTo, setPageTo] = useState('2024-09-30')

  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    params.set('from', pageFrom)
    params.set('to', pageTo)
    setLoading(true)
    fetchJson<ReportData>(`/api/reports/profitability?${params.toString()}`)
      .then((d) => {
        if (!active) return
        setData(d)
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

  const periodLabel = `${MONTH_LABELS[new Date(pageFrom).getMonth()]} ${new Date(pageFrom).getFullYear()} – ${MONTH_LABELS[new Date(pageTo).getMonth()]} ${new Date(pageTo).getFullYear()}`

  function handleExport(format: 'CSV' | 'PDF') {
    toast.success(`Exporting Drona Profitability Report (${format})`, {
      description: `Report period: ${periodLabel}`,
    })
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Intelligence & Financial Reports"
        subtitle={`Consolidated profitability calculation flow across all operating units · ${periodLabel}`}
        action={
          <div className="flex items-center gap-2">
            <Button onClick={() => handleExport('CSV')} variant="outline" size="sm" className="h-9 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg gap-1.5">
              <Download className="h-4 w-4 text-[#08B6D8]" /> Export CSV
            </Button>
            <Button onClick={handlePrint} size="sm" className="h-9 bg-[#0B2148] hover:bg-[#102B63] text-white text-xs font-semibold rounded-lg gap-1.5 shadow-sm">
              <Printer className="h-4 w-4 text-[#08B6D8]" /> Print Executive Summary
            </Button>
          </div>
        }
      />

      {/* Reports Page-Level Local Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[#0B2148]">
          <SlidersHorizontal className="h-4 w-4 text-[#08B6D8]" /> Report Period Filter
          <span className="text-[11px] font-normal text-slate-400">(Applies exclusively to Reports page)</span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500 text-[11px]">From Date:</span>
            <Input
              type="date"
              value={pageFrom}
              onChange={(e) => setPageFrom(e.target.value)}
              className="h-8 text-xs w-32 rounded-lg border-slate-200"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500 text-[11px]">To Date:</span>
            <Input
              type="date"
              value={pageTo}
              onChange={(e) => setPageTo(e.target.value)}
              className="h-8 text-xs w-32 rounded-lg border-slate-200"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Compiling business intelligence report…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : !data ? null : (
        <>
          {/* Calculation Flow Header Banner */}
          <Card className="border border-[#08B6D8]/30 bg-gradient-to-r from-[#0B2148] via-[#102B63] to-[#0B2148] text-white shadow-xl rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <div className="text-xs font-bold uppercase tracking-wider text-[#16C4E8] mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Executive Profitability Accounting Flow
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-white/10 border border-white/10 backdrop-blur">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Total Billed Revenue</div>
                  <div className="text-2xl font-extrabold text-white mt-1">{formatINR(data.summary.revenue, true)}</div>
                  <div className="text-[10px] text-slate-300 mt-1">Gross client invoicing</div>
                </div>

                <div className="p-4 rounded-xl bg-white/10 border border-white/10 backdrop-blur">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Total Subtotal Cost</div>
                  <div className="text-2xl font-extrabold text-white mt-1">{formatINR(data.summary.totalCost, true)}</div>
                  <div className="text-[10px] text-slate-300 mt-1 flex items-center gap-2">
                    <span>Emp {formatINR(data.summary.empCost, true)}</span>
                    <span>•</span>
                    <span>Ops {formatINR(data.summary.otherExpenses, true)}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#08B6D8]/20 border border-[#08B6D8]/40 backdrop-blur">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#16C4E8]">Net Retained Profit</div>
                  <div className="text-2xl font-extrabold text-white mt-1">{formatINR(data.summary.profit, true)}</div>
                  <div className="text-[10px] text-[#16C4E8] mt-1">Revenue minus total costs</div>
                </div>

                <div className="p-4 rounded-xl bg-white/10 border border-white/10 backdrop-blur">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#16C4E8]">Profit Margin Ratio</div>
                  <div className="text-2xl font-extrabold text-[#16C4E8] mt-1">{formatPercent(data.summary.margin)}</div>
                  <div className="w-full bg-white/20 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-[#08B6D8] h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, data.summary.margin))}%` }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Per-Company Comparison Table */}
          <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#0B2148]">Profitability by Company Scope</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Consolidated financial breakdown across parent group and active tenant business units
                </CardDescription>
              </div>
              <Badge className="bg-[#0B2148] text-white text-xs px-2.5 py-1">
                {data.rows.length} Companies Connected
              </Badge>
            </CardHeader>

            <CardContent className="p-0">
              {data.rows.length === 0 ? (
                <EmptyState title="No financial data" desc="No logs present for the selected period." />
              ) : (
                <div className="overflow-x-auto scroll-thin">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <th className="py-3 px-4">Company Name</th>
                        <th className="py-3 px-4">Entity Type</th>
                        <th className="py-3 px-4 text-right">Billed Revenue</th>
                        <th className="py-3 px-4 text-right">Employee Labor Cost</th>
                        <th className="py-3 px-4 text-right">Ops Expenses</th>
                        <th className="py-3 px-4 text-right">Total Cost</th>
                        <th className="py-3 px-4 text-right">Net Profit</th>
                        <th className="py-3 px-4 text-right">Profit Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.rows.map((row) => {
                        const isParent = row.type === 'PARENT'
                        return (
                          <tr key={row.companyId} className={`hover:bg-[#E8F8FC]/40 transition ${isParent ? 'bg-[#0B2148]/5 font-bold' : ''}`}>
                            <td className="py-3 px-4 font-bold text-[#0B2148]">
                              <div className="flex items-center gap-2.5">
                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                                  isParent ? 'bg-[#0B2148] text-white' : 'bg-[#08B6D8]/15 text-[#0B2148]'
                                }`}>
                                  {isParent ? <Network className="h-4 w-4 text-[#08B6D8]" /> : <Building2 className="h-4 w-4" />}
                                </div>
                                <div>
                                  <div className="font-bold text-[#0B2148] text-sm">{row.companyName}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{row.companyCode}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={`text-[10px] font-bold ${isParent ? 'bg-[#0B2148] text-white' : 'bg-[#08B6D8]/15 text-[#0B2148]'}`}>
                                {row.type}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-[#08B6D8] text-sm">{formatINR(row.revenue, true)}</td>
                            <td className="py-3 px-4 text-right font-semibold text-slate-600">{formatINR(row.empCost, true)}</td>
                            <td className="py-3 px-4 text-right font-semibold text-slate-600">{formatINR(row.otherExpenses, true)}</td>
                            <td className="py-3 px-4 text-right font-bold text-rose-600">{formatINR(row.totalCost, true)}</td>
                            <td className={`py-3 px-4 text-right font-extrabold text-sm ${row.profit >= 0 ? 'text-[#0B2148]' : 'text-rose-600'}`}>
                              {formatINR(row.profit, true)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Badge className={`text-[10px] font-bold ${
                                row.margin >= 50 ? 'bg-emerald-100 text-emerald-800' : 'bg-[#08B6D8]/20 text-[#0B2148]'
                              }`}>
                                {formatPercent(row.margin)}
                              </Badge>
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
        </>
      )}
    </div>
  )
}
