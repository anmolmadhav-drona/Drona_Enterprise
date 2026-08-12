import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const accessibleIds = await getAccessibleCompanyIds(user)

  const client = await db.client.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true, code: true, type: true } },
      clientType: true,
      location: true,
      allocations: {
        include: {
          employee: {
            include: {
              department: true,
              employeeType: true,
              location: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      revenues: {
        orderBy: { date: 'desc' },
      },
      documents: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Tenancy check
  if (!accessibleIds.includes(client.companyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Compute Financial Summaries
  const totalRevenue = client.revenues.reduce((acc, curr) => acc + (curr.amount || 0), 0)
  
  const totalWorkforceCost = client.allocations.reduce((acc, alloc) => {
    const salary = alloc.employee?.salary || 0
    const allocPct = alloc.allocationPercent || 0
    return acc + (salary * allocPct) / 100
  }, 0)

  const profit = totalRevenue - totalWorkforceCost
  const marginPercent = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0

  return NextResponse.json({
    client,
    summary: {
      totalRevenue,
      totalWorkforceCost,
      profit,
      marginPercent,
      allocatedEmployeesCount: client.allocations.length,
      billedInvoicesCount: client.revenues.length,
      documentsCount: client.documents.length,
    },
  })
}
