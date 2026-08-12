import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: clientId } = await params
  const accessibleIds = await getAccessibleCompanyIds(user)

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { companyId: true },
  })

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  if (!accessibleIds.includes(client.companyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const documents = await db.clientDocument.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ documents })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: clientId } = await params
  const accessibleIds = await getAccessibleCompanyIds(user)

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { companyId: true },
  })

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  if (!accessibleIds.includes(client.companyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, category, fileUrl, fileType, fileSize } = body

  if (!name || !fileUrl) {
    return NextResponse.json({ error: 'Name and file payload are required' }, { status: 400 })
  }

  const document = await db.clientDocument.create({
    data: {
      clientId,
      name: name.trim(),
      category: category || 'Invoice',
      fileUrl,
      fileType: fileType || 'image/png',
      fileSize: fileSize ? Number(fileSize) : null,
    },
  })

  return NextResponse.json({ document }, { status: 201 })
}
