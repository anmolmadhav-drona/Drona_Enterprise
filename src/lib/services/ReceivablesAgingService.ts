import { db } from '@/lib/db'

export type AgingFilter = {
  companyIds: string[]
  asOfDate?: Date | string
  clientId?: string
}

export type InvoiceAgingItem = {
  revenueId: string
  invoiceNo: string
  invoiceDate: string
  dueDate: string | null
  clientName: string
  clientCode: string
  companyName: string
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  daysOverdue: number
  bucket: 'CURRENT' | '1-30 DAYS' | '31-60 DAYS' | '61-90 DAYS' | '90+ DAYS'
  status: string
}

export class ReceivablesAgingService {
  /**
   * Dynamically calculates Accounts Receivable Aging breakdown across companies and clients.
   */
  static async calculateAging(filter: AgingFilter) {
    const asOf = filter.asOfDate ? new Date(filter.asOfDate) : new Date()

    const revenues = await db.revenue.findMany({
      where: {
        client: {
          companyId: { in: filter.companyIds },
          ...(filter.clientId ? { id: filter.clientId } : {}),
        },
      },
      include: {
        client: {
          include: {
            company: { select: { id: true, name: true, code: true } },
          },
        },
        payments: {
          where: { status: 'ACTIVE' },
        },
      },
      orderBy: { date: 'desc' },
    })

    const invoiceItems: InvoiceAgingItem[] = []
    let totalReceivables = 0
    let currentAmount = 0
    let days1To30 = 0
    let days31To60 = 0
    let days61To90 = 0
    let days90Plus = 0

    const debtorMap = new Map<string, { clientId: string; clientName: string; clientCode: string; totalOutstanding: number; invoiceCount: number }>()

    for (const r of revenues) {
      const paidAmount = r.payments.reduce((sum, p) => sum + Number(p.amount), 0)
      const outstandingAmount = Math.max(0, Number(r.amount) - paidAmount)

      // Skip fully paid invoices from outstanding aging balances
      if (outstandingAmount <= 0) continue

      totalReceivables += outstandingAmount

      // Determine due date (default to invoice date if null)
      const due = r.dueDate ? new Date(r.dueDate) : new Date(r.date)
      const diffMs = asOf.getTime() - due.getTime()
      const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))

      let bucket: InvoiceAgingItem['bucket'] = 'CURRENT'
      if (daysOverdue === 0) {
        bucket = 'CURRENT'
        currentAmount += outstandingAmount
      } else if (daysOverdue <= 30) {
        bucket = '1-30 DAYS'
        days1To30 += outstandingAmount
      } else if (daysOverdue <= 60) {
        bucket = '31-60 DAYS'
        days31To60 += outstandingAmount
      } else if (daysOverdue <= 90) {
        bucket = '61-90 DAYS'
        days61To90 += outstandingAmount
      } else {
        bucket = '90+ DAYS'
        days90Plus += outstandingAmount
      }

      invoiceItems.push({
        revenueId: r.id,
        invoiceNo: r.invoiceNo,
        invoiceDate: r.date.toISOString().split('T')[0],
        dueDate: r.dueDate ? r.dueDate.toISOString().split('T')[0] : null,
        clientName: r.client.name,
        clientCode: r.client.code,
        companyName: r.client.company.name,
        totalAmount: Number(r.amount),
        paidAmount,
        outstandingAmount,
        daysOverdue,
        bucket,
        status: r.status || (daysOverdue > 0 ? 'OVERDUE' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID'),
      })

      // Aggregate Top Debtors
      const existing = debtorMap.get(r.clientId)
      if (existing) {
        existing.totalOutstanding += outstandingAmount
        existing.invoiceCount += 1
      } else {
        debtorMap.set(r.clientId, {
          clientId: r.clientId,
          clientName: r.client.name,
          clientCode: r.client.code,
          totalOutstanding: outstandingAmount,
          invoiceCount: 1,
        })
      }
    }

    const topDebtors = Array.from(debtorMap.values()).sort((a, b) => b.totalOutstanding - a.totalOutstanding)

    return {
      asOfDate: asOf.toISOString().split('T')[0],
      totalReceivables,
      buckets: {
        current: currentAmount,
        days1To30,
        days31To60,
        days61To90,
        days90Plus,
      },
      topDebtors,
      invoices: invoiceItems,
    }
  }
}
