import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId')
  const clientId = searchParams.get('clientId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const revenues = await db.revenue.findMany({
    where: {
      client: {
        companyId:
          user.role === 'GROUP_ADMIN' && companyId
            ? companyId
            : { in: accessibleIds },
      },
      ...(clientId ? { clientId } : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: {
      client: { select: { id: true, name: true, code: true, company: { select: { id: true, name: true } } } },
    },
    orderBy: { date: 'desc' },
    take: 500,
  })
  return NextResponse.json({ revenues })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const body = await req.json()
  const { clientId, date, invoiceNo, description, quantity, rate, amount } = body
  if (!clientId || !date || !invoiceNo) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify the client belongs to an accessible company (tenant isolation).
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { companyId: true },
  })
  if (!client || !accessibleIds.includes(client.companyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const created = await db.revenue.create({
    data: {
      clientId,
      date: new Date(date),
      invoiceNo,
      description,
      quantity: quantity ? Number(quantity) : 1,
      rate: Number(rate),
      amount: amount ? Number(amount) : Number(rate) * (quantity ? Number(quantity) : 1),
    },
  })
  return NextResponse.json({ revenue: created }, { status: 201 })
}
