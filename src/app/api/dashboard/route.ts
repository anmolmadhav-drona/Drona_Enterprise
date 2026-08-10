import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'

/**
 * Returns dashboard analytics for the user's accessible companies.
 *
 * Filters:
 *  - companyId (GROUP_ADMIN only) — focus on a specific tenant
 *  - locationId
 *  - clientTypeId
 *  - from / to — date range (defaults to FY 2024-04-01 → 2024-09-30)
 *
 * Response shape:
 *   {
 *     kpis: { totalRevenue, totalCost, totalProfit, profitMargin },
 *     revenueByClient: [{ name, value, color }],
 *     costByCategory: [{ name, value, color }],
 *     profitByClient: [{ client, profit, revenue, cost }],
 *     profitTrend: [{ month, profit }],
 *     companies: [{ id, name, code }]  // accessible to user
 *   }
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId')
  const locationId = searchParams.get('locationId')
  const clientTypeId = searchParams.get('clientTypeId')
  const from = searchParams.get('from') ?? '2024-04-01'
  const to = searchParams.get('to') ?? '2024-09-30'

  const fromDate = new Date(from)
  const toDate = new Date(to)

  // Determine target company IDs based on tenancy.
  let targetCompanyIds: string[] = []
  if (user.role === 'GROUP_ADMIN') {
    targetCompanyIds = companyId ? [companyId] : accessibleIds
  } else {
    targetCompanyIds = accessibleIds
  }

  // -------- Revenue aggregated by client --------
  const revenueRows = await db.revenue.findMany({
    where: {
      date: { gte: fromDate, lte: toDate },
      client: {
        companyId: { in: targetCompanyIds },
        ...(locationId ? { locationId } : {}),
        ...(clientTypeId ? { clientTypeId } : {}),
      },
    },
    select: {
      amount: true,
      date: true,
      clientId: true,
      client: { select: { id: true, name: true } },
    },
  })

  // -------- Employee cost (allocated to clients) --------
  // Step 1: gather all employee costs in the range.
  const empCosts = await db.employeeCost.findMany({
    where: {
      date: { gte: fromDate, lte: toDate },
      employee: { companyId: { in: targetCompanyIds } },
    },
    select: {
      amount: true,
      date: true,
      employeeId: true,
      costType: true,
      employee: { select: { name: true, code: true } },
    },
  })

  // Step 2: gather allocations to spread cost across clients.
  const allocations = await db.employeeClientAllocation.findMany({
    where: { employee: { companyId: { in: targetCompanyIds } } },
    select: { employeeId: true, clientId: true, allocationPercent: true },
  })

  // Build employeeId -> [ { clientId, pct } ]
  const empAllocMap = new Map<string, { clientId: string; pct: number }[]>()
  for (const a of allocations) {
    if (!empAllocMap.has(a.employeeId)) empAllocMap.set(a.employeeId, [])
    empAllocMap.get(a.employeeId)!.push({ clientId: a.clientId, pct: a.allocationPercent })
  }

  // -------- Expenses (other costs) --------
  const expenses = await db.expense.findMany({
    where: {
      date: { gte: fromDate, lte: toDate },
      companyId: { in: targetCompanyIds },
    },
    select: {
      amount: true,
      date: true,
      category: { select: { name: true, type: true } },
    },
  })

  // -------- Aggregations --------
  const revenueByClient = new Map<string, number>()
  const revenueByMonth = new Map<number, number>() // 0-11 month
  const clientNameMap = new Map<string, string>()
  let totalRevenue = 0
  for (const r of revenueRows) {
    totalRevenue += r.amount
    revenueByClient.set(r.clientId, (revenueByClient.get(r.clientId) ?? 0) + r.amount)
    clientNameMap.set(r.clientId, r.client.name)
    const m = new Date(r.date).getMonth()
    revenueByMonth.set(m, (revenueByMonth.get(m) ?? 0) + r.amount)
  }

  // Allocate employee cost to clients (or "Unallocated" if no allocation records).
  const costByClient = new Map<string, number>()
  const costByMonth = new Map<number, number>()
  let totalEmpCost = 0
  const empCostByType = new Map<string, number>()

  for (const c of empCosts) {
    totalEmpCost += c.amount
    const m = new Date(c.date).getMonth()
    costByMonth.set(m, (costByMonth.get(m) ?? 0) + c.amount)
    empCostByType.set(c.costType, (empCostByType.get(c.costType) ?? 0) + c.amount)

    const allocs = empAllocMap.get(c.employeeId) ?? []
    if (allocs.length === 0) {
      costByClient.set('__UNALLOCATED__', (costByClient.get('__UNALLOCATED__') ?? 0) + c.amount)
    } else {
      for (const a of allocs) {
        const share = (c.amount * a.pct) / 100
        costByClient.set(a.clientId, (costByClient.get(a.clientId) ?? 0) + share)
      }
    }
  }

  // Expenses grouped by category.
  let totalExpenses = 0
  const expenseByCategory = new Map<string, number>()
  for (const e of expenses) {
    totalExpenses += e.amount
    expenseByCategory.set(e.category.name, (expenseByCategory.get(e.category.name) ?? 0) + e.amount)
    const m = new Date(e.date).getMonth()
    costByMonth.set(m, (costByMonth.get(m) ?? 0) + e.amount)
  }

  const totalCost = totalEmpCost + totalExpenses
  const totalProfit = totalRevenue - totalCost
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  // -------- Revenue by client (top 6 + Others) --------
  const CHART_COLORS = ['#1e3a8a', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9', '#ec4899']
  const revByClientArr = [...revenueByClient.entries()]
    .map(([id, value]) => ({ name: clientNameMap.get(id) ?? id, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value)
  const topRev = revByClientArr.slice(0, 6)
  const othersRev = revByClientArr.slice(6).reduce((s, x) => s + x.value, 0)
  if (othersRev > 0) topRev.push({ name: 'Others', value: othersRev })
  topRev.forEach((r, i) => (r as any).color = CHART_COLORS[i % CHART_COLORS.length])

  // -------- Cost by category --------
  const costByCatArr: { name: string; value: number; color: string }[] = []
  // Employee cost types first
  for (const [name, value] of empCostByType.entries()) {
    costByCatArr.push({ name: `Emp · ${name.charAt(0) + name.slice(1).toLowerCase()}`, value: Math.round(value), color: '' })
  }
  // Other expense categories
  for (const [name, value] of expenseByCategory.entries()) {
    costByCatArr.push({ name, value: Math.round(value), color: '' })
  }
  costByCatArr.sort((a, b) => b.value - a.value)
  costByCatArr.forEach((c, i) => (c.color = CHART_COLORS[i % CHART_COLORS.length]))

  // -------- Profit by client --------
  const allClientIds = new Set<string>([...revenueByClient.keys(), ...costByClient.keys()])
  const profitByClient = [...allClientIds]
    .filter((id) => id !== '__UNALLOCATED__')
    .map((id) => {
      const revenue = revenueByClient.get(id) ?? 0
      const cost = costByClient.get(id) ?? 0
      return {
        client: clientNameMap.get(id) ?? id,
        revenue: Math.round(revenue),
        cost: Math.round(cost),
        profit: Math.round(revenue - cost),
      }
    })
    .sort((a, b) => b.profit - a.profit)

  // -------- Profit trend by month --------
  const startM = fromDate.getMonth()
  const monthsInRange: number[] = []
  let cursor = new Date(fromDate)
  while (cursor <= toDate) {
    monthsInRange.push(cursor.getMonth())
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  }
  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const profitTrend = monthsInRange.map((m) => ({
    month: MONTH_LABELS[m],
    revenue: Math.round(revenueByMonth.get(m) ?? 0),
    cost: Math.round(costByMonth.get(m) ?? 0),
    profit: Math.round((revenueByMonth.get(m) ?? 0) - (costByMonth.get(m) ?? 0)),
  }))

  // -------- Companies accessible (for filter) --------
  const companies = await db.company.findMany({
    where: { id: { in: targetCompanyIds } },
    select: { id: true, name: true, code: true, type: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({
    range: { from, to },
    kpis: {
      totalRevenue: Math.round(totalRevenue),
      totalCost: Math.round(totalCost),
      totalProfit: Math.round(totalProfit),
      profitMargin: Math.round(profitMargin * 10) / 10,
      totalEmpCost: Math.round(totalEmpCost),
      totalExpenses: Math.round(totalExpenses),
    },
    revenueByClient: topRev,
    costByCategory: costByCatArr,
    profitByClient,
    profitTrend,
    companies,
  })
}
