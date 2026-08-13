import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'
import { PartnerLedgerService } from '@/lib/services/PartnerLedgerService'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const { searchParams } = new URL(req.url)
  const partnerType = (searchParams.get('partnerType') as 'CLIENT' | 'VENDOR') || 'CLIENT'
  const partnerId = searchParams.get('partnerId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!partnerId) {
    return NextResponse.json({ error: 'partnerId parameter is required' }, { status: 400 })
  }

  try {
    const statement = await PartnerLedgerService.getStatement({
      companyIds: accessibleIds,
      partnerType,
      partnerId,
      from: from || undefined,
      to: to || undefined,
    })

    return NextResponse.json({ statement })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to compute Partner Ledger statement' }, { status: 400 })
  }
}
