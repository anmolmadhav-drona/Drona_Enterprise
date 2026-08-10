import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accessibleIds = await getAccessibleCompanyIds(user)
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId')
  const locationId = searchParams.get('locationId')
  const clientTypeId = searchParams.get('clientTypeId')
  const status = searchParams.get('status')

  // Enforce tenancy: tenant users can never see other companies.
  const companyFilter =
    user.role === 'GROUP_ADMIN' && companyId
      ? companyId
      : accessibleIds.length === 1
        ? accessibleIds[0]
        : { in: accessibleIds }

  const clients = await db.client.findMany({
    where: {
      companyId: typeof companyFilter === 'string' ? companyFilter : { in: accessibleIds },
      ...(locationId ? { locationId } : {}),
      ...(clientTypeId ? { clientTypeId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      company: { select: { id: true, name: true, code: true } },
      clientType: true,
      location: true,
      _count: { select: { revenues: true, allocations: true } },
    },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ clients })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const body = await req.json()
  const {
    companyId,
    name,
    code,
    clientTypeId,
    locationId,
    contractValue,
    contactName,
    contactEmail,
  } = body

  if (!name || !code || !clientTypeId || !locationId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  const targetCompany =
    user.role === 'GROUP_ADMIN' && companyId ? companyId : accessibleIds[0]
  if (!accessibleIds.includes(targetCompany)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const created = await db.client.create({
    data: {
      companyId: targetCompany,
      name,
      code: String(code).toUpperCase(),
      clientTypeId,
      locationId,
      contractValue: contractValue ? Number(contractValue) : null,
      contactName,
      contactEmail,
    },
    include: { company: true, clientType: true, location: true },
  })
  return NextResponse.json({ client: created }, { status: 201 })
}
