import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')
  const costType = searchParams.get('costType')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const costs = await db.employeeCost.findMany({
    where: {
      employee: { companyId: { in: accessibleIds } },
      ...(employeeId ? { employeeId } : {}),
      ...(costType ? { costType } : {}),
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
      employee: {
        select: { id: true, name: true, code: true, company: { select: { id: true, name: true } } },
      },
    },
    orderBy: { date: 'desc' },
    take: 500,
  })
  return NextResponse.json({ costs })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const body = await req.json()
  const { employeeId, date, costType, amount, description } = body
  if (!employeeId || !date || !costType || amount == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  const emp = await db.employee.findUnique({
    where: { id: employeeId },
    select: { companyId: true },
  })
  if (!emp || !accessibleIds.includes(emp.companyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const created = await db.employeeCost.create({
    data: {
      employeeId,
      date: new Date(date),
      costType,
      amount: Number(amount),
      description,
    },
  })
  return NextResponse.json({ cost: created }, { status: 201 })
}
