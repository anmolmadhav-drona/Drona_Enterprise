import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // GROUP_ADMIN sees the hierarchy; everyone else sees only their own company.
  if (user.role === 'GROUP_ADMIN') {
    const companies = await db.company.findMany({
      include: {
        children: true,
        _count: { select: { users: true, clients: true, employees: true } },
      },
      orderBy: [{ type: 'desc' }, { name: 'asc' }],
    })
    return NextResponse.json({ companies })
  }

  const ids = await getAccessibleCompanyIds(user)
  const companies = await db.company.findMany({
    where: { id: { in: ids } },
    include: { children: true, _count: { select: { users: true, clients: true, employees: true } } },
  })
  return NextResponse.json({ companies })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'GROUP_ADMIN') {
    return NextResponse.json({ error: 'Only Group Admin can create companies' }, { status: 403 })
  }
  const body = await req.json()
  const { name, code, type, parentId, status } = body
  if (!name || !code) return NextResponse.json({ error: 'Name and code are required' }, { status: 400 })

  const created = await db.company.create({
    data: {
      name,
      code: String(code).toUpperCase(),
      type: type === 'PARENT' ? 'PARENT' : 'TENANT',
      parentId: parentId || user.companyId,
      status: status || 'ACTIVE',
    },
  })
  return NextResponse.json({ company: created }, { status: 201 })
}
