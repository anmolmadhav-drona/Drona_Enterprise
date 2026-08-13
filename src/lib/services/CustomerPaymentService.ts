import { db } from '@/lib/db'

export type PaymentInput = {
  companyId: string
  revenueId: string
  paymentDate: string | Date
  amount: number
  paymentMethod?: string
  referenceNumber?: string
  notes?: string
  source?: string
  externalId?: string
}

export class CustomerPaymentService {
  /**
   * Records a new customer payment for an invoice/revenue entry.
   * Recalculates invoice paid amount, outstanding balance, and status within a transaction.
   */
  static async recordPayment(input: PaymentInput, userId?: string, userName?: string) {
    const { companyId, revenueId, paymentDate, amount, paymentMethod, referenceNumber, notes, source, externalId } = input

    if (amount <= 0) {
      throw new Error('Payment amount must be greater than zero')
    }

    return db.$transaction(async (tx) => {
      const revenue = await tx.revenue.findUnique({
        where: { id: revenueId },
        include: { client: true },
      })

      if (!revenue) {
        throw new Error('Invoice / Revenue record not found')
      }

      if (revenue.client.companyId !== companyId) {
        throw new Error('Forbidden: Client company mismatch')
      }

      const payment = await tx.customerPayment.create({
        data: {
          companyId,
          revenueId,
          clientId: revenue.clientId,
          paymentDate: new Date(paymentDate),
          amount: Number(amount),
          paymentMethod: paymentMethod || 'BANK_TRANSFER',
          referenceNumber: referenceNumber || null,
          notes: notes || null,
          status: 'ACTIVE',
          source: source || 'MANUAL',
          externalId: externalId || null,
        },
      })

      // Recalculate Invoice State
      await this.recalculateInvoiceStatus(tx, revenueId)

      // Record Financial Transaction (Double-entry: Credit Client Receivable)
      await tx.financialTransaction.create({
        data: {
          companyId,
          transactionDate: new Date(paymentDate),
          transactionType: 'CUSTOMER_PAYMENT',
          referenceType: 'CUSTOMER_PAYMENT',
          referenceId: payment.id,
          clientId: revenue.clientId,
          debit: 0,
          credit: Number(amount),
          amount: Number(amount),
          description: `Customer payment received for Invoice #${revenue.invoiceNo}${referenceNumber ? ` (${referenceNumber})` : ''}`,
          source: source || 'MANUAL',
          externalId: externalId || null,
        },
      })

      // Audit Log
      await tx.auditLog.create({
        data: {
          companyId,
          userId: userId || null,
          userName: userName || 'System',
          action: 'CREATE',
          entityType: 'CUSTOMER_PAYMENT',
          entityId: payment.id,
          details: JSON.stringify({ invoiceNo: revenue.invoiceNo, amount, paymentMethod }),
        },
      })

      return payment
    })
  }

  /**
   * Reverses (voids) a customer payment.
   * Recalculates invoice state within a transaction.
   */
  static async reversePayment(paymentId: string, companyId: string, userId?: string, userName?: string) {
    return db.$transaction(async (tx) => {
      const payment = await tx.customerPayment.findUnique({
        where: { id: paymentId },
        include: { revenue: true },
      })

      if (!payment || payment.companyId !== companyId) {
        throw new Error('Payment record not found or unauthorized')
      }

      if (payment.status === 'REVERSED') {
        throw new Error('Payment is already reversed')
      }

      const updatedPayment = await tx.customerPayment.update({
        where: { id: paymentId },
        data: { status: 'REVERSED' },
      })

      // Recalculate Invoice State
      await this.recalculateInvoiceStatus(tx, payment.revenueId)

      // Audit Log
      await tx.auditLog.create({
        data: {
          companyId,
          userId: userId || null,
          userName: userName || 'System',
          action: 'REVERSE',
          entityType: 'CUSTOMER_PAYMENT',
          entityId: paymentId,
          details: JSON.stringify({ revenueId: payment.revenueId, reversedAmount: payment.amount }),
        },
      })

      return updatedPayment
    })
  }

  /**
   * Helper method to compute paid amount, outstanding balance, and update invoice status.
   */
  static async recalculateInvoiceStatus(tx: any, revenueId: string) {
    const revenue = await tx.revenue.findUnique({
      where: { id: revenueId },
      include: {
        payments: {
          where: { status: 'ACTIVE' },
        },
      },
    })

    if (!revenue) return

    const totalPaid = revenue.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0)
    const outstanding = Math.max(0, Number(revenue.amount) - totalPaid)
    const today = new Date()

    let newStatus = 'UNPAID'
    if (totalPaid === 0) {
      newStatus = revenue.dueDate && new Date(revenue.dueDate) < today ? 'OVERDUE' : 'UNPAID'
    } else if (totalPaid < Number(revenue.amount)) {
      newStatus = revenue.dueDate && new Date(revenue.dueDate) < today ? 'OVERDUE' : 'PARTIAL'
    } else {
      newStatus = 'PAID'
    }

    await tx.revenue.update({
      where: { id: revenueId },
      data: { status: newStatus },
    })

    return { totalPaid, outstanding, status: newStatus }
  }
}
