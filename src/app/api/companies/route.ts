import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds, hashPassword } from '@/lib/auth'

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
  const { name, code, type, parentId, status, adminEmail, adminPassword } = body
  if (!name || !code) return NextResponse.json({ error: 'Name and code are required' }, { status: 400 })

  const companyCode = String(code).toUpperCase()
  const emailToUse = (adminEmail || `admin.${companyCode.toLowerCase()}@drona.com`).toLowerCase().trim()

  // Check if email already registered
  const existingUser = await db.user.findUnique({
    where: { email: emailToUse },
  })
  if (existingUser) {
    return NextResponse.json({ error: `A user with email "${emailToUse}" already exists. Please choose a different Tenant Admin ID/Email.` }, { status: 400 })
  }

  const createdCompany = await db.company.create({
    data: {
      name,
      code: companyCode,
      type: type === 'PARENT' ? 'PARENT' : 'TENANT',
      parentId: parentId || user.companyId,
      status: status || 'ACTIVE',
    },
    include: {
      children: true,
      _count: { select: { users: true, clients: true, employees: true } },
    },
  })

  // Create initial Tenant Admin User if password or email specified
  const password = adminPassword?.trim() || 'TenantAdmin123!'
  const createdAdmin = await db.user.create({
    data: {
      email: emailToUse,
      name: `${name} Admin`,
      passwordHash: await hashPassword(password),
      role: 'COMPANY_ADMIN',
      companyId: createdCompany.id,
      active: true,
    },
  })

  return NextResponse.json({
    company: createdCompany,
    tenantAdmin: {
      id: createdAdmin.id,
      email: createdAdmin.email,
      role: createdAdmin.role,
    },
  }, { status: 201 })
}
