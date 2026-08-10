import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId')
  const categoryId = searchParams.get('categoryId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const expenses = await db.expense.findMany({
    where: {
      companyId:
        user.role === 'GROUP_ADMIN' && companyId
          ? companyId
          : { in: accessibleIds },
      ...(categoryId ? { categoryId } : {}),
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
      company: { select: { id: true, name: true } },
      category: true,
    },
    orderBy: { date: 'desc' },
    take: 500,
  })
  return NextResponse.json({ expenses })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const body = await req.json()
  const { companyId, categoryId, date, amount, description } = body
  if (!categoryId || !date || amount == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  const targetCompany =
    user.role === 'GROUP_ADMIN' && companyId ? companyId : accessibleIds[0]
  if (!accessibleIds.includes(targetCompany)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const created = await db.expense.create({
    data: {
      companyId: targetCompany,
      categoryId,
      date: new Date(date),
      amount: Number(amount),
      description,
    },
    include: { category: true, company: true },
  })
  return NextResponse.json({ expense: created }, { status: 201 })
}

export async function GET_CATEGORIES() {}
