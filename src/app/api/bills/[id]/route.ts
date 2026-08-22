import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getCurrentUser,
  getAccessibleCompanyIds,
} from '@/lib/auth'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Only Group Admin can delete bills
    if (user.role !== 'GROUP_ADMIN') {
      return NextResponse.json(
        { error: 'Only Group Admin can delete bills' },
        { status: 403 }
      )
    }

    const accessibleIds =
      await getAccessibleCompanyIds(user)

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Bill ID is required' },
        { status: 400 }
      )
    }

    /*
     * Find the bill and verify that it belongs
     * to a company the admin can access.
     */
    const bill = await db.bill.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        companyId: true,
        billNumber: true,
      },
    })

    if (!bill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404 }
      )
    }

    if (!accessibleIds.includes(bill.companyId)) {
      return NextResponse.json(
        { error: 'You are not authorized to delete this bill' },
        { status: 403 }
      )
    }

    /*
     * Do not delete a bill that has payment history.
     * Payments should be reversed first.
     */
    const payment = await db.vendorPayment.findFirst({
      where: {
        billId: bill.id,
      },
      select: {
        id: true,
      },
    })

    if (payment) {
      return NextResponse.json(
        {
          error:
            'This bill has payment history. Reverse the payments before deleting it.',
        },
        { status: 400 }
      )
    }

    /*
     * Delete the bill and its related financial
     * transaction inside one database transaction.
     */
    await db.$transaction(async (tx) => {
      /*
       * Remove the financial transaction created
       * when the bill was created.
       */
      await tx.financialTransaction.deleteMany({
        where: {
          companyId: bill.companyId,
          referenceType: 'BILL',
          referenceId: bill.id,
        },
      })

      /*
       * Delete the bill itself.
       */
      await tx.bill.delete({
        where: {
          id: bill.id,
        },
      })

      /*
       * Record the deletion in the audit log.
       */
      await tx.auditLog.create({
        data: {
          companyId: bill.companyId,
          userId: user.id,
          userName: user.name,
          action: 'DELETE',
          entityType: 'BILL',
          entityId: bill.id,
          details: JSON.stringify({
            billNumber: bill.billNumber,
          }),
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Bill deleted successfully',
    })
  } catch (error: any) {
    console.error(
      'Bill deletion failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Failed to delete bill',
      },
      { status: 400 }
    )
  }
}
