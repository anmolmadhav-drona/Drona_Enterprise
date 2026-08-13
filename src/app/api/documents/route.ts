import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'
import { DocumentService } from '@/lib/services/DocumentService'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')

  if (entityType && entityId) {
    const docs = await DocumentService.getDocumentsForEntity(accessibleIds[0], entityType, entityId)
    return NextResponse.json({ documents: docs })
  }

  const documents = await db.document.findMany({
    where: { companyId: { in: accessibleIds } },
    include: {
      links: true,
      company: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ documents })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const body = await req.json()
  const { companyId, fileName, fileType, fileSize, storageKey, documentType, entityType, entityId } = body

  const targetCompanyId = user.role === 'GROUP_ADMIN' && companyId ? companyId : user.companyId || accessibleIds[0]

  if (!accessibleIds.includes(targetCompanyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const doc = await DocumentService.createDocument({
      companyId: targetCompanyId,
      fileName,
      fileType: fileType || 'application/pdf',
      fileSize: fileSize ? Number(fileSize) : undefined,
      storageKey,
      documentType,
      uploadedBy: user.name,
      entityType,
      entityId,
    })

    return NextResponse.json({ document: doc }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Document creation failed' }, { status: 400 })
  }
}
