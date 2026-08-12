import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: clientId, docId } = await params
  const accessibleIds = await getAccessibleCompanyIds(user)

  const document = await db.clientDocument.findUnique({
    where: { id: docId },
    include: { client: { select: { companyId: true } } },
  })

  if (!document || document.clientId !== clientId) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  if (!accessibleIds.includes(document.client.companyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.clientDocument.delete({
    where: { id: docId },
  })

  return NextResponse.json({ success: true })
}
