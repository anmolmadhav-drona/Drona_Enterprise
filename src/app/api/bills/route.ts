import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'
import { BillService } from '@/lib/services/BillService'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const { searchParams } = new URL(req.url)
  const vendorId = searchParams.get('vendorId')

  const bills = await db.bill.findMany({
    where: {
      companyId: { in: accessibleIds },
      ...(vendorId ? { vendorId } : {}),
    },
    include: {
      vendor: { select: { id: true, name: true, code: true } },
      payments: { where: { status: 'ACTIVE' } },
    },
    orderBy: { billDate: 'desc' },
  })

  return NextResponse.json({ bills })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const body = await req.json()
  const { companyId, vendorId, billNumber, billDate, dueDate, subtotal, taxAmount, totalAmount, description, documentUrl, documentName } = body

  const targetCompanyId = user.role === 'GROUP_ADMIN' && companyId ? companyId : user.companyId || accessibleIds[0]

  if (!accessibleIds.includes(targetCompanyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

    return NextResponse.json({ bill }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Bill creation failed' }, { status: 400 })
  }
}
