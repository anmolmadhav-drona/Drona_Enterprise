import { db } from '@/lib/db'

export type CashFlowFilter = {
  companyIds: string[]
  from?: string | Date
  to?: string | Date
}

export type MonthlyCashFlowRow = {
  month: string // e.g. "Apr 2024"
  yearMonth: string // "2024-04"
  inflow: number
  outflow: {
    vendorPayments: number
    expenses: number
    employeeCosts: number
    totalOutflow: number
  }
  netCashFlow: number
}

export class CashFlowService {
  /**
   * Calculates actual cash movement (Cash Inflow - Cash Outflow) aggregated monthly.
   */
  static async getCashFlowStatement(filter: CashFlowFilter) {
    const { companyIds, from, to } = filter
    const fromDate = from ? new Date(from) : new Date('2024-04-01')
    const toDate = to ? new Date(to) : new Date('2024-09-30')

    // Fetch Active Customer Payments (Inflows)
    const customerPayments = await db.customerPayment.findMany({
      where: {
        companyId: { in: companyIds },
        status: 'ACTIVE',
        paymentDate: { gte: fromDate, lte: toDate },
      },
    })

    // Fetch Vendor Payments (Outflows)
    const vendorPayments = await db.vendorPayment.findMany({
      where: {
        companyId: { in: companyIds },
        status: 'ACTIVE',
        paymentDate: { gte: fromDate, lte: toDate },
      },
    })

    // Fetch Operational Expenses (Outflows)
    const expenses = await db.expense.findMany({
      where: {
        companyId: { in: companyIds },
        date: { gte: fromDate, lte: toDate },
      },
    })

    // Fetch Employee Payroll Costs (Outflows)
    const employeeCosts = await db.employeeCost.findMany({
      where: {
        employee: { companyId: { in: companyIds } },
        date: { gte: fromDate, lte: toDate },
      },
    })

    // Map into month buckets (YYYY-MM)
    const monthBucketMap = new Map<string, {
      inflow: number
      vendorPayments: number
      expenses: number
      employeeCosts: number
    }>()

    const getYearMonth = (d: Date) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      return `${year}-${month}`
    }

    // Process Inflows
    customerPayments.forEach((cp) => {
      const ym = getYearMonth(new Date(cp.paymentDate))
      const curr = monthBucketMap.get(ym) || { inflow: 0, vendorPayments: 0, expenses: 0, employeeCosts: 0 }
      curr.inflow += Number(cp.amount)
      monthBucketMap.set(ym, curr)
    })

    // Process Outflows
    vendorPayments.forEach((vp) => {
      const ym = getYearMonth(new Date(vp.paymentDate))
      const curr = monthBucketMap.get(ym) || { inflow: 0, vendorPayments: 0, expenses: 0, employeeCosts: 0 }
      curr.vendorPayments += Number(vp.amount)
      monthBucketMap.set(ym, curr)
    })

    expenses.forEach((e) => {
      const ym = getYearMonth(new Date(e.date))
      const curr = monthBucketMap.get(ym) || { inflow: 0, vendorPayments: 0, expenses: 0, employeeCosts: 0 }
      curr.expenses += Number(e.amount)
      monthBucketMap.set(ym, curr)
    })

    employeeCosts.forEach((ec) => {
      const ym = getYearMonth(new Date(ec.date))
      const curr = monthBucketMap.get(ym) || { inflow: 0, vendorPayments: 0, expenses: 0, employeeCosts: 0 }
      curr.employeeCosts += Number(ec.amount)
      monthBucketMap.set(ym, curr)
    })

    // Sort months chronologically
    const sortedYearMonths = Array.from(monthBucketMap.keys()).sort()

    let totalInflow = 0
    let totalOutflow = 0

    const monthlyRows: MonthlyCashFlowRow[] = sortedYearMonths.map((ym) => {
      const data = monthBucketMap.get(ym)!
      const totalOut = data.vendorPayments + data.expenses + data.employeeCosts
      const net = data.inflow - totalOut

      totalInflow += data.inflow
      totalOutflow += totalOut

      // Format Year-Month label e.g. "Apr 2024"
      const [y, m] = ym.split('-')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const formattedLabel = `${monthNames[parseInt(m, 10) - 1]} ${y}`

      return {
        month: formattedLabel,
        yearMonth: ym,
        inflow: Math.round(data.inflow),
        outflow: {
          vendorPayments: Math.round(data.vendorPayments),
          expenses: Math.round(data.expenses),
          employeeCosts: Math.round(data.employeeCosts),
          totalOutflow: Math.round(totalOut),
        },
        netCashFlow: Math.round(net),
      }
    })

    return {
      period: { from: fromDate.toISOString().split('T')[0], to: toDate.toISOString().split('T')[0] },
      summary: {
        totalInflow: Math.round(totalInflow),
        totalOutflow: Math.round(totalOutflow),
        netCashFlow: Math.round(totalInflow - totalOutflow),
      },
      monthly: monthlyRows,
    }
  }
}
