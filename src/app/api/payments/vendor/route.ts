import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getAccessibleCompanyIds } from '@/lib/auth'
import { BillService } from '@/lib/services/BillService'
import { uploadToS3, deleteFromS3 } from '@/lib/storage/s3'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const accessibleIds = await getAccessibleCompanyIds(user)

  const { searchParams } = new URL(req.url)
  const billId = searchParams.get('billId')

  const payments = await db.vendorPayment.findMany({
    where: {
      companyId: { in: accessibleIds },
      ...(billId ? { billId } : {}),
    },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
        },
      },
      bill: {
        select: {
          id: true,
          billNumber: true,
          totalAmount: true,
        },
      },
    },
    orderBy: {
      paymentDate: 'desc',
    },
  })

  return NextResponse.json({ payments })
}

export async function POST(req: NextRequest) {
  let uploadedKey: string | null = null

  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const accessibleIds = await getAccessibleCompanyIds(user)

    /*
     * IMPORTANT:
     * This endpoint now accepts multipart/form-data
     * because it can contain a supporting document.
     */
    const formData = await req.formData()

    const companyId = String(
      formData.get('companyId') || ''
    )

    const billId = String(
      formData.get('billId') || ''
    )

    const paymentDate = String(
      formData.get('paymentDate') || ''
    )

    const amount = Number(
      formData.get('amount') || 0
    )

    const paymentMethod = String(
      formData.get('paymentMethod') || 'BANK_TRANSFER'
    )

    const referenceNumberValue =
      formData.get('referenceNumber')

    const notesValue =
      formData.get('notes')

    const referenceNumber =
      referenceNumberValue
        ? String(referenceNumberValue)
        : undefined

    const notes =
      notesValue
        ? String(notesValue)
        : undefined

    const fileValue = formData.get('file')

    /*
     * Validate required payment fields
     */
    if (!billId) {
      return NextResponse.json(
        { error: 'Bill ID is required' },
        { status: 400 }
      )
    }

    if (!paymentDate) {
      return NextResponse.json(
        { error: 'Payment date is required' },
        { status: 400 }
      )
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        {
          error:
            'Payment amount must be greater than zero',
        },
        { status: 400 }
      )
    }

    /*
     * Determine target company.
     */
    const targetCompanyId =
      user.role === 'GROUP_ADMIN' && companyId
        ? companyId
        : user.companyId || accessibleIds[0]

    if (!targetCompanyId) {
      return NextResponse.json(
        { error: 'Company could not be determined' },
        { status: 400 }
      )
    }

    if (!accessibleIds.includes(targetCompanyId)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    /*
     * Verify that the bill belongs to the selected company.
     */
    const bill = await db.bill.findFirst({
      where: {
        id: billId,
        companyId: targetCompanyId,
      },
      select: {
        id: true,
        billNumber: true,
      },
    })

    if (!bill) {
      return NextResponse.json(
        { error: 'Bill not found or unauthorized' },
        { status: 404 }
      )
    }

    /*
     * Supporting document information.
     */
    let documentKey: string | undefined
    let documentName: string | undefined
    let documentType: string | undefined
    let documentSize: number | undefined

    /*
     * Upload supporting document if provided.
     */
    if (fileValue instanceof File && fileValue.size > 0) {
      if (!ALLOWED_FILE_TYPES.includes(fileValue.type)) {
        return NextResponse.json(
          {
            error:
              'Only PDF, JPG, PNG and WEBP files are allowed',
          },
          { status: 400 }
        )
      }

      if (fileValue.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error:
              'Supporting document cannot exceed 10 MB',
          },
          { status: 400 }
        )
      }

      const bytes = await fileValue.arrayBuffer()
      const buffer = Buffer.from(bytes)

      const safeFileName = fileValue.name
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_')

      /*
       * Example S3 path:
       *
       * vendor-payments/
       *   companyId/
       *     billId/
       *       timestamp-file.pdf
       */
      documentKey =
        `vendor-payments/${targetCompanyId}/${billId}/` +
        `${Date.now()}-${crypto.randomUUID()}-${safeFileName}`

      await uploadToS3(
        documentKey,
        buffer,
        fileValue.type
      )

      uploadedKey = documentKey

      documentName = fileValue.name
      documentType = fileValue.type
      documentSize = fileValue.size
    }

    /*
     * Create the VendorPayment record.
     *
     * BillService will also:
     * - recalculate the bill status
     * - create the financial transaction
     * - create the audit log
     */
    const payment =
      await BillService.recordVendorPayment(
        {
          companyId: targetCompanyId,
          billId,
          paymentDate: paymentDate || new Date(),
          amount: Number(amount),
          paymentMethod,
          referenceNumber,
          notes,

          documentKey,
          documentName,
          documentType,
          documentSize,
        },
        user.id,
        user.name
      )

    return NextResponse.json(
      {
        payment,
        document: documentKey
          ? {
              key: documentKey,
              name: documentName,
              type: documentType,
              size: documentSize,
            }
          : null,
      },
      { status: 201 }
    )
  } catch (err: any) {
    /*
     * If S3 upload succeeded but database creation failed,
     * remove the orphaned S3 object.
     */
    if (uploadedKey) {
      try {
        await deleteFromS3(uploadedKey)
      } catch (deleteError) {
        console.error(
          'Failed to clean up uploaded S3 file:',
          deleteError
        )
      }
    }

    console.error(
      'Vendor payment creation failed:',
      err
    )

    return NextResponse.json(
      {
        error:
          err?.message ||
          'Vendor payment recording failed',
      },
      { status: 400 }
    )
  }
}