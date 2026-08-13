import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'
import { PayablesAgingService } from '@/lib/services/PayablesAgingService'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const { searchParams } = new URL(req.url)
  const asOfDate = searchParams.get('asOfDate')
  const companyId = searchParams.get('companyId')
  const vendorId = searchParams.get('vendorId')

  const targetCompanyIds = user.role === 'GROUP_ADMIN' && companyId ? [companyId] : accessibleIds

  try {
    const report = await PayablesAgingService.calculateAging({
      companyIds: targetCompanyIds,
      asOfDate: asOfDate || undefined,
      vendorId: vendorId || undefined,
    })

    return NextResponse.json({ report })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to compute Payables Aging report' }, { status: 500 })
  }
}
