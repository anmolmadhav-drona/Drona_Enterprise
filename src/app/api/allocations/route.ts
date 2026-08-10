import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')
  const clientId = searchParams.get('clientId')

  const allocations = await db.employeeClientAllocation.findMany({
    where: {
      employee: { companyId: { in: accessibleIds } },
      ...(employeeId ? { employeeId } : {}),
      ...(clientId ? { clientId } : {}),
    },
    include: {
      employee: { select: { id: true, name: true, code: true, company: { select: { id: true, name: true } } } },
      client: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ allocations })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)
  const body = await req.json()
  const { employeeId, clientId, allocationPercent, startDate, endDate } = body
  if (!employeeId || !clientId || allocationPercent == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  const pct = Number(allocationPercent)
  if (Number.isNaN(pct) || pct < 0 || pct > 100) {
    return NextResponse.json({ error: 'Allocation percent must be 0–100' }, { status: 400 })
  }

  const emp = await db.employee.findUnique({ where: { id: employeeId }, select: { companyId: true } })
  const cli = await db.client.findUnique({ where: { id: clientId }, select: { companyId: true } })
  if (!emp || !cli || emp.companyId !== cli.companyId) {
    return NextResponse.json({ error: 'Employee and client must belong to the same company' }, { status: 400 })
  }
  if (!accessibleIds.includes(emp.companyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const created = await db.employeeClientAllocation.create({
    data: {
      employeeId,
      clientId,
      allocationPercent: pct,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    },
  })
  return NextResponse.json({ allocation: created }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await db.employeeClientAllocation.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
