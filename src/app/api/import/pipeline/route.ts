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

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  if (
    user.role !== 'GROUP_ADMIN' &&
    user.role !== 'COMPANY_ADMIN'
  ) {
    return NextResponse.json(
      {
        error:
          'Forbidden: Only Company Admins and Group Admins can import data',
      },
      { status: 403 }
    )
  }

  try {
    const accessibleIds =
      await getAccessibleCompanyIds(user)

    const body = await req.json()

    const {
      companyId,
      sourceType,
      fileName,
      fileType,
      rawRows,
      mapping,
    } = body

    const targetCompanyId =
      user.role === 'GROUP_ADMIN' && companyId
        ? companyId
        : user.companyId || accessibleIds[0]

    if (
      !targetCompanyId ||
      !accessibleIds.includes(targetCompanyId)
    ) {
      return NextResponse.json(
        { error: 'Forbidden company access' },
        { status: 403 }
      )
    }

    if (
      !Array.isArray(rawRows) ||
      rawRows.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            'No validated MIS rows were provided',
        },
        { status: 400 }
      )
    }

    if (
      !mapping ||
      typeof mapping !== 'object'
    ) {
      return NextResponse.json(
        {
          error:
            'Column mapping is required',
        },
        { status: 400 }
      )
    }

    const result =
      await ImportPipelineService.executeLogisticsImport({
        companyId: targetCompanyId,
        uploadedBy: user.name,
        fileName:
          fileName || 'Imported_Logistics_MIS.xlsx',
        fileType:
          fileType ||
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        rawRows,
        mapping,
      })

    return NextResponse.json(
      {
        message:
          'Logistics MIS imported successfully',
        job: result.job,
        reconciliation:
          result.reconciliation,
      },
      { status: 201 }
    )
  } catch (err: any) {
    console.error(
      '[LOGISTICS IMPORT ERROR]',
      err
    )

    return NextResponse.json(
      {
        error:
          err?.message ||
          'Logistics MIS import failed',
      },
      { status: 500 }
    )
  }
}