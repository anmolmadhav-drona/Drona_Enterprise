import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'
import { CashFlowService } from '@/lib/services/CashFlowService'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const companyId = searchParams.get('companyId')

  const targetCompanyIds = user.role === 'GROUP_ADMIN' && companyId ? [companyId] : accessibleIds

  try {
    const statement = await CashFlowService.getCashFlowStatement({
      companyIds: targetCompanyIds,
      from: from || undefined,
      to: to || undefined,
    })

    return NextResponse.json({ statement })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to compute Cash Flow statement' }, { status: 500 })
  }
}
