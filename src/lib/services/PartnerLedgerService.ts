import { db } from '@/lib/db'

export type PartnerLedgerFilter = {
  companyIds: string[]
  partnerType: 'CLIENT' | 'VENDOR'
  partnerId: string
  from?: string | Date
  to?: string | Date
}

export type LedgerTransactionRow = {
  id: string
  date: string
  referenceNo: string
  type: string
  description: string
  debit: number
  credit: number
  balance: number
}

export class PartnerLedgerService {
  static async getStatement(filter: PartnerLedgerFilter) {
    const { companyIds, partnerType, partnerId, from, to } = filter
    const fromDate = from ? new Date(from) : new Date('2020-01-01')
    const toDate = to ? new Date(to) : new Date('2030-12-31')

    if (partnerType === 'CLIENT') {
      const client = await db.client.findUnique({
        where: { id: partnerId },
        include: { company: { select: { name: true } } },
      })
      if (!client || !companyIds.includes(client.companyId)) {
        throw new Error('Client partner not found or unauthorized')
      }

      // Calculate Opening Balance prior to fromDate
      const priorInvoices = await db.revenue.aggregate({
        _sum: { amount: true },
        where: { clientId: partnerId, date: { lt: fromDate } },
      })
      const priorPayments = await db.customerPayment.aggregate({
        _sum: { amount: true },
        where: { clientId: partnerId, status: 'ACTIVE', paymentDate: { lt: fromDate } },
      })

      const openingDebit = priorInvoices._sum.amount ?? 0
      const openingCredit = priorPayments._sum.amount ?? 0
      let runningBalance = openingDebit - openingCredit

      // Fetch Invoices & Payments within Date Range
      const invoices = await db.revenue.findMany({
        where: { clientId: partnerId, date: { gte: fromDate, lte: toDate } },
      })
      const payments = await db.customerPayment.findMany({
        where: { clientId: partnerId, status: 'ACTIVE', paymentDate: { gte: fromDate, lte: toDate } },
      })

      // Combine and sort chronologically
      const rawEvents: Array<{ date: Date; type: string; id: string; ref: string; desc: string; debit: number; credit: number }> = []

      invoices.forEach((inv) => {
        rawEvents.push({
          date: inv.date,
          type: 'INVOICE',
          id: inv.id,
          ref: inv.invoiceNo,
          desc: inv.description || 'Sales Invoice',
          debit: Number(inv.amount),
          credit: 0,
        })
      })

      payments.forEach((p) => {
        rawEvents.push({
          date: p.paymentDate,
          type: 'PAYMENT',
          id: p.id,
          ref: p.referenceNumber || `PAY-${p.id.slice(-6).toUpperCase()}`,
          desc: `Customer Payment (${p.paymentMethod})`,
          debit: 0,
          credit: Number(p.amount),
        })
      })

      rawEvents.sort((a, b) => a.date.getTime() - b.date.getTime())

      let totalDebit = 0
      let totalCredit = 0

      const rows: LedgerTransactionRow[] = rawEvents.map((evt) => {
        runningBalance += evt.debit - evt.credit
        totalDebit += evt.debit
        totalCredit += evt.credit
        return {
          id: evt.id,
          date: evt.date.toISOString().split('T')[0],
          referenceNo: evt.ref,
          type: evt.type,
          description: evt.desc,
          debit: evt.debit,
          credit: evt.credit,
          balance: runningBalance,
        }
      })

      return {
        partnerId: client.id,
        partnerName: client.name,
        partnerCode: client.code,
        partnerType: 'CLIENT',
        companyName: client.company.name,
        period: { from: fromDate.toISOString().split('T')[0], to: toDate.toISOString().split('T')[0] },
        openingBalance: openingDebit - openingCredit,
        totalDebit,
        totalCredit,
        closingBalance: runningBalance,
        transactions: rows,
      }
    } else {
      // VENDOR LEDGER
      const vendor = await db.vendor.findUnique({
        where: { id: partnerId },
        include: { company: { select: { name: true } } },
      })
      if (!vendor || !companyIds.includes(vendor.companyId)) {
        throw new Error('Vendor partner not found or unauthorized')
      }

      // Prior Bills (Credit) & Prior Payments (Debit)
      const priorBills = await db.bill.aggregate({
        _sum: { totalAmount: true },
        where: { vendorId: partnerId, billDate: { lt: fromDate } },
      })
      const priorPayments = await db.vendorPayment.aggregate({
        _sum: { amount: true },
        where: { vendorId: partnerId, status: 'ACTIVE', paymentDate: { lt: fromDate } },
      })

      const openingCredit = priorBills._sum.totalAmount ?? 0
      const openingDebit = priorPayments._sum.amount ?? 0
      let runningBalance = openingCredit - openingDebit

      const bills = await db.bill.findMany({
        where: { vendorId: partnerId, billDate: { gte: fromDate, lte: toDate } },
      })
      const payments = await db.vendorPayment.findMany({
        where: { vendorId: partnerId, status: 'ACTIVE', paymentDate: { gte: fromDate, lte: toDate } },
      })

      const rawEvents: Array<{ date: Date; type: string; id: string; ref: string; desc: string; debit: number; credit: number }> = []

      bills.forEach((b) => {
        rawEvents.push({
          date: b.billDate,
          type: 'BILL',
          id: b.id,
          ref: b.billNumber,
          desc: b.description || 'Vendor Bill',
          debit: 0,
          credit: Number(b.totalAmount),
        })
      })

      payments.forEach((p) => {
        rawEvents.push({
          date: p.paymentDate,
          type: 'PAYMENT',
          id: p.id,
          ref: p.referenceNumber || `VPAY-${p.id.slice(-6).toUpperCase()}`,
          desc: `Vendor Payment (${p.paymentMethod})`,
          debit: Number(p.amount),
          credit: 0,
        })
      })

      rawEvents.sort((a, b) => a.date.getTime() - b.date.getTime())

      let totalDebit = 0
      let totalCredit = 0

      const rows: LedgerTransactionRow[] = rawEvents.map((evt) => {
        runningBalance += evt.credit - evt.debit
        totalDebit += evt.debit
        totalCredit += evt.credit
        return {
          id: evt.id,
          date: evt.date.toISOString().split('T')[0],
          referenceNo: evt.ref,
          type: evt.type,
          description: evt.desc,
          debit: evt.debit,
          credit: evt.credit,
          balance: runningBalance,
        }
      })

      return {
        partnerId: vendor.id,
        partnerName: vendor.name,
        partnerCode: vendor.code || '—',
        partnerType: 'VENDOR',
        companyName: vendor.company.name,
        period: { from: fromDate.toISOString().split('T')[0], to: toDate.toISOString().split('T')[0] },
        openingBalance: openingCredit - openingDebit,
        totalDebit,
        totalCredit,
        closingBalance: runningBalance,
        transactions: rows,
      }
    }
  }
}
