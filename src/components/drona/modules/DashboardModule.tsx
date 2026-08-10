'use client'

import { useEffect, useState } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Legend, LineChart, Line, Area, ComposedChart
} from 'recharts'
import {
  IndianRupee, TrendingUp, TrendingDown, Percent, Wallet, Receipt, Building2, Users, ChevronRight
} from 'lucide-react'
import { useApp, fetchJson } from '@/lib/app-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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

export function DashboardModule() {
  const { user, filterCompanyId, filterLocationId, filterClientTypeId, filterFrom, filterTo } = useApp()
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (filterCompanyId) params.set('companyId', filterCompanyId)
    if (filterLocationId) params.set('locationId', filterLocationId)
    if (filterClientTypeId) params.set('clientTypeId', filterClientTypeId)
    params.set('from', filterFrom)
    params.set('to', filterTo)
    ;(async () => {
      try {
        const d = await fetchJson<Dashboard>(`/api/dashboard?${params.toString()}`)
        if (!active) return
        setData(d)
        setError(null)
      } catch (e: any) {
        if (!active) return
        setError(e.message || 'Failed to load')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [filterCompanyId, filterLocationId, filterClientTypeId, filterFrom, filterTo])

  if (loading) return <LoadingState label="Crunching numbers…" />
  if (error) return <ErrorState message={error} />
  if (!data) return null

  const kpis = data.kpis
  const kpiCards = [
    { label: 'Total Revenue', value: formatINR(kpis.totalRevenue, true), icon: IndianRupee, tone: 'emerald' as const, sub: 'Gross billed amount' },
    { label: 'Total Cost', value: formatINR(kpis.totalCost, true), icon: TrendingDown, tone: 'rose' as const, sub: `Emp cost ${formatINR(kpis.totalEmpCost, true)} + Other ${formatINR(kpis.totalExpenses, true)}` },
    { label: 'Total Profit', value: formatINR(kpis.totalProfit, true), icon: TrendingUp, tone: 'blue' as const, sub: 'Revenue minus all costs' },
    { label: 'Profit Margin', value: formatPercent(kpis.profitMargin), icon: Percent, tone: 'amber' as const, sub: 'Of total revenue' },
  ]

  return (
    <div className="space-y-6">
      {/* Header summary */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Profitability Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Period · {MONTH_LABELS[new Date(filterFrom).getMonth()]}–{MONTH_LABELS[new Date(filterTo).getMonth()]} {new Date(filterFrom).getFullYear()}
            {user?.role === 'GROUP_ADMIN' && filterCompanyId === null ? ' · Consolidated view' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-background">
            <Building2 className="h-3 w-3 mr-1" />
            {filterCompanyId ? data.companies.find((c) => c.id === filterCompanyId)?.name ?? 'Tenant' : `${data.companies.length} companies`}
          </Badge>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map((k) => {
          const Icon = k.icon
          const toneClasses: Record<typeof k.tone, string> = {
            emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
            rose: 'bg-rose-50 text-rose-700 ring-rose-200',
            blue: 'bg-blue-50 text-blue-700 ring-blue-200',
            amber: 'bg-amber-50 text-amber-700 ring-amber-200',
          }
          return (
            <Card key={k.label} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{k.label}</div>
                    <div className="text-2xl font-bold mt-1.5 tracking-tight">{k.value}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">{k.sub}</div>
                  </div>
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ring-1 ${toneClasses[k.tone]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Profitability flow visual (mirrors the diagram) */}
      <Card className="bg-muted/40 border-dashed">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 text-sm">
            <div className="flex-1 rounded-lg bg-emerald-50 ring-1 ring-emerald-200 p-3 text-emerald-900">
              <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold">Total Revenue (Income)</div>
              <div className="text-lg font-bold">{formatINR(kpis.totalRevenue, true)}</div>
            </div>
            <div className="text-xl font-bold text-muted-foreground px-2 text-center">−</div>
            <div className="flex-1 rounded-lg bg-rose-50 ring-1 ring-rose-200 p-3 text-rose-900">
              <div className="text-[10px] uppercase tracking-wide text-rose-700 font-semibold">Total Cost</div>
              <div className="text-lg font-bold">{formatINR(kpis.totalCost, true)}</div>
              <div className="text-[10px] text-rose-700/80 mt-0.5 flex items-center gap-2">
                <span className="flex items-center gap-1"><Wallet className="h-3 w-3" /> Emp {formatINR(kpis.totalEmpCost, true)}</span>
                <span className="flex items-center gap-1"><Receipt className="h-3 w-3" /> Other {formatINR(kpis.totalExpenses, true)}</span>
              </div>
            </div>
            <div className="text-xl font-bold text-muted-foreground px-2 text-center">=</div>
            <div className="flex-1 rounded-lg bg-primary text-primary-foreground p-3">
              <div className="text-[10px] uppercase tracking-wide opacity-80 font-semibold">Profit</div>
              <div className="text-lg font-bold">{formatINR(kpis.totalProfit, true)}</div>
            </div>
            <div className="text-xl font-bold text-muted-foreground px-2 text-center">→</div>
            <div className="flex-1 rounded-lg bg-amber-50 ring-1 ring-amber-300 p-3 text-amber-900">
              <div className="text-[10px] uppercase tracking-wide text-amber-700 font-semibold">Profit Margin</div>
              <div className="text-lg font-bold">{formatPercent(kpis.profitMargin)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts grid 2x2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue by client donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue by Client</CardTitle>
            <CardDescription className="text-xs">Share of total billed amount per client</CardDescription>
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
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {data.revenueByClient.map((entry, i) => (
                      <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any) => formatINR(Number(v), true)}
                    contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid var(--border)' }}
                  />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, lineHeight: '16px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Cost by category donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cost by Category</CardTitle>
            <CardDescription className="text-xs">Employee cost types + operational expenses</CardDescription>
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
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {data.costByCategory.map((entry, i) => (
                      <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any) => formatINR(Number(v), true)}
                    contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid var(--border)' }}
                  />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, lineHeight: '16px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Profit by client bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Profit by Client</CardTitle>
            <CardDescription className="text-xs">Revenue minus allocated cost, per client</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.profitByClient} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="client" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={50} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatINR(Number(v), true).replace('₹ ', '')} stroke="var(--muted-foreground)" />
                  <Tooltip formatter={(v: any) => formatINR(Number(v), true)} contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid var(--border)' }} />
                  <Bar dataKey="profit" name="Profit" radius={[4, 4, 0, 0]}>
                    {data.profitByClient.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Profit trend line */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Profit Trend (Monthly)</CardTitle>
            <CardDescription className="text-xs">Revenue vs Cost vs Profit over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.profitTrend} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatINR(Number(v), true).replace('₹ ', '')} stroke="var(--muted-foreground)" />
                  <Tooltip formatter={(v: any) => formatINR(Number(v), true)} contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid var(--border)' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                  <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[3, 3, 0, 0]} barSize={12} />
                  <Bar dataKey="cost" name="Cost" fill="#ef4444" radius={[3, 3, 0, 0]} barSize={12} />
                  <Line type="monotone" dataKey="profit" name="Profit" stroke="#1e3a8a" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profit by client detail table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Client Profitability Breakdown</CardTitle>
          <CardDescription className="text-xs">Per-client revenue, allocated cost and resulting profit</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b">
                  <th className="py-2 pr-4 font-medium">Client</th>
                  <th className="py-2 pr-4 font-medium text-right">Revenue</th>
                  <th className="py-2 pr-4 font-medium text-right">Cost (Allocated)</th>
                  <th className="py-2 pr-4 font-medium text-right">Profit</th>
                  <th className="py-2 pr-4 font-medium text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {data.profitByClient.map((row) => {
                  const margin = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0
                  return (
                    <tr key={row.client} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-2 pr-4 font-medium flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        {row.client}
                      </td>
                      <td className="py-2 pr-4 text-right text-emerald-700">{formatINR(row.revenue, true)}</td>
                      <td className="py-2 pr-4 text-right text-rose-700">{formatINR(row.cost, true)}</td>
                      <td className="py-2 pr-4 text-right font-semibold">{formatINR(row.profit, true)}</td>
                      <td className="py-2 pr-4 text-right">
                        <Badge variant={margin > 50 ? 'default' : margin > 20 ? 'secondary' : 'outline'}>
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
    </div>
  )
}
