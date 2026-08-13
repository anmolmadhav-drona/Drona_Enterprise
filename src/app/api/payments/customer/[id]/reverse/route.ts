import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'
import { CustomerPaymentService } from '@/lib/services/CustomerPaymentService'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const { id } = await params

  try {
    const companyId = user.companyId || accessibleIds[0]
    const updated = await CustomerPaymentService.reversePayment(id, companyId, user.id, user.name)
    return NextResponse.json({ payment: updated, message: 'Payment successfully reversed' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Payment reversal failed' }, { status: 400 })
  }
}
