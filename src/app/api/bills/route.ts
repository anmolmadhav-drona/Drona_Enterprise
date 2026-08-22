import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'
import { BillService } from '@/lib/services/BillService'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const accessibleIds = await getAccessibleCompanyIds(user)

  const { searchParams } = new URL(req.url)
  const vendorId = searchParams.get('vendorId')

  const bills = await db.bill.findMany({
    where: {
      companyId: { in: accessibleIds },
      ...(vendorId ? { vendorId } : {}),
    },

    include: {
      company: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },

      vendor: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },

      payments: {
        where: {
          status: 'ACTIVE',
        },
      },
    },

    orderBy: {
      billDate: 'desc',
    },
  })
  /*
   * Recalculate the current status when bills are fetched.
   *
   * This is important because a bill can become overdue simply
   * because the calendar date has changed. We should not depend
   * on a payment being recorded to update the status.
   */
  const today = new Date()

  const billsWithCurrentStatus = bills.map((bill) => {
    const totalPaid = bill.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    )

    const totalAmount = Number(bill.totalAmount)

    const outstanding = Math.max(
      0,
      totalAmount - totalPaid
    )

    let status = 'UNPAID'

    /*
     * Fully paid always takes priority over overdue.
     */
    if (totalPaid >= totalAmount) {
      status = 'PAID'
    } else if (bill.dueDate) {
      const dueDate = new Date(bill.dueDate)

      /*
       * There is still money outstanding and the due date
       * has passed.
       */
      if (dueDate < today) {
        status = 'OVERDUE'
      } else if (totalPaid > 0) {
        status = 'PARTIAL'
      } else {
        status = 'UNPAID'
      }
    } else if (totalPaid > 0) {
      status = 'PARTIAL'
    }

    return {
      ...bill,
      status,
    }
  })

  return NextResponse.json({
    bills: billsWithCurrentStatus,
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const accessibleIds = await getAccessibleCompanyIds(user)

  const body = await req.json()

  const {
    companyId,
    vendorId,
    billNumber,
    billDate,
    dueDate,
    subtotal,
    taxAmount,
    totalAmount,
    description,
    documentUrl,
    documentName,
  } = body

  const targetCompanyId =
    user.role === 'GROUP_ADMIN' && companyId
      ? companyId
      : user.companyId || accessibleIds[0]

  if (!accessibleIds.includes(targetCompanyId)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }

  try {
    const bill = await BillService.createBill(
      {
        companyId: targetCompanyId,
        vendorId,
        billNumber,
        billDate,
        dueDate,
        subtotal,
        taxAmount,
        totalAmount: Number(totalAmount),
        description,
        documentUrl,
        documentName,
      },
      user.id,
      user.name
    )

    return NextResponse.json(
      { bill },
      { status: 201 }
    )
  } catch (err: any) {
    return NextResponse.json(
      {
        error:
          err.message ||
          'Bill creation failed',
      },
      { status: 400 }
    )
  }
}