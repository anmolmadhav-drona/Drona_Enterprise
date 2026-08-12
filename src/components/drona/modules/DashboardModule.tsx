'use client'

import { useEffect, useState } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Legend, LineChart, Line, ComposedChart
} from 'recharts'
import {
  IndianRupee, TrendingUp, TrendingDown, Percent, Wallet, Receipt, Building2, Users, ArrowRight, Sparkles, ShieldCheck, Plus, ArrowUpRight, Filter, Calendar, MapPin, SlidersHorizontal, RefreshCw
} from 'lucide-react'
import { useApp, fetchJson } from '@/lib/app-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { formatINR, formatPercent, CHART_COLORS, MONTH_LABELS } from '@/lib/format'
import { LoadingState, ErrorState } from './shared'

type Dashboard = {
  range: { from: string; to: string }
  kpis: {
    totalRevenue: number
    totalCost: number
    totalProfit: number
    profitMargin: number
    totalEmpCost: number
    totalExpenses: number
  }
  revenueByClient: { name: string; value: number; color: string }[]
  costByCategory: { name: string; value: number; color: string }[]
  profitByClient: { client: string; revenue: number; cost: number; profit: number }[]
  profitTrend: { month: string; revenue: number; cost: number; profit: number }[]
  companies: { id: string; name: string; code: string; type: string }[]
}

type LocationItem = { id: string; name: string }
type ClientTypeItem = { id: string; name: string }

export function DashboardModule() {
  const { user, setActiveModule } = useApp()
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Local Page-Level Filter State (Applies ONLY to Dashboard page)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [locationId, setLocationId] = useState<string | null>(null)
  const [clientTypeId, setClientTypeId] = useState<string | null>(null)
  const [from, setFrom] = useState('2024-04-01')
  const [to, setTo] = useState('2024-09-30')

  // Master options for page filter
  const [locations, setLocations] = useState<LocationItem[]>([])
  const [clientTypes, setClientTypes] = useState<ClientTypeItem[]>([])

  const isGroupAdmin = user?.role === 'GROUP_ADMIN'

  // Fetch location & client type options on mount
  useEffect(() => {
    ;(async () => {
      try {
        const [l, t] = await Promise.all([
          fetchJson<{ items: LocationItem[] }>('/api/locations').then((r) => r.items),
          fetchJson<{ items: ClientTypeItem[] }>('/api/client-types').then((r) => r.items),
        ])
        setLocations(l)
        setClientTypes(t)
      } catch {}
    })()
  }, [])

  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (companyId) params.set('companyId', companyId)
    if (locationId) params.set('locationId', locationId)
    if (clientTypeId) params.set('clientTypeId', clientTypeId)
    params.set('from', from)
    params.set('to', to)
    ;(async () => {
      try {
        setLoading(true)
        const d = await fetchJson<Dashboard>(`/api/dashboard?${params.toString()}`)
        if (!active) return
        setData(d)
        setError(null)
      } catch (e: any) {
        if (!active) return
        setError(e.message || 'Failed to load dashboard metrics')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [companyId, locationId, clientTypeId, from, to])

  const kpis = data?.kpis ?? {
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    profitMargin: 0,
    totalEmpCost: 0,
    totalExpenses: 0,
  }

  const kpiCards = [
    {
      label: 'TOTAL REVENUE',
      value: formatINR(kpis.totalRevenue, true),
      icon: IndianRupee,
      tone: 'cyan' as const,
      sub: 'Gross billed contracts & invoices',
      color: '#08B6D8',
      bg: 'bg-[#E8F8FC]',
    },
    {
      label: 'TOTAL COST',
      value: formatINR(kpis.totalCost, true),
      icon: TrendingDown,
      tone: 'rose' as const,
      sub: `Emp: ${formatINR(kpis.totalEmpCost, true)} + Ops: ${formatINR(kpis.totalExpenses, true)}`,
      color: '#DC2626',
      bg: 'bg-rose-50',
    },
    {
      label: 'NET PROFIT',
      value: formatINR(kpis.totalProfit, true),
      icon: TrendingUp,
      tone: 'navy' as const,
      sub: 'Net operational financial gain',
      color: '#0B2148',
      bg: 'bg-slate-100',
    },
    {
      label: 'PROFIT MARGIN',
      value: formatPercent(kpis.profitMargin),
      icon: Percent,
      tone: 'blue' as const,
      sub: 'Retained profitability ratio',
      color: '#2563EB',
      bg: 'bg-blue-50',
    },
  ]

  // Palette array matching brand design system
  const DRONA_CHART_COLORS = ['#08B6D8', '#0B2148', '#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626']

  return (
    <div className="space-y-6">
      {/* Dashboard Top Header & Quick Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#08B6D8] uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" /> Operational Command View
          </div>
          <h2 className="text-2xl font-extrabold text-[#0B2148] tracking-tight mt-0.5">
            Profitability Overview
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Period · {MONTH_LABELS[new Date(from).getMonth()]}–{MONTH_LABELS[new Date(to).getMonth()]} {new Date(from).getFullYear()}
            {isGroupAdmin && companyId === null ? ' · Consolidated Enterprise Scope' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="h-8 px-3 text-xs bg-slate-50 border-slate-200 text-[#0B2148] font-semibold gap-1.5 rounded-lg">
            <Building2 className="h-3.5 w-3.5 text-[#08B6D8]" />
            {companyId ? data?.companies.find((c) => c.id === companyId)?.name ?? 'Company Scope' : `${data?.companies.length ?? 0} Companies Connected`}
          </Badge>

          <Button onClick={() => setActiveModule('revenue')} size="sm" className="h-8 bg-[#0B2148] text-white hover:bg-[#102B63] text-xs font-semibold rounded-lg gap-1">
            <Plus className="h-3.5 w-3.5" /> Billed Revenue
          </Button>

          <Button onClick={() => setActiveModule('expenses')} size="sm" variant="outline" className="h-8 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg gap-1">
            <Plus className="h-3.5 w-3.5 text-rose-600" /> Operational Expense
          </Button>
        </div>
      </div>

      {/* Dashboard Page-Specific Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0B2148]">
            <SlidersHorizontal className="h-4 w-4 text-[#08B6D8]" /> Dashboard Page Filters
            <span className="text-[11px] font-normal text-slate-400">(Applies exclusively to this view)</span>
          </div>
          {(companyId || locationId || clientTypeId || from !== '2024-04-01' || to !== '2024-09-30') && (
            <button
              onClick={() => {
                setCompanyId(null)
                setLocationId(null)
                setClientTypeId(null)
                setFrom('2024-04-01')
                setTo('2024-09-30')
              }}
              className="text-[11px] font-semibold text-[#08B6D8] hover:text-[#0B2148] flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Company Scope Filter */}
          {isGroupAdmin && (
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-600">Company Scope</Label>
              <Select value={companyId ?? 'all'} onValueChange={(v) => setCompanyId(v === 'all' ? null : v)}>
                <SelectTrigger className="h-8 text-xs rounded-lg border-slate-200">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies (Consolidated)</SelectItem>
                  {data?.companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Location Filter */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-600">Location</Label>
            <Select value={locationId ?? 'all'} onValueChange={(v) => setLocationId(v === 'all' ? null : v)}>
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

          {/* Client Type Filter */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-600">Client Type</Label>
            <Select value={clientTypeId ?? 'all'} onValueChange={(v) => setClientTypeId(v === 'all' ? null : v)}>
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

          {/* From Date */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-600">From Date</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 text-xs rounded-lg border-slate-200"
            />
          </div>

          {/* To Date */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-600">To Date</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 text-xs rounded-lg border-slate-200"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Analyzing connected financial telemetry…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : !data ? null : (
        <>
          {/* 4 KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {kpiCards.map((k) => {
              const Icon = k.icon
              return (
                <Card key={k.label} className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden hover:shadow-md hover:border-[#08B6D8]/50 transition-all duration-200">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</div>
                        <div className="text-2xl font-extrabold text-[#0B2148] tracking-tight mt-1.5">{k.value}</div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                          {k.sub}
                        </div>
                      </div>
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${k.bg} shrink-0`} style={{ color: k.color }}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Profitability Flow Formula Banner */}
          <Card className="border border-[#08B6D8]/30 bg-gradient-to-r from-[#0B2148] via-[#102B63] to-[#0B2148] text-white shadow-md rounded-2xl overflow-hidden">
            <CardContent className="p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-[#16C4E8] mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Live Profitability Calculation Formula
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-3">
                <div className="p-3.5 rounded-xl bg-white/10 border border-white/10 backdrop-blur">
                  <div className="text-[10px] font-semibold text-emerald-400 uppercase">Gross Billed Revenue</div>
                  <div className="text-xl font-extrabold text-white mt-0.5">{formatINR(kpis.totalRevenue, true)}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/10 border border-white/10 backdrop-blur">
                  <div className="text-[10px] font-semibold text-rose-400 uppercase">Subtotal Allocated Cost</div>
                  <div className="text-xl font-extrabold text-white mt-0.5">{formatINR(kpis.totalCost, true)}</div>
                  <div className="text-[10px] text-slate-300 mt-1 flex items-center gap-2">
                    <span>Emp {formatINR(kpis.totalEmpCost, true)}</span>
                    <span>•</span>
                    <span>Ops {formatINR(kpis.totalExpenses, true)}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#08B6D8]/20 border border-[#08B6D8]/40 backdrop-blur">
                  <div className="text-[10px] font-semibold text-[#16C4E8] uppercase">Net Profit Margin</div>
                  <div className="text-xl font-extrabold text-white mt-0.5">{formatINR(kpis.totalProfit, true)}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/10 border border-white/10 backdrop-blur">
                  <div className="text-[10px] font-semibold text-[#16C4E8] uppercase">Profitability Ratio</div>
                  <div className="text-xl font-extrabold text-[#16C4E8] mt-0.5">{formatPercent(kpis.profitMargin)}</div>
                  {/* Visual Progress Bar */}
                  <div className="w-full bg-white/20 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-[#08B6D8] h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, kpis.profitMargin))}%` }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Charts Grid 2x2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Financial Trend Chart */}
            <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-[#0B2148]">Monthly Profit Trend</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Billed Revenue vs Total Cost vs Net Profit over time</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.profitTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => formatINR(Number(v), true).replace('₹ ', '')} />
                      <Tooltip formatter={(v: any) => formatINR(Number(v), true)} contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
                      <Bar dataKey="revenue" name="Revenue" fill="#08B6D8" radius={[4, 4, 0, 0]} barSize={14} />
                      <Bar dataKey="cost" name="Cost" fill="#DC2626" radius={[4, 4, 0, 0]} barSize={14} />
                      <Line type="monotone" dataKey="profit" name="Net Profit" stroke="#0B2148" strokeWidth={2.5} dot={{ r: 4, fill: '#0B2148' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Revenue Share by Client Donut */}
            <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-[#0B2148]">Revenue by Client</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Distribution of gross billed contracts per client</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.revenueByClient}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {data.revenueByClient.map((entry, i) => (
                          <Cell key={i} fill={DRONA_CHART_COLORS[i % DRONA_CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatINR(Number(v), true)} contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #E2E8F0' }} />
                      <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Cost Breakdown Donut + Categories */}
            <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-[#0B2148]">Cost Structure Breakdown</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Workforce allocations + operational expense categories</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.costByCategory}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {data.costByCategory.map((entry, i) => (
                          <Cell key={i} fill={DRONA_CHART_COLORS[i % DRONA_CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatINR(Number(v), true)} contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #E2E8F0' }} />
                      <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Profit by Client Bar Chart */}
            <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-[#0B2148]">Profit Contribution by Client</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Net earnings per client after labor cost allocation</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.profitByClient} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="client" tick={{ fontSize: 10, fill: '#64748B' }} interval={0} angle={-15} textAnchor="end" height={45} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(v) => formatINR(Number(v), true).replace('₹ ', '')} />
                      <Tooltip formatter={(v: any) => formatINR(Number(v), true)} contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #E2E8F0' }} />
                      <Bar dataKey="profit" name="Net Profit" radius={[4, 4, 0, 0]}>
                        {data.profitByClient.map((_, i) => (
                          <Cell key={i} fill={DRONA_CHART_COLORS[i % DRONA_CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Per-Client Profitability Master Table */}
          <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-[#0B2148]">Client Profitability Roster</CardTitle>
                <CardDescription className="text-xs text-slate-500">Detailed breakdown of client contract revenue, cost allocation, and net margin %</CardDescription>
              </div>
              <Button onClick={() => setActiveModule('reports')} variant="outline" size="sm" className="h-8 text-xs font-semibold border-slate-200 text-[#0B2148] gap-1">
                View Full Report <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-4">Client Name</th>
                      <th className="py-3 px-4 text-right">Billed Revenue</th>
                      <th className="py-3 px-4 text-right">Allocated Labor Cost</th>
                      <th className="py-3 px-4 text-right">Net Profit</th>
                      <th className="py-3 px-4 text-right">Profit Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.profitByClient.map((row) => {
                      const margin = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0
                      return (
                        <tr key={row.client} className="hover:bg-[#E8F8FC]/40 transition">
                          <td className="py-3 px-4 font-bold text-[#0B2148] flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-lg bg-[#0B2148]/10 text-[#0B2148] flex items-center justify-center font-bold text-xs">
                              {row.client.slice(0, 2).toUpperCase()}
                            </div>
                            {row.client}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-[#08B6D8]">{formatINR(row.revenue, true)}</td>
                          <td className="py-3 px-4 text-right font-semibold text-rose-600">{formatINR(row.cost, true)}</td>
                          <td className="py-3 px-4 text-right font-bold text-[#0B2148]">{formatINR(row.profit, true)}</td>
                          <td className="py-3 px-4 text-right">
                            <Badge className={`text-[10px] font-bold ${
                              margin >= 50
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : margin >= 20
                                ? 'bg-[#08B6D8]/20 text-[#0B2148] border-[#08B6D8]/40'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                            }`}>
                              {formatPercent(margin)}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
