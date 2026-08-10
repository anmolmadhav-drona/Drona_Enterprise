import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId')
  const departmentId = searchParams.get('departmentId')
  const employeeTypeId = searchParams.get('employeeTypeId')
  const locationId = searchParams.get('locationId')
  const status = searchParams.get('status')

  const employees = await db.employee.findMany({
    where: {
      companyId:
        user.role === 'GROUP_ADMIN' && companyId
          ? companyId
          : { in: accessibleIds },
      ...(departmentId ? { departmentId } : {}),
      ...(employeeTypeId ? { employeeTypeId } : {}),
      ...(locationId ? { locationId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      company: { select: { id: true, name: true } },
      employeeType: true,
      department: true,
      location: true,
      _count: { select: { allocations: true, costs: true } },
    },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ employees })
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
    employeeTypeId,
    departmentId,
    locationId,
    designation,
    salary,
    joiningDate,
  } = body
  if (!name || !code || !employeeTypeId || !departmentId || !locationId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  const targetCompany =
    user.role === 'GROUP_ADMIN' && companyId ? companyId : accessibleIds[0]
  if (!accessibleIds.includes(targetCompany)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const created = await db.employee.create({
    data: {
      companyId: targetCompany,
      name,
      code: String(code).toUpperCase(),
      employeeTypeId,
      departmentId,
      locationId,
      designation,
      salary: salary ? Number(salary) : 0,
      joiningDate: joiningDate ? new Date(joiningDate) : null,
    },
    include: { company: true, employeeType: true, department: true, location: true },
  })
  return NextResponse.json({ employee: created }, { status: 201 })
}
