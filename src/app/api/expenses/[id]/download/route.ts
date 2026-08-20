import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'
import {
  getS3DownloadUrl,
  getS3FileType,
} from '@/lib/storage/s3'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { id } = await params
  const accessibleIds = await getAccessibleCompanyIds(user)

  const expense = await db.expense.findUnique({
    where: { id },
    select: {
      id: true,
      companyId: true,
      documentUrl: true,
      documentName: true,
    },
  })

  if (!expense) {
    return NextResponse.json(
      { error: 'Expense not found' },
      { status: 404 }
    )
  }

  if (!accessibleIds.includes(expense.companyId)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }

  if (!expense.documentUrl) {
    return NextResponse.json(
      { error: 'No attachment found for this expense' },
      { status: 404 }
    )
  }

  try {
    const [url, fileType] = await Promise.all([
      getS3DownloadUrl(expense.documentUrl, 3600),
      getS3FileType(expense.documentUrl),
    ])

    return NextResponse.json({
      url,
      expiresIn: 3600,
      fileName: expense.documentName,
      fileType,
    })
  } catch (error: any) {
    console.error(
      'Failed to generate Expense attachment URL:',
      error
    )

    return NextResponse.json(
      {
        error:
          error.message ||
          'Failed to generate document URL',
      },
      { status: 500 }
    )
  }
}