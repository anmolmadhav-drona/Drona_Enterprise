import { db } from '@/lib/db'

export type BillInput = {
  companyId: string
  vendorId: string
  billNumber: string
  billDate: string | Date
  dueDate?: string | Date
  subtotal?: number
  taxAmount?: number
  totalAmount: number
  description?: string
  source?: string
  externalId?: string
  documentUrl?: string
  documentName?: string
}

export type VendorPaymentInput = {
  companyId: string
  billId: string
  paymentDate: string | Date
  amount: number
  paymentMethod?: string
  referenceNumber?: string
  notes?: string
  source?: string
  externalId?: string
}

export class BillService {
  /**
   * Creates a new Vendor Bill and logs a Financial Transaction (Credit Supplier Payable).
   */
  static async createBill(input: BillInput, userId?: string, userName?: string) {
    const { companyId, vendorId, billNumber, billDate, dueDate, subtotal, taxAmount, totalAmount, description, source, externalId, documentUrl, documentName } = input

    if (!billNumber || totalAmount <= 0) {
      throw new Error('Valid bill number and total amount are required')
    }

    return db.$transaction(async (tx) => {
      const vendor = await tx.vendor.findUnique({ where: { id: vendorId } })
      if (!vendor || vendor.companyId !== companyId) {
        throw new Error('Vendor not found or unauthorized')
      }

      const bill = await tx.bill.create({
        data: {
          companyId,
          vendorId,
          billNumber,
          billDate: new Date(billDate),
          dueDate: dueDate ? new Date(dueDate) : null,
          subtotal: subtotal != null ? Number(subtotal) : null,
          taxAmount: taxAmount != null ? Number(taxAmount) : null,
          totalAmount: Number(totalAmount),
          description: description || null,
          status: 'UNPAID',
          source: source || 'MANUAL',
          externalId: externalId || null,
          documentUrl: documentUrl || null,
          documentName: documentName || null,
        },
        include: { vendor: true },
      })

      // Log Financial Transaction (Credit Vendor Payable)
      await tx.financialTransaction.create({
        data: {
          companyId,
          transactionDate: new Date(billDate),
          transactionType: 'BILL',
          referenceType: 'BILL',
          referenceId: bill.id,
          vendorId,
          debit: 0,
          credit: Number(totalAmount),
          amount: Number(totalAmount),
          description: `Vendor Bill #${billNumber} from ${vendor.name}`,
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
          entityType: 'BILL',
          entityId: bill.id,
          details: JSON.stringify({ billNumber, vendorName: vendor.name, totalAmount }),
        },
      })

      return bill
    })
  }

  /**
   * Records a Vendor Payment, recalculating bill paid amount & status inside a transaction.
   */
  static async recordVendorPayment(input: VendorPaymentInput, userId?: string, userName?: string) {
    const { companyId, billId, paymentDate, amount, paymentMethod, referenceNumber, notes, source, externalId } = input

    if (amount <= 0) {
      throw new Error('Payment amount must be greater than zero')
    }

    return db.$transaction(async (tx) => {
      const bill = await tx.bill.findUnique({
        where: { id: billId },
        include: { vendor: true },
      })

      if (!bill || bill.companyId !== companyId) {
        throw new Error('Bill not found or unauthorized')
      }

      const payment = await tx.vendorPayment.create({
        data: {
          companyId,
          billId,
          vendorId: bill.vendorId,
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

      // Recalculate Bill Status
      await this.recalculateBillStatus(tx, billId)

      // Record Financial Transaction (Debit Vendor Payable)
      await tx.financialTransaction.create({
        data: {
          companyId,
          transactionDate: new Date(paymentDate),
          transactionType: 'VENDOR_PAYMENT',
          referenceType: 'VENDOR_PAYMENT',
          referenceId: payment.id,
          vendorId: bill.vendorId,
          debit: Number(amount),
          credit: 0,
          amount: Number(amount),
          description: `Supplier payment for Bill #${bill.billNumber}${referenceNumber ? ` (${referenceNumber})` : ''}`,
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
          entityType: 'VENDOR_PAYMENT',
          entityId: payment.id,
          details: JSON.stringify({ billNumber: bill.billNumber, amount }),
        },
      })

      return payment
    })
  }

  /**
   * Reverses (voids) a vendor payment.
   */
  static async reverseVendorPayment(paymentId: string, companyId: string, userId?: string, userName?: string) {
    return db.$transaction(async (tx) => {
      const payment = await tx.vendorPayment.findUnique({
        where: { id: paymentId },
      })

      if (!payment || payment.companyId !== companyId) {
        throw new Error('Vendor payment record not found or unauthorized')
      }

      if (payment.status === 'REVERSED') {
        throw new Error('Payment is already reversed')
      }

      const updated = await tx.vendorPayment.update({
        where: { id: paymentId },
        data: { status: 'REVERSED' },
      })

      await this.recalculateBillStatus(tx, payment.billId)

      await tx.auditLog.create({
        data: {
          companyId,
          userId: userId || null,
          userName: userName || 'System',
          action: 'REVERSE',
          entityType: 'VENDOR_PAYMENT',
          entityId: paymentId,
          details: JSON.stringify({ billId: payment.billId, reversedAmount: payment.amount }),
        },
      })

      return updated
    })
  }

  /**
   * Recalculate bill status.
   */
  static async recalculateBillStatus(tx: any, billId: string) {
    const bill = await tx.bill.findUnique({
      where: { id: billId },
      include: {
        payments: { where: { status: 'ACTIVE' } },
      },
    })

    if (!bill) return

    const totalPaid = bill.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0)
    const outstanding = Math.max(0, Number(bill.totalAmount) - totalPaid)
    const today = new Date()

    let newStatus = 'UNPAID'
    if (totalPaid === 0) {
      newStatus = bill.dueDate && new Date(bill.dueDate) < today ? 'OVERDUE' : 'UNPAID'
    } else if (totalPaid < Number(bill.totalAmount)) {
      newStatus = bill.dueDate && new Date(bill.dueDate) < today ? 'OVERDUE' : 'PARTIAL'
    } else {
      newStatus = 'PAID'
    }

    await tx.bill.update({
      where: { id: billId },
      data: { status: newStatus },
    })

    return { totalPaid, outstanding, status: newStatus }
  }
}
