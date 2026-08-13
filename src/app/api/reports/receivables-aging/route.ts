import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'
import { ReceivablesAgingService } from '@/lib/services/ReceivablesAgingService'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const { searchParams } = new URL(req.url)
  const asOfDate = searchParams.get('asOfDate')
  const companyId = searchParams.get('companyId')
  const clientId = searchParams.get('clientId')

  const targetCompanyIds = user.role === 'GROUP_ADMIN' && companyId ? [companyId] : accessibleIds

  try {
    const report = await ReceivablesAgingService.calculateAging({
      companyIds: targetCompanyIds,
      asOfDate: asOfDate || undefined,
      clientId: clientId || undefined,
    })

    return NextResponse.json({ report })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to compute Receivables Aging report' }, { status: 500 })
  }
}
