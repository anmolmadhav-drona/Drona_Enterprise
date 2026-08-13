import { db } from '@/lib/db'

export type PayablesAgingFilter = {
  companyIds: string[]
  asOfDate?: Date | string
  vendorId?: string
}

export type BillAgingItem = {
  billId: string
  billNumber: string
  billDate: string
  dueDate: string | null
  vendorName: string
  vendorCode: string | null
  companyName: string
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  daysOverdue: number
  bucket: 'CURRENT' | '1-30 DAYS' | '31-60 DAYS' | '61-90 DAYS' | '90+ DAYS'
  status: string
}

export class PayablesAgingService {
  static async calculateAging(filter: PayablesAgingFilter) {
    const asOf = filter.asOfDate ? new Date(filter.asOfDate) : new Date()

    const bills = await db.bill.findMany({
      where: {
        companyId: { in: filter.companyIds },
        ...(filter.vendorId ? { vendorId: filter.vendorId } : {}),
      },
      include: {
        vendor: true,
        company: { select: { id: true, name: true, code: true } },
        payments: {
          where: { status: 'ACTIVE' },
        },
      },
      orderBy: { billDate: 'desc' },
    })

    const billItems: BillAgingItem[] = []
    let totalPayables = 0
    let currentAmount = 0
    let days1To30 = 0
    let days31To60 = 0
    let days61To90 = 0
    let days90Plus = 0

    const creditorMap = new Map<string, { vendorId: string; vendorName: string; totalOutstanding: number; billCount: number }>()

    for (const b of bills) {
      const paidAmount = b.payments.reduce((sum, p) => sum + Number(p.amount), 0)
      const outstandingAmount = Math.max(0, Number(b.totalAmount) - paidAmount)

      if (outstandingAmount <= 0) continue

      totalPayables += outstandingAmount

      const due = b.dueDate ? new Date(b.dueDate) : new Date(b.billDate)
      const diffMs = asOf.getTime() - due.getTime()
      const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))

      let bucket: BillAgingItem['bucket'] = 'CURRENT'
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

      billItems.push({
        billId: b.id,
        billNumber: b.billNumber,
        billDate: b.billDate.toISOString().split('T')[0],
        dueDate: b.dueDate ? b.dueDate.toISOString().split('T')[0] : null,
        vendorName: b.vendor.name,
        vendorCode: b.vendor.code,
        companyName: b.company.name,
        totalAmount: Number(b.totalAmount),
        paidAmount,
        outstandingAmount,
        daysOverdue,
        bucket,
        status: b.status,
      })

      const existing = creditorMap.get(b.vendorId)
      if (existing) {
        existing.totalOutstanding += outstandingAmount
        existing.billCount += 1
      } else {
        creditorMap.set(b.vendorId, {
          vendorId: b.vendorId,
          vendorName: b.vendor.name,
          totalOutstanding: outstandingAmount,
          billCount: 1,
        })
      }
    }

    const topCreditors = Array.from(creditorMap.values()).sort((a, b) => b.totalOutstanding - a.totalOutstanding)

    return {
      asOfDate: asOf.toISOString().split('T')[0],
      totalPayables,
      buckets: {
        current: currentAmount,
        days1To30,
        days31To60,
        days61To90,
        days90Plus,
      },
      topCreditors,
      bills: billItems,
    }
  }
}
