import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'
import { uploadToS3 } from '@/lib/storage/s3'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId')
  const clientId = searchParams.get('clientId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const revenues = await db.revenue.findMany({
    where: {
      client: {
        companyId:
          user.role === 'GROUP_ADMIN' && companyId
            ? companyId
            : { in: accessibleIds },
      },
      ...(clientId ? { clientId } : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: {
      client: { select: { id: true, name: true, code: true, company: { select: { id: true, name: true } } } },
    },
    orderBy: { date: 'desc' },
    take: 500,
  })
  return NextResponse.json({ revenues })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const accessibleIds = await getAccessibleCompanyIds(user)

  const formData = await req.formData()

  const clientId = String(formData.get('clientId') || '')
  const date = String(formData.get('date') || '')
  const dueDate = String(formData.get('dueDate') || '')
  const invoiceNo = String(formData.get('invoiceNo') || '')
  const description = String(formData.get('description') || '')
  const quantity = String(formData.get('quantity') || '1')
  const rate = String(formData.get('rate') || '0')
  const amount = String(formData.get('amount') || '0')
  const subtotal = String(formData.get('subtotal') || '')
  const taxAmount = String(formData.get('taxAmount') || '')
  const items = String(formData.get('items') || '')
  const file = formData.get('file')

  if (!clientId || !date || !invoiceNo) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    )
  }

  // Verify the client belongs to an accessible company.
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      companyId: true,
      name: true,
    },
  })

  if (!client || !accessibleIds.includes(client.companyId)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }

  // Upload supporting document to S3.
  let documentUrl: string | null = null
  let documentName: string | null = null
  let documentType: string | null = null
  let documentSize: number | null = null

  if (file instanceof File && file.size > 0) {
    const MAX_FILE_SIZE = 25 * 1024 * 1024

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size cannot exceed 25 MB' },
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

    const safeFileName = file.name.replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    )

    const storageKey =
      `companies/${client.companyId}/clients/${clientId}/revenue/` +
      `${Date.now()}-${safeFileName}`

    try {
      const uploaded = await uploadToS3(
        storageKey,
        buffer,
        file.type
      )

      documentUrl = uploaded.key
      documentName = file.name
      documentType = file.type
      documentSize = file.size
    } catch (error: any) {
      console.error('Revenue attachment S3 upload failed:', error)

      return NextResponse.json(
        {
          error:
            error.message ||
            'Failed to upload supporting document',
        },
        { status: 500 }
      )
    }
  }

  const itemsJson = items || null

  const created = await db.revenue.create({
    data: {
      clientId,
      date: new Date(date),
      dueDate: dueDate ? new Date(dueDate) : null,
      invoiceNo,
      description: description || null,
      quantity: Number(quantity) || 1,
      rate: Number(rate) || 0,
      amount: Number(amount) || 0,
      items: itemsJson,
      subtotal: subtotal ? Number(subtotal) : null,
      taxAmount: taxAmount ? Number(taxAmount) : null,
      documentUrl,
      documentName,
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          code: true,
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  // Also add the attachment to the client's document list.
  if (documentUrl) {
    await db.clientDocument.create({
      data: {
        clientId,
        name: documentName || `Invoice ${invoiceNo} Attachment`,
        category: 'Invoice',
        fileUrl: documentUrl,
        fileType: documentType || 'application/pdf',
        fileSize: documentSize,
      },
    }).catch((error) => {
      // Revenue creation should not fail if document metadata creation fails.
      console.error(
        'Failed to create client document metadata:',
        error
      )
    })
  }

  return NextResponse.json(
    { revenue: created },
    { status: 201 }
  )
}