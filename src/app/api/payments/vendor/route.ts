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
     * Payment requests are sent as multipart/form-data
     * because they may contain a supporting document.
     */
    const formData = await req.formData()

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

    const sourceValue = formData.get('source')
    const externalIdValue = formData.get('externalId')

    const source =
      sourceValue
        ? String(sourceValue)
        : undefined

    const externalId =
      externalIdValue
        ? String(externalIdValue)
        : undefined

    const fileValue = formData.get('file')

    /*
     * Validate required fields.
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
     * Find the bill first.
     *
     * IMPORTANT:
     * We do NOT trust companyId from the browser.
     * The company is determined from the bill itself.
     */
    const bill = await db.bill.findUnique({
      where: {
        id: billId,
      },
      select: {
        id: true,
        companyId: true,
        billNumber: true,
      },
    })

    if (!bill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404 }
      )
    }

    /*
     * Check whether the logged-in user can access
     * the company that owns this bill.
     */
    if (!accessibleIds.includes(bill.companyId)) {
      return NextResponse.json(
        {
          error:
            'You are not authorized to make a payment for this bill',
        },
        { status: 403 }
      )
    }

    /*
     * Always use the companyId stored on the bill.
     */
    const targetCompanyId = bill.companyId

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
    if (
      fileValue instanceof File &&
      fileValue.size > 0
    ) {
      /*
       * Validate file type.
       */
      if (!ALLOWED_FILE_TYPES.includes(fileValue.type)) {
        return NextResponse.json(
          {
            error:
              'Only PDF, JPG, PNG and WEBP files are allowed',
          },
          { status: 400 }
        )
      }

      /*
       * Validate file size.
       */
      if (fileValue.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error:
              'Supporting document cannot exceed 10 MB',
          },
          { status: 400 }
        )
      }

      const bytes =
        await fileValue.arrayBuffer()

      const buffer =
        Buffer.from(bytes)

      /*
       * Make the original filename safe
       * before using it in the S3 key.
       */
      const safeFileName =
        fileValue.name
          .replace(
            /[^a-zA-Z0-9._-]/g,
            '_'
          )
          .replace(
            /_+/g,
            '_'
          )

      /*
       * Example:
       *
       * vendor-payments/
       *   companyId/
       *     billId/
       *       timestamp-random-filename.pdf
       */
      documentKey =
        `vendor-payments/${targetCompanyId}/${billId}/` +
        `${Date.now()}-${crypto.randomUUID()}-${safeFileName}`

      /*
       * Upload to S3.
       */
      await uploadToS3(
        documentKey,
        buffer,
        fileValue.type
      )

      /*
       * Keep the key so that it can be deleted
       * if database creation fails.
       */
      uploadedKey = documentKey

      documentName = fileValue.name
      documentType = fileValue.type
      documentSize = fileValue.size
    }

    /*
     * Create the payment.
     *
     * BillService will:
     * - create VendorPayment
     * - recalculate bill status
     * - create financial transaction
     * - create audit log
     */
    const payment =
      await BillService.recordVendorPayment(
        {
          companyId: targetCompanyId,
          billId,
          paymentDate,
          amount: Number(amount),
          paymentMethod,
          referenceNumber,
          notes,
          source,
          externalId,

          documentKey,
          documentName,
          documentType,
          documentSize,
        },
        user.id,
        user.name
      )

    /*
     * Everything succeeded.
     */
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
     * If S3 upload succeeded but database
     * creation failed, remove the orphaned file.
     */
    if (uploadedKey) {
      try {
        await deleteFromS3(
          uploadedKey
        )
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