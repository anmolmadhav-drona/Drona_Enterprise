import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'
import { VendorService } from '@/lib/services/VendorService'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const accessibleIds =
    await getAccessibleCompanyIds(user)

  const { searchParams } = new URL(req.url)

  const requestedCompanyId =
    searchParams.get('companyId')

  let targetCompanyId: string | null = null

  if (user.role === 'GROUP_ADMIN') {
    targetCompanyId = requestedCompanyId
  } else {
    targetCompanyId = user.companyId
  }

  if (!targetCompanyId) {
    return NextResponse.json({
      vendors: [],
    })
  }

  if (!accessibleIds.includes(targetCompanyId)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }

  const vendors =
    await VendorService.getVendors([
      targetCompanyId,
    ])

  return NextResponse.json({
    vendors,
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const body = await req.json()
  const { companyId, name, code, email, phone, gstin, address } = body

  const targetCompanyId = user.role === 'GROUP_ADMIN' && companyId ? companyId : user.companyId || accessibleIds[0]

  if (!accessibleIds.includes(targetCompanyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const vendor = await VendorService.createVendor({
      companyId: targetCompanyId,
      name,
      code,
      email,
      phone,
      gstin,
      address,
    })
    return NextResponse.json({ vendor }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Vendor creation failed' }, { status: 400 })
  }
}
