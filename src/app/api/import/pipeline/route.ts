import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'
import { ImportPipelineService } from '@/lib/services/ImportPipelineService'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const jobs = await db.importJob.findMany({
    where: { companyId: { in: accessibleIds } },
    include: {
      company: { select: { id: true, name: true, code: true } },
      _count: { select: { rows: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ jobs })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const body = await req.json()
  const { companyId, sourceType, fileName, fileType, rawRows } = body

  const targetCompanyId = user.role === 'GROUP_ADMIN' && companyId ? companyId : user.companyId || accessibleIds[0]

  if (!accessibleIds.includes(targetCompanyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return NextResponse.json({ error: 'No raw rows provided for import staging' }, { status: 400 })
  }

  try {
    const job = await ImportPipelineService.createJob({
      companyId: targetCompanyId,
      uploadedBy: user.name,
      sourceType: sourceType || 'EXCEL',
      fileName: fileName || 'Imported_Data.xlsx',
      fileType: fileType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      rawRows,
    })

    return NextResponse.json({ job }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Import staging failed' }, { status: 400 })
  }
}
