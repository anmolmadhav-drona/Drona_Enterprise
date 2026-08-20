import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'
import { uploadToS3 } from '@/lib/storage/s3'

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
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: clientId } = await params
  const accessibleIds = await getAccessibleCompanyIds(user)

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { companyId: true },
  })

  if (!client) {
    return NextResponse.json(
      { error: 'Client not found' },
      { status: 404 }
    )
  }

  if (!accessibleIds.includes(client.companyId)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }

  const formData = await req.formData()

  const file = formData.get('file')
  const category = String(formData.get('category') || 'Invoice')

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'File is required' },
      { status: 400 }
    )
  }

  const MAX_FILE_SIZE = 25 * 1024 * 1024

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File size cannot exceed 25 MB' },
      { status: 400 }
    )
  }

  if (file.size <= 0) {
    return NextResponse.json(
      { error: 'File is empty' },
      { status: 400 }
    )
  }

  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]

  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only PDF and image files are allowed' },
      { status: 400 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')

  const storageKey =
    `companies/${client.companyId}/clients/${clientId}/documents/` +
    `${Date.now()}-${safeFileName}`

  try {
    const uploaded = await uploadToS3(
      storageKey,
      buffer,
      file.type
    )

    const document = await db.clientDocument.create({
      data: {
        clientId,
        name: file.name,
        category,
        fileUrl: uploaded.key,
        fileType: file.type,
        fileSize: file.size,
      },
    })

    return NextResponse.json(
      { document },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('S3 upload failed:', error)

    return NextResponse.json(
      { error: error.message || 'File upload failed' },
      { status: 500 }
    )
  }
}