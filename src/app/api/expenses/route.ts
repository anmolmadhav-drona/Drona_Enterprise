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
  const categoryId = searchParams.get('categoryId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const expenses = await db.expense.findMany({
    where: {
      companyId:
        user.role === 'GROUP_ADMIN' && companyId
          ? companyId
          : { in: accessibleIds },
      ...(categoryId ? { categoryId } : {}),
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
      company: { select: { id: true, name: true } },
      category: true,
    },
    orderBy: { date: 'desc' },
    take: 500,
  })
  return NextResponse.json({ expenses })
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

  const companyId = String(formData.get('companyId') || '')
  const categoryId = String(formData.get('categoryId') || '')
  const date = String(formData.get('date') || '')
  const amount = String(formData.get('amount') || '')
  const description = String(formData.get('description') || '')
  const file = formData.get('file')

  if (!categoryId || !date || !amount) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    )
  }

  const targetCompany =
    user.role === 'GROUP_ADMIN' && companyId
      ? companyId
      : accessibleIds[0]

  if (!accessibleIds.includes(targetCompany)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }

  let documentUrl: string | null = null
  let documentName: string | null = null

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
      `companies/${targetCompany}/expenses/` +
      `${Date.now()}-${safeFileName}`

    try {
      const uploaded = await uploadToS3(
        storageKey,
        buffer,
        file.type
      )

      documentUrl = uploaded.key
      documentName = file.name
    } catch (error: any) {
      console.error('Expense receipt S3 upload failed:', error)

      return NextResponse.json(
        {
          error:
            error.message ||
            'Failed to upload expense receipt',
        },
        { status: 500 }
      )
    }
  }

  const created = await db.expense.create({
    data: {
      companyId: targetCompany,
      categoryId,
      date: new Date(date),
      amount: Number(amount),
      description: description || null,
      documentUrl,
      documentName,
    },
    include: {
      category: true,
      company: true,
    },
  })

  return NextResponse.json(
    { expense: created },
    { status: 201 }
  )
}