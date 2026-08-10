import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'

/**
 * Detailed profitability report — Revenue, Cost breakdown, Profit, Margin
 * for each accessible company.
 *
 * Returns:
 *   rows: [{ companyId, companyName, revenue, empCost, otherExpenses, totalCost, profit, margin }]
 *   summary: { revenue, cost, profit, margin }
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') ?? '2024-04-01'
  const to = searchParams.get('to') ?? '2024-09-30'
  const fromDate = new Date(from)
  const toDate = new Date(to)

  const companies = await db.company.findMany({
    where: { id: { in: accessibleIds } },
    select: { id: true, name: true, code: true, type: true },
    orderBy: [{ type: 'desc' }, { name: 'asc' }],
  })

  const rows = []
  for (const c of companies) {
    const revenue = await db.revenue.aggregate({
      _sum: { amount: true },
      where: { date: { gte: fromDate, lte: toDate }, client: { companyId: c.id } },
    })
    const empCost = await db.employeeCost.aggregate({
      _sum: { amount: true },
      where: { date: { gte: fromDate, lte: toDate }, employee: { companyId: c.id } },
    })
    const otherExpenses = await db.expense.aggregate({
      _sum: { amount: true },
      where: { date: { gte: fromDate, lte: toDate }, companyId: c.id },
    })
    const rev = revenue._sum.amount ?? 0
    const ec = empCost._sum.amount ?? 0
    const oe = otherExpenses._sum.amount ?? 0
    const cost = ec + oe
    const profit = rev - cost
    const margin = rev > 0 ? (profit / rev) * 100 : 0
    rows.push({
      companyId: c.id,
      companyName: c.name,
      companyCode: c.code,
      type: c.type,
      revenue: Math.round(rev),
      empCost: Math.round(ec),
      otherExpenses: Math.round(oe),
      totalCost: Math.round(cost),
      profit: Math.round(profit),
      margin: Math.round(margin * 10) / 10,
    })
  }

  const summary = rows.reduce(
    (acc, r) => {
      acc.revenue += r.revenue
      acc.empCost += r.empCost
      acc.otherExpenses += r.otherExpenses
      acc.totalCost += r.totalCost
      acc.profit += r.profit
      return acc
    },
    { revenue: 0, empCost: 0, otherExpenses: 0, totalCost: 0, profit: 0 },
  )
  const summaryMargin = summary.revenue > 0 ? (summary.profit / summary.revenue) * 100 : 0

  return NextResponse.json({
    rows,
    summary: {
      ...summary,
      margin: Math.round(summaryMargin * 10) / 10,
    },
  })
}
