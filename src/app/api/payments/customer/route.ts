import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'
import { CustomerPaymentService } from '@/lib/services/CustomerPaymentService'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const { searchParams } = new URL(req.url)
  const revenueId = searchParams.get('revenueId')

  const payments = await db.customerPayment.findMany({
    where: {
      companyId: { in: accessibleIds },
      ...(revenueId ? { revenueId } : {}),
    },
    include: {
      client: { select: { id: true, name: true, code: true } },
      revenue: { select: { id: true, invoiceNo: true, amount: true } },
    },
    orderBy: { paymentDate: 'desc' },
  })

  return NextResponse.json({ payments })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const body = await req.json()
  const { companyId, revenueId, paymentDate, amount, paymentMethod, referenceNumber, notes } = body

  const targetCompanyId = user.role === 'GROUP_ADMIN' && companyId ? companyId : user.companyId || accessibleIds[0]

  if (!accessibleIds.includes(targetCompanyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const payment = await CustomerPaymentService.recordPayment(
      {
        companyId: targetCompanyId,
        revenueId,
        paymentDate: paymentDate || new Date(),
        amount: Number(amount),
        paymentMethod,
        referenceNumber,
        notes,
      },
      user.id,
      user.name
    )

    return NextResponse.json({ payment }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Payment recording failed' }, { status: 400 })
  }
}
