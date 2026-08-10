'use client'

import { useEffect, useState } from 'react'
import {
  TrendingUp, TrendingDown, Percent, IndianRupee, Wallet, Receipt, Building2,
  Network, AlertCircle, Info,
} from 'lucide-react'

import { useApp, fetchJson } from '@/lib/app-store'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatINR, formatPercent, formatDate, MONTH_LABELS } from '@/lib/format'
import { LoadingState, ErrorState, EmptyState, PageHeader } from './shared'

// ---- Types -----------------------------------------------------------------

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

// ---- Component -------------------------------------------------------------

export function ReportsModule() {
  const { filterFrom, filterTo } = useApp()

  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    params.set('from', filterFrom)
    params.set('to', filterTo)
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
  }, [filterFrom, filterTo])

  if (loading) return <LoadingState label="Building profitability report…" />
  if (error) return <ErrorState message={error} />
  if (!data) return null

  const { rows, summary } = data

  // Order: PARENT row first, then tenants by name.
  const parents = rows.filter((r) => r.type === 'PARENT')
  const tenants = rows.filter((r) => r.type === 'TENANT').sort((a, b) => a.companyName.localeCompare(b.companyName))
  const ordered = [...parents, ...tenants]

  const periodLabel = `${MONTH_LABELS[new Date(filterFrom).getMonth()]} ${new Date(filterFrom).getFullYear()} – ${MONTH_LABELS[new Date(filterTo).getMonth()]} ${new Date(filterTo).getFullYear()}`

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profitability Report"
        subtitle={`Revenue − Cost = Profit → Margin, by company · ${periodLabel}`}
      />

      {/* Calculation flow banner */}
      <Card className="bg-muted/40 border-dashed">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 text-sm">
            <FlowBox
              tone="emerald"
              label="Total Revenue"
              value={formatINR(summary.revenue, true)}
              icon={<IndianRupee className="h-3 w-3" />}
              sub="Income billed across all tenants"
            />
            <div className="text-xl font-bold text-muted-foreground px-2 text-center">−</div>
            <FlowBox
              tone="rose"
              label="Total Cost"
              value={formatINR(summary.totalCost, true)}
              icon={<TrendingDown className="h-3 w-3" />}
              sub={
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1"><Wallet className="h-3 w-3" /> Emp {formatINR(summary.empCost, true)}</span>
                  <span className="flex items-center gap-1"><Receipt className="h-3 w-3" /> Other {formatINR(summary.otherExpenses, true)}</span>
                </div>
              }
            />
            <div className="text-xl font-bold text-muted-foreground px-2 text-center">=</div>
            <FlowBox
              tone="primary"
              label="Profit"
              value={formatINR(summary.profit, true)}
              icon={<TrendingUp className="h-3 w-3" />}
              sub="Revenue minus all costs"
            />
            <div className="text-xl font-bold text-muted-foreground px-2 text-center">→</div>
            <FlowBox
              tone="amber"
              label="Profit Margin"
              value={formatPercent(summary.margin)}
              icon={<Percent className="h-3 w-3" />}
              sub="Of total revenue"
            />
          </div>
        </CardContent>
      </Card>

      {/* Per-company table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Profitability by Company</CardTitle>
          <CardDescription className="text-xs">
            Consolidated per-company breakdown for {formatDate(filterFrom)} – {formatDate(filterTo)}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {ordered.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No data for this period"
                desc="No revenue, employee costs or expenses recorded in the selected date range."
                icon={<AlertCircle className="h-8 w-8 text-muted-foreground/60" />}
              />
            </div>
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="pl-4">Company</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Employee Cost</TableHead>
                    <TableHead className="text-right">Other Expenses</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right pr-4">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordered.map((row) => {
                    const isParent = row.type === 'PARENT'
                    return (
                      <TableRow
                        key={row.companyId}
                        className={`hover:bg-muted/40 ${isParent ? 'bg-muted/50 font-semibold' : ''}`}
                      >
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${
                                isParent
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                              }`}
                            >
                              {isParent ? <Network className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                            </div>
                            <div className="leading-tight">
                              <div className="text-sm font-medium">{row.companyName}</div>
                              <Badge variant="secondary" className="font-mono text-[10px] mt-0.5">
                                {row.companyCode}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isParent ? (
                            <Badge variant="default">Parent</Badge>
                          ) : (
                            <Badge variant="outline">Tenant</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-emerald-700 tabular-nums">
                          {formatINR(row.revenue, true)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatINR(row.empCost, true)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatINR(row.otherExpenses, true)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-rose-700">
                          {formatINR(row.totalCost, true)}
                        </TableCell>
                        <TableCell className={`text-right tabular-nums font-semibold ${row.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {formatINR(row.profit, true)}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <MarginBadge margin={row.margin} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" /> Cost breakdown
          </CardTitle>
          <CardDescription className="text-xs">
            What's included in “Total Cost” for each company.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <CostBreakdownItem
            title="Employee Cost"
            total={summary.empCost}
            description="Salaries and wages for all employees of the company, allocated to clients based on the Employee-Client Allocation % defined for each employee."
            icon={<Wallet className="h-4 w-4" />}
            tone="rose"
          />
          <CostBreakdownItem
            title="Other Expenses"
            total={summary.otherExpenses}
            description="Operational overheads — Rent, Utilities, Travel, Maintenance, Marketing, Office Supplies, Insurance, Professional Fees, Misc — booked against the company during the period."
            icon={<Receipt className="h-4 w-4" />}
            tone="amber"
          />
        </CardContent>
      </Card>
    </div>
  )
}

// ---- Sub-components --------------------------------------------------------

function FlowBox({
  tone,
  label,
  value,
  icon,
  sub,
}: {
  tone: 'emerald' | 'rose' | 'primary' | 'amber'
  label: string
  value: string
  icon: React.ReactNode
  sub?: React.ReactNode
}) {
  const toneClasses: Record<typeof tone, string> = {
    emerald: 'bg-emerald-50 ring-1 ring-emerald-200 text-emerald-900',
    rose: 'bg-rose-50 ring-1 ring-rose-200 text-rose-900',
    primary: 'bg-primary text-primary-foreground',
    amber: 'bg-amber-50 ring-1 ring-amber-300 text-amber-900',
  }
  const labelTone: Record<typeof tone, string> = {
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
    primary: 'opacity-80',
    amber: 'text-amber-700',
  }
  return (
    <div className={`flex-1 rounded-lg p-3 ${toneClasses[tone]}`}>
      <div className={`text-[10px] uppercase tracking-wide font-semibold flex items-center gap-1 ${labelTone[tone]}`}>
        {icon}
        {label}
      </div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
      {sub && <div className={`text-[10px] mt-0.5 ${tone === 'primary' ? 'opacity-80' : 'opacity-80'}`}>{sub}</div>}
    </div>
  )
}

function MarginBadge({ margin }: { margin: number }) {
  const variant = margin > 50 ? 'default' : margin >= 20 ? 'secondary' : 'outline'
  const toneClass =
    margin > 50
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : margin >= 20
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-rose-50 text-rose-700 border-rose-200'
  return (
    <Badge variant={variant} className={variant === 'outline' ? toneClass : ''}>
      {formatPercent(margin)}
    </Badge>
  )
}

function CostBreakdownItem({
  title,
  total,
  description,
  icon,
  tone,
}: {
  title: string
  total: number
  description: string
  icon: React.ReactNode
  tone: 'rose' | 'amber'
}) {
  const toneClasses: Record<typeof tone, string> = {
    rose: 'bg-rose-50 text-rose-700 ring-rose-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  }
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-md flex items-center justify-center ring-1 ${toneClasses[tone]}`}>
            {icon}
          </div>
          <div className="text-sm font-semibold">{title}</div>
        </div>
        <div className="text-sm font-bold tabular-nums">{formatINR(total, true)}</div>
      </div>
      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{description}</p>
    </div>
  )
}
