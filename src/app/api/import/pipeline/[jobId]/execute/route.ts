import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'
import { ImportPipelineService } from '@/lib/services/ImportPipelineService'

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const { jobId } = await params

  try {
    const companyId = user.companyId || accessibleIds[0]
    const result = await ImportPipelineService.executeProductionImport(jobId, companyId, user.id)

    return NextResponse.json({
      message: 'Production import completed',
      job: result.job,
      reconciliation: result.reconciliation,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Production import execution failed' }, { status: 400 })
  }
}
