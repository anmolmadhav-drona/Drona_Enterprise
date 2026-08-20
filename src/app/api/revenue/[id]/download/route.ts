import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'
import { getS3DownloadUrl } from '@/lib/storage/s3'

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

  const revenue = await db.revenue.findUnique({
    where: { id },
    include: {
        client: {
        select: {
            companyId: true,
        },
        },
    },
    })


  if (!revenue) {
    return NextResponse.json(
      { error: 'Revenue record not found' },
      { status: 404 }
    )
  }

  if (!accessibleIds.includes(revenue.client.companyId)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }
  const clientDocument = revenue.documentUrl
  ? await db.clientDocument.findFirst({
      where: {
        clientId: revenue.clientId,
        fileUrl: revenue.documentUrl,
      },
      select: {
        fileType: true,
      },
    })
  : null

  if (!revenue.documentUrl) {
    return NextResponse.json(
      { error: 'No attachment found for this invoice' },
      { status: 404 }
    )
  }

  try {
    const url = await getS3DownloadUrl(
      revenue.documentUrl,
      3600
    )

    return NextResponse.json({
        url,
        expiresIn: 3600,
        fileName: revenue.documentName,
        fileType: clientDocument?.fileType || null,
        })
  } catch (error: any) {
    console.error(
      'Failed to generate Revenue attachment URL:',
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