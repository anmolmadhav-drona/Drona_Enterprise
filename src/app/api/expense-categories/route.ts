import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId')

  const categories = await db.expenseCategory.findMany({
    where: {
      companyId:
        user.role === 'GROUP_ADMIN' && companyId
          ? companyId
          : { in: accessibleIds },
    },
    orderBy: { name: 'asc' },
  })

  // Deduplicate categories by lowercase name to ensure clean dropdowns without repeated entries
  const uniqueCategories: typeof categories = []
  const seenNames = new Set<string>()

  for (const cat of categories) {
    const key = cat.name.trim().toLowerCase()
    if (!seenNames.has(key)) {
      seenNames.add(key)
      uniqueCategories.push(cat)
    }
  }

  return NextResponse.json({ categories: uniqueCategories })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const body = await req.json()
  const { name, companyId, type } = body
  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
  }

  const targetCompanyId = companyId || user.companyId
  if (!targetCompanyId || !accessibleIds.includes(targetCompanyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const trimmedName = name.trim()

  // Check if exists
  const existing = await db.expenseCategory.findUnique({
    where: { companyId_name: { companyId: targetCompanyId, name: trimmedName } },
  })
  if (existing) {
    return NextResponse.json({ category: existing })
  }

  const created = await db.expenseCategory.create({
    data: {
      companyId: targetCompanyId,
      name: trimmedName,
      type: type || 'OPERATIONAL',
    },
  })

  return NextResponse.json({ category: created }, { status: 201 })
}
