import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'

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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessibleIds = await getAccessibleCompanyIds(user)

  const body = await req.json()
  const { clientId, date, invoiceNo, description, quantity, rate, amount, items, subtotal, taxAmount, documentUrl, documentName } = body
  if (!clientId || !date || !invoiceNo) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify the client belongs to an accessible company (tenant isolation).
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { companyId: true, name: true },
  })
  if (!client || !accessibleIds.includes(client.companyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const itemsJson = items ? (typeof items === 'string' ? items : JSON.stringify(items)) : null

  const created = await db.revenue.create({
    data: {
      clientId,
      date: new Date(date),
      invoiceNo,
      description,
      quantity: quantity ? Number(quantity) : 1,
      rate: rate ? Number(rate) : 0,
      amount: amount ? Number(amount) : 0,
      items: itemsJson,
      subtotal: subtotal != null ? Number(subtotal) : null,
      taxAmount: taxAmount != null ? Number(taxAmount) : null,
      documentUrl: documentUrl || null,
      documentName: documentName || null,
    },
    include: {
      client: { select: { id: true, name: true, code: true, company: { select: { id: true, name: true } } } },
    },
  })

  // If supportive document (image/pdf) was uploaded, also record it under the client's documents directory
  if (documentUrl) {
    let fileType = 'application/pdf'
    if (documentUrl.startsWith('data:image/')) {
      fileType = documentUrl.split(';')[0].replace('data:', '')
    } else if (documentUrl.startsWith('data:application/pdf')) {
      fileType = 'application/pdf'
    }

    await db.clientDocument.create({
      data: {
        clientId,
        name: documentName || `Invoice ${invoiceNo} Attachment`,
        category: 'Invoice',
        fileUrl: documentUrl,
        fileType,
        fileSize: null,
      },
    }).catch(() => {
      // non-fatal
    })
  }

  return NextResponse.json({ revenue: created }, { status: 201 })
}
