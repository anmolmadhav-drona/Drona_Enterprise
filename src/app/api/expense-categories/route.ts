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
  return NextResponse.json({ categories })
}
