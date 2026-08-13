import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'
import { ImportPipelineService } from '@/lib/services/ImportPipelineService'

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const { jobId } = await params
  const body = await req.json()
  const { targetEntity, mapping } = body

  if (!targetEntity || !mapping) {
    return NextResponse.json({ error: 'targetEntity and column mapping are required' }, { status: 400 })
  }

  try {
    const companyId = user.companyId || accessibleIds[0]
    const updatedJob = await ImportPipelineService.validateAndMapJob({
      jobId,
      companyId,
      targetEntity,
      mapping,
    })

    return NextResponse.json({ job: updatedJob })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Validation failed' }, { status: 400 })
  }
}
